import 'server-only';

import { createHash } from 'node:crypto';

import {
  buildPriceFeedSymbolMap,
  getOptionImplementationInfo,
  type OrderWithSignature,
} from '@thetanuts-finance/thetanuts-client';
import { readClient, CHAIN_ID, chainConfig } from './client';
import { fromChain, fromUnits } from './decimals';

/**
 * Reads of the live OptionBook.
 *
 * Every number here comes from the indexer. Nothing is estimated locally.
 */

const feedSymbols = buildPriceFeedSymbolMap(CHAIN_ID);

/**
 * A stable identity for one resting order.
 *
 * The order's `nonce` looks like an id but is not one. Measured on the live
 * book on 31 Aug 2026, 72 maker-sell orders shared only 13 distinct nonces,
 * and a single nonce covered 18 contracts across different strikes AND
 * expiries. Matching on it would let step 03 fill a different contract from
 * the one the user approved at step 02, with real money.
 *
 * So identity is derived from the fields that define the CONTRACT: who is
 * offering it, what it settles against, its strikes, its expiry and its type.
 *
 * Price and nonce are deliberately excluded. Market makers requote roughly
 * every minute, which changes both. Including them made an id expire within
 * seconds, so a user who read step 02 carefully was told the order had gone.
 * Price movement is handled where it belongs, as a slippage check at step 03,
 * rather than by pretending a requoted contract is a different contract.
 */
function instrumentId(order: OrderWithSignature): string {
  const raw = (order.rawApiData ?? {}) as Record<string, unknown>;
  const parts = [
    order.order.maker,
    raw.implementation,
    order.order.collateralToken,
    raw.priceFeed,
    (order.order.strikes ?? []).join('|'),
    order.order.expiry,
    order.order.optionType,
    raw.isCall,
  ].join(':');

  return createHash('sha256').update(parts).digest('hex').slice(0, 24);
}

/** Collateral token lookup by address, so decimals are read, never assumed. */
const tokensByAddress: Record<string, CollateralToken> = Object.fromEntries(
  Object.values(chainConfig.tokens).map((t) => [
    t.address.toLowerCase(),
    { address: t.address, symbol: t.symbol, decimals: t.decimals },
  ]),
);

/** The token an order is collateralised and paid in. */
export interface CollateralToken {
  address: string;
  symbol: string;
  /**
   * Decimals of this token. Contract counts use the SAME decimals.
   * Puts on Base settle in USDC (6). Calls settle in aBasWETH (18).
   */
  decimals: number;
}

/** One resting order, in the shape the interface uses. */
export interface Instrument {
  /** Stable identity for this order. */
  id: string;
  /** ETH, BTC, SOL and so on, read from the price feed. */
  underlying: string;
  /** PUT, LINEAR_CALL, PHYSICAL_PUT and so on. */
  structure: string;
  /** vanilla, spread, butterfly or condor. */
  shape: string;
  isCall: boolean;
  /** True when the contract delivers the asset rather than cash. */
  isPhysical: boolean;
  /** Strike prices as human numbers. */
  strikes: number[];
  /** Unix seconds. */
  expiry: number;
  /** Hours until expiry, for display. */
  hoursToExpiry: number;
  /**
   * True when the resting maker is buying, which means the user would sell.
   * OptionArena's defined-risk flow needs the opposite: a maker who sells.
   */
  makerIsBuying: boolean;
  /** Price per contract, 8 decimals. */
  pricePerContract: bigint;
  /** The token this order is paid in. Its decimals govern every amount below. */
  collateral: CollateralToken;
  /** Collateral the maker has left, in `collateral.decimals`. */
  availableCollateral: bigint;
  greeks: { delta: number; iv: number; gamma: number; theta: number; vega: number } | null;
  /** The raw order, needed to preview and fill. Not sent to the browser. */
  raw: OrderWithSignature;
}

/** Underlyings OptionArena can actually buy on Base today. */
export const TRADABLE_UNDERLYINGS = ['ETH', 'BTC'] as const;

function toInstrument(order: OrderWithSignature): Instrument | null {
  const raw = order.rawApiData as Record<string, unknown> | undefined;
  if (!raw) return null;

  const feed = String(raw.priceFeed ?? '').toLowerCase();
  const underlying = feedSymbols[feed];
  if (!underlying) return null;

  // An order whose collateral token we cannot identify is an order whose
  // decimals we cannot know. Drop it rather than guess.
  const collateral = tokensByAddress[String(order.order.collateralToken ?? '').toLowerCase()];
  if (!collateral) return null;

  const implementation = String(raw.implementation ?? '');
  const info = getOptionImplementationInfo(CHAIN_ID, implementation);
  const structure = info?.name ?? 'UNKNOWN';
  const strikes = (raw.strikes as string[] | undefined)?.map((s) => Number(s) / 1e8) ?? [];
  const expiry = Number(order.order.expiry);

  return {
    id: instrumentId(order),
    underlying,
    structure,
    shape: (info?.type ?? 'VANILLA').toLowerCase(),
    isCall: Boolean(raw.isCall),
    isPhysical: structure.startsWith('PHYSICAL'),
    strikes,
    expiry,
    hoursToExpiry: (expiry - Date.now() / 1000) / 3600,
    makerIsBuying: Boolean(order.order.isBuyer),
    pricePerContract: BigInt(order.order.price),
    collateral,
    availableCollateral: BigInt(order.availableAmount ?? '0'),
    greeks: (raw.greeks as Instrument['greeks']) ?? null,
    raw: order,
  };
}

