import 'server-only';

import {
  WINNING_CRITERIA,
  type RankedSignal,
  type SourcedTrade,
  type WinningCriterion,
} from './types';

/**
 * Ranking sourced trades.
 *
 * The user chooses what "winning" means, because there is no single honest
 * definition and pretending otherwise would hide a judgement call inside a
 * number. Each criterion is computed from public data only, and each ranked
 * signal carries a plain-language reason it ranked.
 *
 * Nothing here ranks by raw percentage return. A leaderboard sorted that way
 * rewards whoever took the most risk and got lucky.
 */

/** Notional value of a trade in USD, used for size and for display. */
function notionalUsd(trade: SourcedTrade): number {
  // Deribit quotes option price as a fraction of the underlying, so the premium
  // in USD is price * index * contracts.
  return trade.price * trade.indexPrice * trade.amount;
}

/**
 * Below this, a trade is not a signal.
 *
 * Percentage-based criteria are meaningless on dust. A contract that traded at
 * 0.0001 and is now marked 0.0001 reads as "up 27%" purely from the tick size,
 * and without this floor those rounding artefacts crowd out every real trade.
 * Nobody expressed a view with twelve dollars.
 */
const MIN_NOTIONAL_USD = 250;

/**
 * Score one trade under one criterion. Higher is better.
 *
 * Returns null when the trade cannot be scored under this criterion, which is
 * different from scoring zero: an unscoreable trade is dropped rather than
 * ranked last on missing data.
 */
function score(
  trade: SourcedTrade,
  criterion: WinningCriterion,
  context: { medianIv: number },
): { score: number; why: string } | null {
  switch (criterion) {
    case 'inProfit': {
      // Only a buy can be "in profit" from the buyer's side, and we need a mark.
      if (trade.direction !== 'buy' || trade.markPrice === null || trade.price <= 0) return null;
      if (notionalUsd(trade) < MIN_NOTIONAL_USD) return null;

      const move = (trade.markPrice - trade.price) / trade.price;
      if (move <= 0) return null;

      return {
        score: move,
        why:
          `Bought at ${trade.price.toFixed(4)} and now marked at ` +
          `${trade.markPrice.toFixed(4)}, up ${(move * 100).toFixed(1)}% on a ` +
          `$${Math.round(notionalUsd(trade)).toLocaleString('en-US')} premium.`,
      };
    }

    case 'bigMoney': {
      const usd = notionalUsd(trade);
      if (usd <= 0) return null;

      return {
        score: usd,
        why:
          `A ${usd >= 1000 ? `$${Math.round(usd).toLocaleString('en-US')}` : `$${usd.toFixed(0)}`} ` +
          `premium on ${trade.amount} contracts, which is real capital behind the view.`,
      };
    }

    case 'cheapVolatility': {
      if (trade.iv === null || trade.iv <= 0 || trade.direction !== 'buy') return null;
      if (notionalUsd(trade) < MIN_NOTIONAL_USD) return null;

      // Cheaper than the median of what is trading right now scores higher.
      const relative = (context.medianIv - trade.iv) / context.medianIv;
      if (relative <= 0) return null;

      return {
        score: relative,
        why:
          `Paid ${trade.iv.toFixed(0)}% implied volatility when the median across ` +
          `live flow is ${context.medianIv.toFixed(0)}%, so this was cheap by ` +
          `${(relative * 100).toFixed(0)}%.`,
      };
    }

    case 'crowdFavourite': {
      if (trade.amount <= 0) return null;
      return {
        score: trade.amount,
        why: `${trade.amount} contracts traded, among the heaviest flow on the board.`,
      };
    }
  }
}

/**
 * Rank sourced trades under the chosen definition of winning.
 *
 * @param trades    raw trades from one or more venues
 * @param criterion what the user considers a winning trade
 * @param limit     how many to return
 */
export function rank(
  trades: SourcedTrade[],
  criterion: WinningCriterion,
  limit = 20,
): RankedSignal[] {
  const ivs = trades
    .map((t) => t.iv)
    .filter((iv): iv is number => iv !== null && iv > 0)
    .sort((a, b) => a - b);

  const medianIv = ivs.length > 0 ? ivs[Math.floor(ivs.length / 2)] : 50;
  const context = { medianIv };

  // For crowd favourite the unit is the contract, not the individual trade, so
  // volume is summed per instrument before ranking.
  const source = criterion === 'crowdFavourite' ? aggregateByInstrument(trades) : trades;

  const ranked: RankedSignal[] = [];

  for (const trade of source) {
    const result = score(trade, criterion, context);
    if (!result) continue;

    ranked.push({
      ...trade,
      criterion,
      score: result.score,
      why: result.why,
      notionalUsd: notionalUsd(trade),
    });
  }

  return ranked.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Collapse many trades on one contract into a single row carrying total size. */
function aggregateByInstrument(trades: SourcedTrade[]): SourcedTrade[] {
  const byInstrument = new Map<string, SourcedTrade>();

  for (const trade of trades) {
    const existing = byInstrument.get(trade.venueInstrument);
    if (!existing) {
      byInstrument.set(trade.venueInstrument, { ...trade });
      continue;
    }

    existing.amount += trade.amount;
    // Keep the most recent trade's pricing as the representative one.
    if (trade.timestamp > existing.timestamp) {
      existing.timestamp = trade.timestamp;
      existing.price = trade.price;
      existing.markPrice = trade.markPrice;
      existing.iv = trade.iv;
    }
  }

  return [...byInstrument.values()];
}

/** The criteria, for rendering a chooser. */
export function criteriaList() {
  return (Object.keys(WINNING_CRITERIA) as WinningCriterion[]).map((key) => ({
    key,
    ...WINNING_CRITERIA[key],
  }));
}
