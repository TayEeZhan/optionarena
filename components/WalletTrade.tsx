'use client';

import { useState } from 'react';
import { formatUnits } from '@/lib/thetanuts/decimals';
import { readableWalletError, useWallet } from './WalletProvider';

/**
 * Buy the contract with your own wallet.
 *
 * Two transactions the person signs themselves: approve the OptionBook to take
 * the premium, then fill. The server builds the calldata and never sees a key —
 * see `lib/thetanuts/calldata.ts`.
 *
 * **Nothing is signed until the chain has been asked whether it would work.**
 * This used to go straight from building calldata to a wallet prompt, which
 * meant someone holding 1.00 aBasUSDC could approve a 5.00 trade, pay gas, and
 * meet MetaMask's orange "this transaction is likely to fail" with no
 * explanation of what was wrong. The app already knew the balance — it is on
 * the same screen. Now it checks:
 *
 *   1. the balance covers the premium         -> refuse, with the shortfall
 *   2. the fill simulates without reverting   -> warn, and say why
 *   3. the approval is mined before the fill  -> never race the allowance
 *
 * **What this still cannot do.** Every buyable order on Base is physically
 * settled, and those revert inside the OptionBook with an arithmetic overflow —
 * `docs/decisions.md` §14. Step 2 now catches that *before* any signature and
 * says so in the app's own words. Proceeding anyway is still offered, because
 * that failure is worth seeing on-chain and the transaction is the person's to
 * make. When the overflow is fixed upstream, this works unchanged.
 */

type Stage =
  'idle' | 'checking' | 'approving' | 'confirming' | 'filling' | 'settling' | 'done' | 'failed';

/** Something found before signing. `canOverride` means a warning, not a wall. */
interface Blocker {
  title: string;
  detail: string;
  canOverride: boolean;
}

/** The server's answer from `/api/calldata`, as this component uses it. */
interface Calldata {
  label: string;
  symbol: string;
  decimals: number;
  spendUnits: string;
  token: string;
  optionBook: string;
  approve: { to: string; data: string };
  fill: { to: string; data: string };
}

