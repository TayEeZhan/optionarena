import 'server-only';

import { readClient } from './client';
import { assertMagnitude, fromUnits, toUnits, formatUnits } from './decimals';
import { describeInstrument, type Instrument } from './book';

/**
 * Pricing a strategy against the live book.
 *
 * Nothing here signs anything. Every number is derived from a resting order and
 * the SDK's own preview, so the maximum loss shown at step 02 is the number the
 * user would really pay.
 *
 * One deliberate exception, measured on 31 Aug 2026: the SDK's payout helpers
 * (`calculateMaxPayout`, `calculatePayoutAtPrice`) return zero for the
 * physically settled implementations, and every buyable order on Base today is
 * physically settled. So the payoff curve below is computed here, from the
 * strike and the contract count, and is labelled as value at expiry. The
 * maximum loss still comes straight from the SDK preview.
 */

export interface PayoffPoint {
  /** Settlement price of the underlying. */
  price: number;
  /** Profit or loss in collateral units at that settlement price. */
  pnl: number;
}

export interface Quote {
  instrumentId: string;
  label: string;
  underlying: string;
  structure: string;
  isCall: boolean;
  isPhysical: boolean;
  strikes: number[];
  expiry: number;

  /** The token the user pays in, and whose decimals govern every amount. */
  collateralSymbol: string;
  collateralDecimals: number;

  /** What the user spends. For a long position this is the maximum loss. */
  premium: bigint;
  /** The most the user can lose. Real, from the SDK preview. */
  maxLoss: bigint;
  /** The most the user can make. Null when unbounded, as for a long call. */
  maxGain: bigint | null;
  /** Underlying price at which the position breaks even. */
  breakeven: number | null;

  /** Contract count, in the collateral token's decimals. */
  numContracts: bigint;
  pricePerContract: bigint;
  spot: number | null;
  payoff: PayoffPoint[];
  greeks: Instrument['greeks'];

  /** True when the budget could not be spent in full. */
  partialFill: boolean;
  /** Plain-language notes the user must see before executing. */
  notes: string[];
}

/**
 * Price one instrument for a budget.
 *
 * @param instrument the resting order to buy
 * @param budget     how much to spend, denominated in the ORDER's collateral
 *                   token, not assumed to be USDC
 * @param spot       live underlying price, used to centre the payoff diagram
 */
export function quoteInstrument(
  instrument: Instrument,
  budget: number,
  spot: number | null,
): Quote {
  const client = readClient();
  const notes: string[] = [];
  const { decimals, symbol } = instrument.collateral;

  const requested = toUnits(budget, decimals);

  // Prove the budget is the magnitude the user asked for, against THIS order's
  // collateral token. Checking against a hardcoded 6 is what sends 2e-12 WETH.
  assertMagnitude(requested, budget, decimals, `Budget in ${symbol}`);

  // Never ask for more than the maker has left.
  const spend =
    requested > instrument.availableCollateral ? instrument.availableCollateral : requested;
  const partialFill = spend < requested;
  if (partialFill) {
    notes.push(
      `The maker has ${fromUnits(instrument.availableCollateral, decimals)} ${symbol} of size ` +
        `left, less than the ${budget} ${symbol} budget. The trade fills at the smaller size.`,
    );
  }

  const preview = client.optionBook.previewFillOrder(instrument.raw, spend);

  // The SDK returns the collateral the fill really consumes. For a long
  // position that is the premium, and the premium is the maximum loss.
  const premium = preview.totalCollateral;

  const payoff = buildPayoff(instrument, preview.numContracts, premium, spot);
  const breakeven = findBreakeven(payoff);
  const maxGain = computeMaxGain(instrument, preview.numContracts, premium);

  if (instrument.hoursToExpiry < 2) {
    notes.push(
      `This contract expires in about ${instrument.hoursToExpiry.toFixed(1)} hours. ` +
        `Short-dated options move fast and can expire worthless.`,
    );
  }

  if (instrument.isPhysical) {
    notes.push(
      `This is a physically settled contract. At expiry it delivers ${instrument.underlying} ` +
        `rather than paying cash. The payoff below is the value at expiry.`,
    );
  }

  if (!symbol.includes('USDC')) {
    notes.push(
      `This contract is paid and collateralised in ${symbol}, not USDC. ` +
        `The budget and the maximum loss above are both in ${symbol}.`,
    );
  }

  return {
    instrumentId: instrument.id,
    label: describeInstrument(instrument),
    underlying: instrument.underlying,
    structure: instrument.structure,
    isCall: instrument.isCall,
    isPhysical: instrument.isPhysical,
    strikes: instrument.strikes,
    expiry: instrument.expiry,
    collateralSymbol: symbol,
    collateralDecimals: decimals,
    premium,
    maxLoss: premium,
    maxGain,
    breakeven,
    numContracts: preview.numContracts,
    pricePerContract: preview.pricePerContract,
    spot,
    payoff,
    greeks: instrument.greeks,
    partialFill,
    notes,
  };
}

