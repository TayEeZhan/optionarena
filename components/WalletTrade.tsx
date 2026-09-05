'use client';

import { useState } from 'react';
import { readableWalletError, useWallet } from './WalletProvider';

/**
 * Buy the contract with your own wallet.
 *
 * Two transactions the person signs themselves: approve the OptionBook to take
 * the premium, then fill. The server builds the calldata and never sees a key —
 * see `lib/thetanuts/calldata.ts`.
 *
 * **What this cannot do today.** Every buyable order on Base is physically
 * settled, and those revert inside the OptionBook with an arithmetic overflow —
 * `docs/decisions.md` §14. The approval goes through; the fill is attempted for
 * real and fails with the protocol's own reason. That reason is shown verbatim
 * rather than softened, because a person who has just signed a transaction is
 * owed the actual error. When the overflow is fixed upstream, this works
 * unchanged.
 */

type Stage = 'idle' | 'building' | 'approving' | 'filling' | 'done' | 'failed';

export function WalletTrade({
  instrumentId,
  budget,
  maxLossDisplay,
}: {
  instrumentId: string;
  budget: number;
  maxLossDisplay: string;
}) {
  const { account, onBase, ensureBase, provider } = useWallet();
  const [stage, setStage] = useState<Stage>('idle');
  const [approveHash, setApproveHash] = useState<string | null>(null);
  const [fillHash, setFillHash] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const busy = stage === 'building' || stage === 'approving' || stage === 'filling';

  async function trade() {
    setProblem(null);
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
      setStage('building');
      const response = await fetch('/api/calldata', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ instrumentId, budget }),
      });
      const calldata = await response.json();
      if (!response.ok) throw new Error(calldata.error ?? 'The calldata could not be built.');

      setStage('approving');
      const approve = (await eth.request({
        method: 'eth_sendTransaction',
        params: [{ from: account, to: calldata.approve.to, data: calldata.approve.data }],
      })) as string;
      setApproveHash(approve);

      setStage('filling');
      const fill = (await eth.request({
        method: 'eth_sendTransaction',
        params: [{ from: account, to: calldata.fill.to, data: calldata.fill.data }],
      })) as string;

      setFillHash(fill);
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
        You sign this yourself and the funds stay yours. Two transactions: an approval, then the
        fill.
      </p>

      <button
        type="button"
        onClick={trade}
        disabled={busy || !onBase}
        className="mt-5 w-full rounded-2xl bg-[var(--color-loss)] py-4 text-[1rem] font-semibold text-[#1a0a0a] transition-[filter,transform] hover:brightness-110 active:scale-[0.985] disabled:opacity-40"
      >
        {stage === 'building' && 'Reading the book…'}
        {stage === 'approving' && 'Approve in your wallet…'}
        {stage === 'filling' && 'Confirm the fill in your wallet…'}
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

      {approveHash && (
        <Receipt label={stage === 'done' ? 'Approved' : 'Approval sent'} hash={approveHash} />
      )}
      {fillHash && <Receipt label="Filled" hash={fillHash} />}

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
