/**
 * The shape the browser sees.
 *
 * bigint does not survive JSON, and the raw order must never reach the client,
 * so quotes cross the boundary through this file rather than being spread
 * directly into a response.
 */

import type { Quote, PayoffPoint } from './thetanuts/quote';
import { formatUnits, fromUnits } from './thetanuts/decimals';

export interface WireQuote {
  instrumentId: string;
  label: string;
  underlying: string;
  structure: string;
  isCall: boolean;
  isPhysical: boolean;
  strikes: number[];
  expiry: number;

  collateralSymbol: string;
  collateralDecimals: number;

  /** Exact amounts, as strings. */
  premium: string;
  maxLoss: string;
  maxGain: string | null;
  /** The same amounts formatted for display. */
  premiumDisplay: string;
  maxLossDisplay: string;
  maxGainDisplay: string | null;

  breakeven: number | null;
  numContracts: string;
  spot: number | null;
  payoff: PayoffPoint[];
  greeks: Quote['greeks'];
  partialFill: boolean;
  notes: string[];
}

export function toWire(quote: Quote): WireQuote {
  const decimals = quote.collateralDecimals;
  const money = (value: bigint) => `${formatUnits(value, decimals)} ${quote.collateralSymbol}`;

  return {
    instrumentId: quote.instrumentId,
    label: quote.label,
    underlying: quote.underlying,
    structure: quote.structure,
    isCall: quote.isCall,
    isPhysical: quote.isPhysical,
    strikes: quote.strikes,
    expiry: quote.expiry,
    collateralSymbol: quote.collateralSymbol,
    collateralDecimals: decimals,
    premium: fromUnits(quote.premium, decimals),
    maxLoss: fromUnits(quote.maxLoss, decimals),
    maxGain: quote.maxGain === null ? null : fromUnits(quote.maxGain, decimals),
    premiumDisplay: money(quote.premium),
    maxLossDisplay: money(quote.maxLoss),
    maxGainDisplay: quote.maxGain === null ? null : money(quote.maxGain),
    breakeven: quote.breakeven,
    numContracts: fromUnits(quote.numContracts, decimals),
    spot: quote.spot,
    payoff: quote.payoff,
    greeks: quote.greeks,
    partialFill: quote.partialFill,
    notes: quote.notes,
  };
}

/** What step 02 returns: the agent's reading plus the real numbers. */
export interface InterpretResponse {
  quote: WireQuote;
  reasoning: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  decidedBy: string;
  promptVersion: string;
}

/** What step 03 returns. */
export interface ExecuteResponse {
  live: boolean;
  txHash: string | null;
  explorerUrl: string | null;
  blockNumber: number | null;
  gasUsed: string | null;
  spentDisplay: string;
  strategyId: string;
}