/**
 * Value of one long vanilla contract at a settlement price.
 *
 * Returned in collateral units. Contract counts share the collateral token's
 * decimals, and strikes and prices are both 8 decimals, so:
 *
 *   payout = (moneyness at 8dp) * contracts / 1e8
 */
function payoutAtPrice(
  instrument: Instrument,
  numContracts: bigint,
  settlementPrice: number,
): bigint {
  const strike = instrument.strikes[0];
  if (!Number.isFinite(strike)) return 0n;

  const moneyness = instrument.isCall ? settlementPrice - strike : strike - settlementPrice;
  if (moneyness <= 0) return 0n;

  const moneynessUnits = BigInt(Math.round(moneyness * 1e8));
  return (moneynessUnits * numContracts) / 100_000_000n;
}

/** Sample the payoff across a price range centred on spot. */
function buildPayoff(
  instrument: Instrument,
  numContracts: bigint,
  premium: bigint,
  spot: number | null,
): PayoffPoint[] {
  const centre = spot ?? instrument.strikes[0];
  if (!centre || !Number.isFinite(centre)) return [];

  const decimals = instrument.collateral.decimals;
  const low = centre * 0.7;
  const high = centre * 1.3;
  const steps = 60;
  const points: PayoffPoint[] = [];

  for (let i = 0; i <= steps; i++) {
    const price = low + ((high - low) * i) / steps;
    const payout = payoutAtPrice(instrument, numContracts, price);
    points.push({ price, pnl: Number(fromUnits(payout - premium, decimals)) });
  }

  return points;
}

/**
 * The most the position can make.
 *
 * A long call is unbounded, so this returns null. A long put is capped: the
 * underlying can only fall to zero, so the best case is the full strike.
 */
function computeMaxGain(
  instrument: Instrument,
  numContracts: bigint,
  premium: bigint,
): bigint | null {
  if (instrument.isCall) return null;
  const best = payoutAtPrice(instrument, numContracts, 0);
  const gain = best - premium;
  return gain > 0n ? gain : 0n;
}

/** The settlement price where profit and loss cross zero. */
function findBreakeven(payoff: PayoffPoint[]): number | null {
  for (let i = 1; i < payoff.length; i++) {
    const previous = payoff[i - 1];
    const current = payoff[i];
    if (previous.pnl === 0) return previous.price;
    if (previous.pnl < 0 !== current.pnl < 0) {
      const span = current.pnl - previous.pnl;
      if (span === 0) return current.price;
      return previous.price + (-previous.pnl / span) * (current.price - previous.price);
    }
  }
  return null;
}

/** Format an amount in this quote's collateral token. */
export function quoteAmount(quote: Quote, value: bigint, places = 2): string {
  return `${formatUnits(value, quote.collateralDecimals, places)} ${quote.collateralSymbol}`;
}
