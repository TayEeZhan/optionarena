import { z } from 'zod';

/**
 * What counts as a "winning" trade.
 *
 * There is no single honest answer, so the user picks. Each criterion below is
 * computable from Deribit's PUBLIC data, which matters: public trades carry no
 * trader identity, so "follow this profitable trader" is not derivable at all.
 * Claiming otherwise would be inventing a track record we cannot see.
 *
 * What we can see is the trade itself: what was paid, how large it was, what
 * volatility was paid, and what the same contract is worth now.
 */
export const WINNING_CRITERIA = {
  inProfit: {
    label: 'In profit now',
    hint: 'Bought below what the contract is worth today',
    explain:
      'Compares the price paid against the current mark price. A trade ranks ' +
      'higher the further it has moved in the buyer’s favour since it was placed.',
  },
  bigMoney: {
    label: 'Big money',
    hint: 'Large trades, where someone had real conviction',
    explain:
      'Ranks by notional size. Size is not skill, but a large trade is someone ' +
      'putting real capital behind a view rather than testing the water.',
  },
  cheapVolatility: {
    label: 'Cheap volatility',
    hint: 'Bought when the option was priced unusually low',
    explain:
      'Ranks by implied volatility paid, lowest first, against the same ' +
      'contract’s recent range. Buying cheap volatility is the classic edge.',
  },
  crowdFavourite: {
    label: 'Crowd favourite',
    hint: 'The contracts attracting the most flow',
    explain:
      'Ranks by how much volume a contract has traded. It follows where the ' +
      'market is actually looking, not where any one trader is.',
  },
} as const;

export type WinningCriterion = keyof typeof WINNING_CRITERIA;

export const WinningCriterion = z.enum(
  Object.keys(WINNING_CRITERIA) as [WinningCriterion, ...WinningCriterion[]],
);

/** One trade observed on an external venue. */
export interface SourcedTrade {
  /** Stable id, derived from the venue's own trade identifier. */
  id: string;
  venue: 'deribit';
  /** The venue's instrument name, kept verbatim so it is always traceable. */
  venueInstrument: string;

  underlying: string;
  isCall: boolean;
  strike: number;
  /** Unix seconds. */
  expiry: number;

  /** Unix milliseconds. */
  timestamp: number;
  direction: 'buy' | 'sell';
  /** Price paid, in the venue's own convention (a fraction of the underlying). */
  price: number;
  /** Size, in contracts. */
  amount: number;
  /** Implied volatility paid, as a percentage. */
  iv: number | null;
  /** Spot at the time of the trade. */
  indexPrice: number;
  /** What the contract is marked at now. */
  markPrice: number | null;
}

/** A sourced trade after ranking, ready to show and to copy. */
export interface RankedSignal extends SourcedTrade {
  /** Which criterion produced this score. */
  criterion: WinningCriterion;
  /** Higher is better. Comparable only within one criterion. */
  score: number;
  /** Plain-language reason this trade ranked, shown to the user. */
  why: string;
  /** Notional in USD, for display. */
  notionalUsd: number;
}