/** Fetch and normalise the whole live book. */
export async function fetchBook(): Promise<Instrument[]> {
  const client = readClient();
  const orders = await client.api.fetchOrders();
  return orders
    .map(toInstrument)
    .filter((i): i is Instrument => i !== null)
    .filter((i) => i.expiry * 1000 > Date.now());
}

/**
 * True when an order is paid for in USDC.
 *
 * Measured on the live book on 31 Aug 2026: all 36 buyable puts are
 * collateralised in aBasUSDC, while every buyable call is collateralised in the
 * asset it delivers (aBasWETH for ETH, cbBTC for BTC). That is normal for
 * physically settled options, and it decides what a budget can mean.
 */
export function isUsdcCollateral(instrument: Instrument): boolean {
  return instrument.collateral.symbol.includes('USDC');
}

/**
 * Orders the user can BUY.
 *
 * A buyer's maximum loss is the premium paid, which is the defined-risk promise
 * OptionArena makes. Buying needs a maker who is selling. Confirmed against the
 * live book on 31 Aug 2026: only ETH and BTC have any resting maker sells.
 *
 * `usdcOnly` defaults to true, and that default is a safety decision, not a
 * preference. OptionArena asks for a budget in USDC, so it must only offer
 * contracts where that budget is literally true. A call is paid for in cbBTC or
 * aBasWETH, so a budget of 5 against a BTC call would mean 5 cbBTC, which is
 * roughly four hundred thousand dollars rather than five. Until the budget is
 * converted through a spot price, the USDC side of the book is the only side
 * where the number the user types is the number they spend.
 */
export async function fetchBuyable(
  underlying?: string,
  options: { usdcOnly?: boolean } = {},
): Promise<Instrument[]> {
  const { usdcOnly = true } = options;
  const book = await fetchBook();

  const candidates = book
    .filter((i) => !i.makerIsBuying)
    .filter((i) => i.availableCollateral > 0n)
    .filter((i) => (usdcOnly ? isUsdcCollateral(i) : true))
    .filter((i) => (underlying ? i.underlying === underlying : true));

  // A maker can rest more than one order on the same contract. Identity names
  // the contract, so keep the cheapest, which is the best price for a buyer.
  const best = new Map<string, Instrument>();
  for (const instrument of candidates) {
    const existing = best.get(instrument.id);
    if (!existing || instrument.pricePerContract < existing.pricePerContract) {
      best.set(instrument.id, instrument);
    }
  }

  return [...best.values()].sort((a, b) => a.expiry - b.expiry || a.strikes[0] - b.strikes[0]);
}

/** A compact summary of what the book currently offers. */
export interface MarketPulse {
  totalOrders: number;
  buyableOrders: number;
  /** Of the buyable orders, how many are paid for in USDC. */
  usdcBuyable: number;
  byUnderlying: { underlying: string; buyable: number; total: number }[];
  nextExpiry: number | null;
  indexerLagBlocks: number | null;
  fetchedAt: number;
}

export async function fetchPulse(): Promise<MarketPulse> {
  const client = readClient();

  const [book, health] = await Promise.all([fetchBook(), client.api.getHealth().catch(() => null)]);

  const buyable = book.filter((i) => !i.makerIsBuying && i.availableCollateral > 0n);
  const underlyings = [...new Set(book.map((i) => i.underlying))];

  return {
    totalOrders: book.length,
    buyableOrders: buyable.length,
    usdcBuyable: buyable.filter(isUsdcCollateral).length,
    byUnderlying: underlyings
      .map((u) => ({
        underlying: u,
        buyable: buyable.filter((i) => i.underlying === u).length,
        total: book.filter((i) => i.underlying === u).length,
      }))
      .sort((a, b) => b.total - a.total),
    nextExpiry: book.length ? Math.min(...book.map((i) => i.expiry)) : null,
    indexerLagBlocks: health && typeof health.lagBlocks === 'number' ? health.lagBlocks : null,
    fetchedAt: Date.now(),
  };
}

/** Live spot prices, used to centre the payoff diagram. */
export async function fetchSpot(): Promise<Record<string, number>> {
  const client = readClient();
  try {
    const prices = await client.api.getMarketPrices();
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(prices as Record<string, unknown>)) {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) out[key.toUpperCase().replace('/USD', '')] = n;
    }
    return out;
  } catch {
    return {};
  }
}

/** Human label for an instrument, used in the interface and the feed. */
export function describeInstrument(i: Instrument): string {
  const date = new Date(i.expiry * 1000).toISOString().slice(0, 10);
  const strikes = i.strikes.map((s) => s.toLocaleString('en-US')).join(' / ');
  return `${i.underlying} ${strikes} ${i.isCall ? 'Call' : 'Put'} ${i.structure.includes('SPREAD') ? 'Spread ' : ''}${date}`;
}

/** Price per contract as a human string, for logs and tests. */
export function priceLabel(i: Instrument): string {
  return `${fromChain(i.pricePerContract, 'price')} per contract`;
}

/** Size the maker has left, in that order's own collateral token. */
export function availableLabel(i: Instrument): string {
  return `${fromUnits(i.availableCollateral, i.collateral.decimals)} ${i.collateral.symbol}`;
}
