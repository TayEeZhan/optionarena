import 'server-only';

import type { CallSide } from '../db/schema';
import { fetchDeliveryPrice } from '../signals/sources/deribit';
import { getSocialStore, type Call } from './store';

/**
 * Deciding a call on an arena matchup.
 *
 * Written to the same rules as `battles.ts`, deliberately, so this product has
 * one way of deciding an outcome rather than two.
 *
 * **Before expiry** there is no result and none is shown. A running score would
 * need a mid-life valuation we cannot get, and inventing one is the failure this
 * whole build keeps refusing.
 *
 * **After expiry** the better side is computed from the settlement price Deribit
 * published — the number those options actually paid out against.
 *
 * A call stakes nothing. It is a forecast with a record, not a wager.
 */

/**
 * What one side returned, as a multiple of what was paid.
 *
 * Deribit quotes an option as a fraction of the underlying, so the payoff per
 * contract is also a fraction: `max(0, K - S) / S` for a put. Return is that
 * payoff against the price paid. `-1` means the option expired worthless and the
 * whole premium was lost, which is a real answer rather than a missing one.
 */
export function sideReturn(side: CallSide, settlement: number): number | null {
  if (!(settlement > 0) || !(side.price > 0)) return null;

  const intrinsic = side.isCall
    ? Math.max(0, settlement - side.strike)
    : Math.max(0, side.strike - settlement);

  const payoff = intrinsic / settlement;
  return (payoff - side.price) / side.price;
}

export interface CallOutcome {
  call: Call;
  /** Return per side, once settled. Null while the call is still open. */
  returns: { left: number | null; right: number | null } | null;
  /** Whether the person who made this call got it right. Null on a draw. */
  correct: boolean | null;
  /** Why it cannot be settled, when it cannot. */
  note: string | null;
}

/**
 * Resolve a call if it is ready, and remember the answer.
 *
 * Lazy, because there is no scheduler: whoever opens the page first after expiry
 * settles it, and the result is written back so it stays stable.
 */
export async function resolveCallIfDue(call: Call): Promise<CallOutcome> {
  const decided = (resolved: Call, returns: CallOutcome['returns']): CallOutcome => ({
    call: resolved,
    returns,
    correct: resolved.winner === 'draw' ? null : resolved.winner === resolved.picked,
    note: null,
  });

  if (call.winner) {
    const settled = call.settlement ?? {};
    return decided(call, {
      left: sideReturn(call.left, settled[call.left.underlying] ?? 0),
      right: sideReturn(call.right, settled[call.right.underlying] ?? 0),
    });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now < call.resolvesAt) return { call, returns: null, correct: null, note: null };

  let settlement: Record<string, number>;
  try {
    const prices = await Promise.all(
      [call.left, call.right].map(
        async (side) =>
          [
            side.underlying,
            await fetchDeliveryPrice(side.underlying as 'ETH' | 'BTC', side.expiry),
          ] as const,
      ),
    );

    if (prices.some(([, price]) => price === null)) {
      return {
        call,
        returns: null,
        correct: null,
        note: 'Deribit has not published a settlement price for that date yet.',
      };
    }

    settlement = Object.fromEntries(prices as [string, number][]);
  } catch {
    // A venue outage must not invent a winner. Leave it open and say so.
    return {
      call,
      returns: null,
      correct: null,
      note: 'The settlement price could not be read just now.',
    };
  }

  const left = sideReturn(call.left, settlement[call.left.underlying]);
  const right = sideReturn(call.right, settlement[call.right.underlying]);

  if (left === null || right === null) {
    return { call, returns: null, correct: null, note: 'One side cannot be priced at settlement.' };
  }

  const winner = left === right ? 'draw' : left > right ? 'left' : 'right';
  const resolved: Call = { ...call, winner, resolvedAt: Date.now(), settlement };
  await getSocialStore().saveCall(resolved);

  return decided(resolved, { left, right });
}

/** How this person's calls have gone, counting settled ones only. */
export function callRecord(calls: Call[]): { right: number; wrong: number; open: number } {
  let right = 0;
  let wrong = 0;
  let open = 0;

  for (const call of calls) {
    if (!call.winner) open += 1;
    else if (call.winner === 'draw') continue;
    else if (call.winner === call.picked) right += 1;
    else wrong += 1;
  }

  return { right, wrong, open };
}
