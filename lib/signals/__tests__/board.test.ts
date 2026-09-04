import { describe, it, expect } from 'vitest';
import { pickMatchup } from '../board';
import type { RankedSignal } from '../types';

/** A ranked signal carrying the fields pickMatchup reads. */
function signal(venueInstrument: string, score: number): RankedSignal {
  return {
    id: `test:${venueInstrument}:${score}`,
    venue: 'deribit',
    venueInstrument,
    underlying: venueInstrument.split('-')[0],
    isCall: venueInstrument.endsWith('-C'),
    strike: 84000,
    expiry: 1_790_000_000,
    timestamp: Date.now(),
    direction: 'buy',
    price: 0.01,
    amount: 1,
    iv: 50,
    indexPrice: 84000,
    markPrice: 0.011,
    criterion: 'inProfit',
    score,
    why: 'test',
    notionalUsd: 840,
  };
}

describe('pickMatchup', () => {
  it('picks the two best signals when they are different contracts', () => {
    const pair = pickMatchup([
      signal('BTC-7SEP26-84000-C', 0.092),
      signal('BTC-5SEP26-78500-P', 0.077),
    ]);

    expect(pair?.[0].venueInstrument).toBe('BTC-7SEP26-84000-C');
    expect(pair?.[1].venueInstrument).toBe('BTC-5SEP26-78500-P');
  });

  it('skips repeats of the same contract', () => {
    // The real case, measured 4 Sep 2026: the three best-scoring signals were
    // all BTC-7SEP26-84000-C, so the arena showed a contract facing itself.
    const pair = pickMatchup([
      signal('BTC-7SEP26-84000-C', 0.092),
      signal('BTC-7SEP26-84000-C', 0.092),
      signal('BTC-7SEP26-84000-C', 0.092),
      signal('BTC-5SEP26-78500-P', 0.077),
    ]);

    expect(pair?.[0].venueInstrument).toBe('BTC-7SEP26-84000-C');
    expect(pair?.[1].venueInstrument).toBe('BTC-5SEP26-78500-P');
  });

  it('returns null rather than a fake matchup when only one contract is on the board', () => {
    const pair = pickMatchup([
      signal('BTC-7SEP26-84000-C', 0.092),
      signal('BTC-7SEP26-84000-C', 0.088),
    ]);

    expect(pair).toBeNull();
  });

  it('returns null on an empty board', () => {
    expect(pickMatchup([])).toBeNull();
  });
});
