import 'server-only';

import { signingClient, canSign, explorerTx, maxTradeUsdc, chainConfig } from '../thetanuts/client';
import { assertMagnitude, formatUnits, fromUnits, toUnits } from '../thetanuts/decimals';
import type { Instrument } from '../thetanuts/book';
import type { Quote } from '../thetanuts/quote';

/**
 * Placing the trade.
 *
 * This is the file that spends real money, so every step before the signature
 * is a check, and every check fails loudly rather than continuing.
 *
 * Order of operations:
 *   1. Refuse if the app cannot sign.
 *   2. Refuse if the size is above the configured ceiling.
 *   3. Prove the amount is the magnitude the user asked for.
 *   4. Check the wallet holds enough collateral.
 *   5. Approve the OptionBook to spend, if it is not approved already.
 *   6. Simulate the fill against real chain state.
 *   7. Only then sign and send.
 */

export interface ExecutionResult {
  txHash: string;
  explorerUrl: string;
  /** Collateral actually spent, in the order's collateral token. */
  spent: bigint;
  collateralSymbol: string;
  collateralDecimals: number;
  blockNumber: number;
  gasUsed: string;
}

export class ExecutionRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExecutionRefused';
  }
}

/**
 * Buy the instrument the agent chose.
 *
 * @param instrument the contract to buy
 * @param quote      the quote the user approved at step 02
 * @param budget     the human budget, used to prove the magnitude again here
 */
export async function execute(
  instrument: Instrument,
  quote: Quote,
  budget: number,
): Promise<ExecutionResult> {
  if (!canSign()) {
    throw new ExecutionRefused(
      'OptionArena has no signing key configured, so it cannot trade. ' +
        'Set PRIVATE_KEY to enable the live path, or stay in demo mode.',
    );
  }

  // Physically settled contracts revert. Confirmed twice: `Panic(0x11)` from
  // the OptionBook across 62 orders, nine sizes and three RPCs, and then by the
  // Thetanuts team, who said physical settlement is not routed into the SDK
  // yet. Refusing here means the app never broadcasts a transaction we already
  // know fails. Demo mode is untouched, so step 02 still prices these and shows
  // a real maximum loss. See docs/decisions.md sections 14 and 15.
  if (instrument.isPhysical) {
    throw new ExecutionRefused(
      `${instrument.structure} contracts cannot be filled yet. Physical settlement ` +
        `is not routed into the Thetanuts SDK, and the OptionBook reverts with an ` +
        `arithmetic overflow. The prices and the maximum loss above are real; only ` +
        `the signature is unavailable.`,
    );
  }

  const { decimals, symbol, address } = instrument.collateral;
  const client = signingClient();

  // The whole point of the ceiling is that the first run of any path is small.
  const ceiling = maxTradeUsdc();
  if (budget > ceiling) {
    throw new ExecutionRefused(
      `This trade is ${budget} ${symbol}, above the ${ceiling} ceiling set by ` +
        `MAX_TRADE_USDC. Raise the ceiling deliberately if that is really intended.`,
    );
  }

  // Spend exactly what the user was quoted, never a recomputed number.
  const spend = quote.premium;

  // Prove the magnitude one last time, against this order's own token.
  assertMagnitude(spend, budget, decimals, `Trade size in ${symbol}`);

  // The network the signer is on must be the network these addresses are for.
  await client.assertNetwork();

  const account = await client.getSignerAddress();

  const balance = await client.erc20.getBalance(address, account);
  if (balance < spend) {
    // Exact figures: a shortfall smaller than the display precision otherwise
    // reads as the wallet holding exactly what the trade needs.
    throw new ExecutionRefused(
      `The wallet holds ${fromUnits(balance, decimals)} ${symbol} but the trade needs ` +
        `${fromUnits(spend, decimals)} ${symbol}. Either fund ${account}, or retry with ` +
        `--budget ${Math.floor(Number(fromUnits(balance, decimals)) * 10) / 10}.`,
    );
  }

  // Approve only what this trade needs, not an unlimited allowance.
  // getContractAddress throws if the contract is not deployed on this chain,
  // which is the right outcome: never sign against a missing address.
  const optionBook = client.getContractAddress('optionBook');
  await client.erc20.ensureAllowance(address, optionBook, spend);

  // Simulate against real chain state. A quote from 30 seconds ago may no
  // longer be fillable, and this is where that shows up rather than in a
  // reverted transaction that has already cost gas.
  const simulation = await client.optionBook.callStaticFillOrder(instrument.raw, spend);
  if (!simulation.success) {
    throw new ExecutionRefused(
      `The order cannot be filled right now: ${simulation.error?.message ?? 'the contract rejected it'}. ` +
        `Resting orders expire quickly. Price the strategy again and retry.`,
    );
  }

  // Everything has passed. Sign and send.
  const receipt = await client.optionBook.fillOrder(instrument.raw, spend);

  return {
    txHash: receipt.hash,
    explorerUrl: explorerTx(receipt.hash),
    spent: spend,
    collateralSymbol: symbol,
    collateralDecimals: decimals,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed?.toString() ?? '0',
  };
}

/**
 * A dry run of everything except the signature.
 *
 * Used by `scripts/verify-fill.ts` so the whole path can be proven on a machine
 * with a key, without spending anything.
 */
