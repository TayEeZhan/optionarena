import 'server-only';

import type { ExecutedStrategy } from '../agent/schema';
import { fetchDeliveryPrice } from '../signals/sources/deribit';
import { getSocialStore, type Battle } from './store';

/**
 * Deciding a friendly battle.
 *
 * Two things are kept strictly apart here, because collapsing them is how a
 * product ends up lying about performance.
 *
 * **Before expiry** there is no result. OptionArena has no spot-price feed and
 * physically settled contracts return nothing useful from the SDK's payout
 * helpers, so any mid-life "who is winning" number would be invented. The
 * interface compares what each side risked and what each pays if right, which
 * is a comparison of conviction, and it says so.
 *
 * **After expiry** there is a real answer, taken from the settlement price
 * Deribit published for that date — the number the option actually paid out
 * against. Nothing here is self-reported.
 */

/** How many contracts a premium bought, derived from the breakeven distance. */
function contractsFrom(strategy: ExecutedStrategy): number | null {
  const strike = strategy.strikes[0];
  const premium = Number(strategy.premium);
  if (!strike || !Number.isFinite(premium) || strategy.breakeven === null) return null;

  // A long put breaks even at strike - premium/contracts, a long call at
  // strike + premium/contracts. Either way the gap gives the size back.
  const gap = Math.abs(strike - strategy.breakeven);
  return gap > 0 ? premium / gap : null;
}

/**
 * What a strategy was worth at settlement, in its own collateral units.
 *
 * Positive is profit after the premium paid. Returns null when the shape is not
 * one we can price, rather than guessing at a number.
 */
export function settlementPnl(strategy: ExecutedStrategy, settlement: number): number | null {
  const strike = strategy.strikes[0];
  const premium = Number(strategy.premium);
  const contracts = contractsFrom(strategy);
  if (!strike || contracts === null || !Number.isFinite(premium)) return null;

  const isCall = strategy.structure.toUpperCase().includes('CALL');
  const intrinsic = isCall ? Math.max(0, settlement - strike) : Math.max(0, strike - settlement);

  return intrinsic * contracts - premium;
}

export interface BattleOutcome {
  battle: Battle;
  /** Profit or loss per side, once settled. Null while still running. */
  pnl: { challenger: number | null; opponent: number | null } | null;
  /** Why it cannot be settled, when it cannot. */
  note: string | null;
}

/**
 * Resolve a battle if it is ready, and remember the answer.
 *
 * Lazy, because there is no scheduler: the first person to open the battle
 * after expiry is the one who settles it. The result is written back so it is
 * computed once and stays stable afterwards.
 */
export async function resolveIfDue(
  battle: Battle,
  challengerStrategy: ExecutedStrategy | null,
  opponentStrategy: ExecutedStrategy | null,
): Promise<BattleOutcome> {
  if (battle.winner) {
    const settled = battle.settlement ?? {};
    return {
      battle,
      pnl: {
        challenger: challengerStrategy
          ? settlementPnl(challengerStrategy, settled[challengerStrategy.underlying] ?? 0)
          : null,
        opponent: opponentStrategy
          ? settlementPnl(opponentStrategy, settled[opponentStrategy.underlying] ?? 0)
          : null,
      },
      note: null,
    };
  }

  const now = Math.floor(Date.now() / 1000);
  if (now < battle.resolvesAt) return { battle, pnl: null, note: null };

  if (!challengerStrategy || !opponentStrategy) {
    return { battle, pnl: null, note: 'One of the strategies is no longer on record.' };
  }

  const sides = [
    { underlying: challengerStrategy.underlying, expiry: challengerStrategy.expiry },
    { underlying: opponentStrategy.underlying, expiry: opponentStrategy.expiry },
  ];

  let settlement: Record<string, number>;
  try {
    const prices = await Promise.all(
      sides.map(
        async (side) =>
          [
            side.underlying,
            await fetchDeliveryPrice(side.underlying as 'ETH' | 'BTC', side.expiry),
          ] as const,
      ),
    );

    if (prices.some(([, price]) => price === null)) {
      return {
        battle,
        pnl: null,
        note: 'Deribit has not published a settlement price for that date yet.',
      };
    }

    settlement = Object.fromEntries(prices as [string, number][]);
  } catch {
    // A venue outage must not invent a winner. Leave it unresolved and say so.
    return { battle, pnl: null, note: 'The settlement price could not be read just now.' };
  }

  const challengerPnl = settlementPnl(
    challengerStrategy,
    settlement[challengerStrategy.underlying],
  );
  const opponentPnl = settlementPnl(opponentStrategy, settlement[opponentStrategy.underlying]);

  if (challengerPnl === null || opponentPnl === null) {
    return { battle, pnl: null, note: 'One of these contracts cannot be priced at settlement.' };
  }

  const winner =
    challengerPnl === opponentPnl
      ? 'draw'
      : challengerPnl > opponentPnl
        ? battle.challenger
        : battle.opponent;

  const resolved: Battle = { ...battle, winner, resolvedAt: Date.now(), settlement };
  await getSocialStore().saveBattle(resolved);

  return {
    battle: resolved,
    pnl: { challenger: challengerPnl, opponent: opponentPnl },
    note: null,
  };
}
