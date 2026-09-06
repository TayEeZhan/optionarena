import 'server-only';

import { isUsdcCollateral } from './book';
import type { Instrument } from './book';

/**
 * Turn a budget in dollars into a budget in the order's own collateral token.
 *
 * **This exists to stop an eighty-thousand-fold overspend.** Every amount in
 * this project is denominated by the collateral on its own order, and the buy
 * side is not all USDC: ETH calls are collateralised in aBasWETH and BTC calls
 * in cbBTC. A person types `1` meaning one dollar. Against a cbBTC order that
 * same `1` is one whole bitcoin.
 *
 * Neither existing guard catches it. `maxTradeUsdc()` compares the bare number
 * `1` against a ceiling of 25 and passes. `assertMagnitude` proves that 1 cbBTC
 * really is 100000000 units at 8 decimals, which is true and beside the point.
 * Both would wave through a trade eighty thousand times the intended size.
 *
 * `fetchBuyable`'s `usdcOnly` default was the only thing standing between the
 * app and that bug. Opening the buy side to plain-token collateral — which is
 * the only collateral that actually fills — means this conversion has to take
 * over that job.
 */

/** A budget made safe to spend, with the reasoning kept. */
export interface ConvertedBudget {
  /** What the user meant, in dollars. Unchanged. */
  usd: number;
  /** What to actually spend, in the order's collateral token. */
  inCollateral: number;
  /** The spot price used, or null when no conversion was needed. */
  spotUsed: number | null;
  /** Set when the two differ, so the interface can say so plainly. */
  note: string | null;
}

/** Refuses rather than guessing when a budget cannot be converted safely. */
export class BudgetRefused extends Error {}

/**
 * @param usd        the budget the user typed, in dollars
 * @param instrument the order it will be spent against
 * @param spot       live underlying prices, keyed by symbol, from `fetchSpot()`
 *
 * @throws BudgetRefused when the collateral is not USDC and no spot price is
 *         available. A missing price is not a reason to fall back to treating
 *         dollars as bitcoin — it is a reason to stop.
 */
export function budgetInCollateral(
  usd: number,
  instrument: Instrument,
  spot: Record<string, number>,
): ConvertedBudget {
  if (!(usd > 0)) throw new BudgetRefused('The budget must be more than zero.');

  // A USDC-priced order needs no conversion: a dollar is a dollar. This covers
  // aBasUSDC too, which tracks the dollar one for one.
  if (isUsdcCollateral(instrument)) {
    return { usd, inCollateral: usd, spotUsed: null, note: null };
  }

  const { symbol } = instrument.collateral;
  const price = spot[instrument.underlying];

  if (!Number.isFinite(price) || price <= 0) {
    throw new BudgetRefused(
      `This contract is paid in ${symbol}, not USDC, so a dollar budget has to be ` +
        `converted at the ${instrument.underlying} spot price — and that price is ` +
        `unavailable right now. Refusing rather than guessing, because guessing here ` +
        `would spend the wrong amount by orders of magnitude.`,
    );
  }

  const inCollateral = usd / price;

  return {
    usd,
    inCollateral,
    spotUsed: price,
    note:
      `Paid in ${symbol}, not USDC. Your ${usd} dollar budget converts to about ` +
      `${inCollateral.toPrecision(3)} ${symbol} at a ${instrument.underlying} price of ` +
      `${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}.`,
  };
}

/**
 * What a collateral-denominated amount is worth in dollars.
 *
 * The inverse of the conversion above, and the reason `MAX_TRADE_USDC` means
 * anything on a non-USDC order. The ceiling is a dollar figure; comparing it
 * against a bare number that might be denominated in bitcoin is how a 25 limit
 * lets through eighty thousand dollars.
 *
 * Returns null when it cannot be known, and the caller must treat that as
 * "refuse", never as "within the limit".
 */
export function usdValueOf(
  amountInCollateral: number,
  instrument: Instrument,
  spot: Record<string, number>,
): number | null {
  if (isUsdcCollateral(instrument)) return amountInCollateral;

  const price = spot[instrument.underlying];
  if (!Number.isFinite(price) || price <= 0) return null;

  return amountInCollateral * price;
}
