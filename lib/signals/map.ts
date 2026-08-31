import 'server-only';

import { fetchBuyable, type Instrument } from '../thetanuts/book';
import type { RankedSignal } from './types';

/**
 * Mapping an external trade onto something Thetanuts can actually fill.
 *
 * The brief calls this the part most likely to break, and the rule is absolute:
 * never silently substitute. If the strike, the expiry or the direction differs
 * from the sourced trade, the user is told before they can copy it.
 *
 * Measured on 31 Aug 2026 against the live book: all 39 buyable Thetanuts puts
 * had an EXACT strike-and-expiry match on Deribit, for both ETH and BTC. That
 * is not luck. The market makers quoting Base hedge on Deribit, so they quote
 * the same grid. The mapper still reports differences, because a grid that
 * lines up today can stop lining up tomorrow.
 */

export interface MappedSignal {
  signal: RankedSignal;
  /** The Thetanuts contract that best matches, or null if nothing does. */
  instrument: Instrument | null;
  /** True only when strike, expiry and direction all match exactly. */
  exact: boolean;
  /**
   * Every way the Thetanuts contract differs from the sourced trade, in plain
   * language. Empty when the match is exact. Shown before any copy.
   */
  differences: string[];
  /** Why nothing could be mapped, when instrument is null. */
  unavailable: string | null;
}

/** Same calendar day, which is how both venues line expiries up. */
function sameDay(a: number, b: number): boolean {
  const day = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);
  return day(a) === day(b);
}

/**
 * Map ranked signals onto the live Thetanuts book.
 *
 * @param signals ranked external trades
 */
export async function mapSignals(signals: RankedSignal[]): Promise<MappedSignal[]> {
  const book = await fetchBuyable();
  return signals.map((signal) => mapOne(signal, book));
}

export function mapOne(signal: RankedSignal, book: Instrument[]): MappedSignal {
  const differences: string[] = [];

  // OptionArena buys the USDC side, which today is puts only. A sourced call
  // has no equivalent here, and saying so is better than offering a put.
  if (signal.isCall) {
    return {
      signal,
      instrument: null,
      exact: false,
      differences: [],
      unavailable:
        `This is a call. Calls on Base are collateralised in the asset they ` +
        `deliver, so OptionArena cannot price one against a USDC budget yet.`,
    };
  }

  const candidates = book.filter((i) => i.underlying === signal.underlying && !i.isCall);

  if (candidates.length === 0) {
    return {
      signal,
      instrument: null,
      exact: false,
      differences: [],
      unavailable: `Thetanuts has no ${signal.underlying} puts to buy right now.`,
    };
  }

  // Prefer the same expiry. Only then look at strike.
  const sameExpiry = candidates.filter((i) => sameDay(i.expiry, signal.expiry));
  const pool = sameExpiry.length > 0 ? sameExpiry : candidates;

  const instrument = pool.reduce((best, i) =>
    Math.abs(i.strikes[0] - signal.strike) < Math.abs(best.strikes[0] - signal.strike) ? i : best,
  );

  if (sameExpiry.length === 0) {
    const theirs = new Date(signal.expiry * 1000).toISOString().slice(0, 10);
    const ours = new Date(instrument.expiry * 1000).toISOString().slice(0, 10);
    differences.push(
      `Different expiry. The Deribit trade expires ${theirs}; the closest Thetanuts ` +
        `contract expires ${ours}.`,
    );
  }

  const ourStrike = instrument.strikes[0];
  if (ourStrike !== signal.strike) {
    const drift = ((ourStrike - signal.strike) / signal.strike) * 100;
    differences.push(
      `Different strike. The Deribit trade is at ${signal.strike.toLocaleString('en-US')}; ` +
        `the closest Thetanuts contract is ${ourStrike.toLocaleString('en-US')}, ` +
        `${Math.abs(drift).toFixed(1)}% ${drift > 0 ? 'higher' : 'lower'}.`,
    );
  }

  if (signal.direction === 'sell') {
    differences.push(
      `The Deribit trade was a sell. OptionArena buys, so copying this takes the ` +
        `other side of it.`,
    );
  }

  return {
    signal,
    instrument,
    exact: differences.length === 0,
    differences,
    unavailable: null,
  };
}