export function WalletTrade({
  instrumentId,
  budget,
  maxLossDisplay,
}: {
  instrumentId: string;
  budget: number;
  maxLossDisplay: string;
}) {
  const {
    account,
    onBase,
    ensureBase,
    provider,
    readBalanceUnits,
    readAllowance,
    simulate,
    waitForReceipt,
  } = useWallet();

  const [stage, setStage] = useState<Stage>('idle');
  const [approveHash, setApproveHash] = useState<string | null>(null);
  const [fillHash, setFillHash] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [blocker, setBlocker] = useState<Blocker | null>(null);

  const busy =
    stage === 'checking' ||
    stage === 'approving' ||
    stage === 'confirming' ||
    stage === 'filling' ||
    stage === 'settling';

  /**
   * Everything that can be learned without a signature.
   *
   * Returns the calldata when it is safe to go on, or null when it is not,
   * having already put the reason on screen.
   */
  async function preflight(force: boolean): Promise<Calldata | null> {
    const response = await fetch('/api/calldata', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ instrumentId, budget }),
    });
    const calldata = (await response.json()) as Calldata & { error?: string };
    if (!response.ok) throw new Error(calldata.error ?? 'The calldata could not be built.');

    const need = BigInt(calldata.spendUnits);
    const { decimals, symbol } = calldata;

    // 1. Money. Checked first because it is the one thing a person can actually
    //    fix, and a wallet prompt for more than you hold is never worth showing.
    //    A null balance means unreadable, which is not zero and must not be
    //    reported as a shortfall.
    const held = await readBalanceUnits(calldata.token);
    if (held !== null && held < need) {
      setBlocker(shortfall(need, held, decimals, symbol));
      return null;
    }

    // 2. The chain's own opinion — but only once the OptionBook is allowed to
    //    take the premium. Simulating before that reverts on the allowance and
    //    says nothing about the trade, so when the allowance is short we skip
    //    it here and simulate after the approval is mined, which is still
    //    before the fill signature.
    const allowance = await readAllowance(calldata.token, calldata.optionBook);
    if (!force && allowance !== null && allowance >= need) {
      const check = await simulate(calldata.fill.to, calldata.fill.data);
      if (!check.ok) {
        setBlocker(rejection(check.reason));
        return null;
      }
    }

    return calldata;
  }

  async function trade(force = false) {
    setProblem(null);
    setBlocker(null);
    setFillHash(null);

    const eth = provider();
    if (!eth || !account) return;

    // Checked here, not only at connect: a person can switch networks in their
    // wallet mid-flow, and Base calldata sent to another chain is money gone.
    if (!(await ensureBase())) {
      setProblem('This has to run on Base. Switch networks in your wallet and try again.');
      return;
    }

    try {
      setStage('checking');
      const calldata = await preflight(force);
      if (!calldata) {
        setStage('idle');
        return;
      }

      setStage('approving');
      const approve = (await eth.request({
        method: 'eth_sendTransaction',
        params: [{ from: account, to: calldata.approve.to, data: calldata.approve.data }],
      })) as string;
      setApproveHash(approve);

      // The approval has to be mined, not merely broadcast. The fill reads the
      // allowance the approval sets, and a fill that overtakes it fails for a
      // reason that has nothing to do with the trade.
      setStage('confirming');
      const approved = await waitForReceipt(approve);
      if (approved.status === 'failed') {
        throw new Error('The approval was mined but reverted, so the fill was not attempted.');
      }
      if (approved.status === 'timeout') {
        throw new Error(
          'The approval has not been mined yet. Wait for it to confirm on Basescan, then try again.',
        );
      }

      // With the allowance really in place the simulation means what it says.
      // This is the last exit before the second signature.
      if (!force) {
        const check = await simulate(calldata.fill.to, calldata.fill.data);
        if (!check.ok) {
          setBlocker(rejection(check.reason));
          setStage('idle');
          return;
        }
      }

      setStage('filling');
      const fill = (await eth.request({
        method: 'eth_sendTransaction',
        params: [{ from: account, to: calldata.fill.to, data: calldata.fill.data }],
      })) as string;
      setFillHash(fill);

      setStage('settling');
      const filled = await waitForReceipt(fill);
      if (filled.status === 'failed') {
        throw new Error('The fill was mined but reverted. The hash below shows what happened.');
      }

      setStage('done');
    } catch (failure) {
      setProblem(readableWalletError(failure));
      setStage('failed');
    }
  }

  return (
    <div className="card p-6 sm:p-8">
      <p className="eyebrow">Your wallet</p>
      <p className="mt-2 text-[0.9rem] leading-relaxed text-[var(--color-ink-muted)]">
        You sign this yourself and the funds stay yours. Nothing is signed until we have checked
        your balance and asked the chain whether the fill would work.
      </p>

      <button
        type="button"
        onClick={() => trade()}
        disabled={busy || !onBase}
        className="mt-5 w-full rounded-2xl bg-[var(--color-loss)] py-4 text-[1rem] font-semibold text-[#1a0a0a] transition-[filter,transform] hover:brightness-110 active:scale-[0.985] disabled:opacity-40"
      >
        {stage === 'checking' && 'Checking before you sign…'}
        {stage === 'approving' && 'Approve in your wallet…'}
        {stage === 'confirming' && 'Waiting for the approval to confirm…'}
        {stage === 'filling' && 'Confirm the fill in your wallet…'}
        {stage === 'settling' && 'Waiting for the fill to confirm…'}
        {(stage === 'idle' || stage === 'done' || stage === 'failed') &&
          `Buy with my wallet — up to ${maxLossDisplay}`}
      </button>

      {!onBase && (
        <p className="mt-3 text-center text-[0.8rem] text-[var(--color-loss)]">
          Your wallet is on another network. Switch to Base first.
        </p>
      )}

      <p className="mt-3.5 text-center text-[0.8rem] leading-relaxed text-[var(--color-ink-faint)]">
        Priced in aBasUSDC, which is USDC supplied to Aave on Base. Plain USDC cannot fill — supply
        it on app.aave.com first.
      </p>

      {blocker && (
        <div className="mt-4 rounded-2xl border border-[var(--color-loss)]/30 bg-[var(--color-loss)]/[0.06] px-4 py-3.5">
          <p className="text-[0.85rem] font-semibold text-[var(--color-loss)]">{blocker.title}</p>
          <p className="mt-2 text-[0.78rem] leading-relaxed text-[var(--color-ink-muted)]">
            {blocker.detail}
          </p>
          <p className="mt-2 text-[0.72rem] text-[var(--color-ink-faint)]">
            Nothing was signed and no gas was spent.
          </p>

          {blocker.canOverride && (
            <button
              type="button"
              onClick={() => trade(true)}
              className="mt-3 rounded-xl border border-[var(--color-hairline)] px-4 py-2 text-[0.78rem] font-semibold text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            >
              Sign it anyway and let it fail on-chain
            </button>
          )}
        </div>
      )}

      {approveHash && (
        <Receipt
          label={stage === 'checking' || stage === 'approving' ? 'Approval sent' : 'Approved'}
          hash={approveHash}
        />
      )}
      {fillHash && <Receipt label={stage === 'done' ? 'Filled' : 'Fill sent'} hash={fillHash} />}

      {problem && (
        <div className="mt-4 rounded-2xl border border-[var(--color-loss)]/30 bg-[var(--color-loss)]/[0.06] px-4 py-3.5">
          <p className="text-[0.85rem] font-semibold text-[var(--color-loss)]">
            The transaction did not go through
          </p>
          <p className="data mt-2 text-[0.75rem] leading-relaxed break-words text-[var(--color-ink-muted)]">
            {problem}
          </p>
          <p className="mt-3 text-[0.75rem] leading-relaxed text-[var(--color-ink-faint)]">
            If that mentions an arithmetic overflow, it is not your wallet. Every buyable order on
            Base is physically settled and those revert inside the OptionBook — the same failure our
            own signing path hits. See <code>docs/decisions.md</code> §14.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * What to say when the wallet cannot cover the premium.
 *
 * The suggested budget is floored to two places so it is never larger than what
 * is actually held — a suggestion that also fails would be worse than none.
 */
function shortfall(need: bigint, held: bigint, decimals: number, symbol: string): Blocker {
  // Integer maths, then divide: the units themselves never become a float.
  const affordable = Number((held * 100n) / 10n ** BigInt(decimals)) / 100;

  return {
    title: `Not enough ${symbol}`,
    detail:
      `This costs ${formatUnits(need, decimals)} ${symbol} and your wallet holds ` +
      `${formatUnits(held, decimals)}, short by ${formatUnits(need - held, decimals)}. ` +
      (affordable > 0
        ? `Try a budget of ${affordable} or less, or supply more USDC to Aave on Base.`
        : `Supply USDC to Aave on Base — that is what returns ${symbol}.`),
    canOverride: false,
  };
}

/**
 * What to say when the chain refuses the fill.
 *
 * The overflow is named specifically because it is the one this project expects
 * and has documented. Anything else is reported in the contract's own words,
 * and an undecodable revert says so rather than borrowing the known cause.
 */
function rejection(reason: string | null): Blocker {
  const overflow = reason?.includes('arithmetic overflow') ?? false;

  return {
    title: overflow ? 'The OptionBook rejects this fill' : 'The chain rejected this fill',
    detail: overflow
      ? 'Simulated against live chain state, the fill reverts with an arithmetic overflow inside ' +
        "Thetanuts' OptionBook. Every buyable order on Base is physically settled, and physical " +
        'settlement is not routed into the SDK yet. The prices and the maximum loss above are ' +
        'real; only the signature is unavailable. See docs/decisions.md §14.'
      : reason
        ? `Simulated against live chain state, the fill reverts: ${reason}.`
        : 'Simulated against live chain state, the fill reverts, and the contract gave no reason ' +
          'we could decode.',
    canOverride: true,
  };
}

function Receipt({ label, hash }: { label: string; hash: string }) {
  return (
    <a
      href={`https://basescan.org/tx/${hash}`}
      target="_blank"
      rel="noreferrer noopener"
      className="mt-4 block rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-surface-high)] px-4 py-3"
    >
      <p className="eyebrow">{label}</p>
      <p className="data mt-1.5 text-[0.75rem] break-all text-[var(--color-accent-bright)]">
        {hash}
      </p>
    </a>
  );
}