export async function dryRun(
  instrument: Instrument,
  quote: Quote,
  budget: number,
): Promise<{ ok: boolean; checks: string[]; problem?: string }> {
  const checks: string[] = [];
  const { decimals, symbol, address } = instrument.collateral;

  try {
    if (!canSign()) throw new ExecutionRefused('No signing key configured.');
    checks.push('Signing key present');

    const ceiling = maxTradeUsdc();
    if (budget > ceiling) throw new ExecutionRefused(`Budget ${budget} above ceiling ${ceiling}.`);
    checks.push(`Budget ${budget} ${symbol} within the ${ceiling} ceiling`);

    const spend = quote.premium;
    assertMagnitude(spend, budget, decimals, `Trade size in ${symbol}`);
    checks.push(
      `Magnitude proven: ${fromUnits(spend, decimals)} ${symbol} = ${spend} units at ${decimals} decimals`,
    );

    const client = signingClient();
    await client.assertNetwork();
    checks.push(`Signer is on ${chainConfig.name}`);

    const account = await client.getSignerAddress();
    checks.push(`Trading from ${account}`);

    const balance = await client.erc20.getBalance(address, account);
    checks.push(`Wallet holds ${formatUnits(balance, decimals)} ${symbol}`);
    if (balance < spend) {
      // Exact figures, not the 2-decimal display. A shortfall of one millionth
      // rendered as "Needs 1.00, holds 1.00", which reads as a contradiction.
      const short = fromUnits(spend - balance, decimals);
      throw new ExecutionRefused(
        `Needs ${fromUnits(spend, decimals)} ${symbol} but holds ${fromUnits(balance, decimals)}, ` +
          `short by ${short}. Retry with a smaller budget, for example ` +
          `--budget ${Math.floor(Number(fromUnits(balance, decimals)) * 10) / 10}.`,
      );
    }

    const allowance = await client.erc20.getAllowance(
      address,
      account,
      client.getContractAddress('optionBook'),
    );
    checks.push(
      allowance >= spend
        ? 'OptionBook already approved for this size'
        : 'OptionBook approval needed, would be requested before filling',
    );

    const simulation = await client.optionBook.callStaticFillOrder(instrument.raw, spend);
    if (!simulation.success) {
      throw new ExecutionRefused(simulation.error?.message ?? 'the contract rejected the fill');
    }
    checks.push('Fill simulated against live chain state and succeeded');

    return { ok: true, checks };
  } catch (error) {
    return {
      ok: false,
      checks,
      problem: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Convert a human budget to chain units for this instrument. Exported for tests. */
export function budgetToUnits(instrument: Instrument, budget: number): bigint {
  return toUnits(budget, instrument.collateral.decimals);
}

/**
 * Sell into a resting bid by posting collateral.
 *
 * The buy side is blocked upstream, so this is the only path that reaches the
 * chain. It runs the same checks as `execute()` in the same order, because the
 * checks are the point: a second, looser path would defeat them.
 *
 * **The risk is not the buy side's risk.** A buyer's worst case is the premium
 * paid. A seller posts collateral and the worst case is bounded by what was
 * posted. This function therefore takes a collateral amount, not a budget, and
 * reports no premium figure: the SDK's preview derives `numContracts` from the
 * amount passed, so a premium computed from it would just echo the input. The
 * real economics are measured on-chain by `scripts/verify-sell.ts`.
 *
 * @param instrument a resting bid from `fetchSellable`
 * @param collateral how much to post, in whole units of the collateral token
 */
export async function executeSell(
  instrument: Instrument,
  collateral: number,
): Promise<ExecutionResult> {
  if (!canSign()) {
    throw new ExecutionRefused(
      'OptionArena has no signing key configured, so it cannot trade. ' +
        'Set PRIVATE_KEY to enable the live path, or stay in demo mode.',
    );
  }

  if (!instrument.makerIsBuying) {
    throw new ExecutionRefused(
      'That order is an offer, not a bid. executeSell fills bids; use execute() to buy.',
    );
  }

  const { decimals, symbol, address } = instrument.collateral;
  const client = signingClient();

  const ceiling = maxTradeUsdc();
  if (collateral > ceiling) {
    throw new ExecutionRefused(
      `This trade posts ${collateral} ${symbol}, above the ${ceiling} ceiling set by ` +
        `MAX_TRADE_USDC. Raise the ceiling deliberately if that is really intended.`,
    );
  }

  const post = toUnits(collateral, decimals);

  // Prove the magnitude against this order's own token, exactly as the buy
  // path does. This is the check that catches a decimals mistake before it
  // becomes an irreversible transfer.
  assertMagnitude(post, collateral, decimals, `Collateral in ${symbol}`);

  await client.assertNetwork();
  const account = await client.getSignerAddress();

  const balance = await client.erc20.getBalance(address, account);
  if (balance < post) {
    throw new ExecutionRefused(
      `The wallet holds ${fromUnits(balance, decimals)} ${symbol} but this posts ` +
        `${fromUnits(post, decimals)} ${symbol}. Either fund ${account}, or retry with ` +
        `--collateral ${Math.floor(Number(fromUnits(balance, decimals)) * 10) / 10}.`,
    );
  }

  await client.erc20.ensureAllowance(address, client.getContractAddress('optionBook'), post);

  // The last gate. A resting bid can be requoted or taken between reading the
  // book and signing, and this is where that shows up rather than in a reverted
  // transaction that has already cost gas.
  const simulation = await client.optionBook.callStaticFillOrder(instrument.raw, post);
  if (!simulation.success) {
    throw new ExecutionRefused(
      `The bid cannot be filled right now: ${simulation.error?.message ?? 'the contract rejected it'}. ` +
        `Resting orders expire quickly. Read the book again and retry.`,
    );
  }

  const receipt = await client.optionBook.fillOrder(instrument.raw, post);

  return {
    txHash: receipt.hash,
    explorerUrl: explorerTx(receipt.hash),
    spent: post,
    collateralSymbol: symbol,
    collateralDecimals: decimals,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed?.toString() ?? '0',
  };
}
