import 'server-only';

import { mapSignals, type MappedSignal } from './map';
import { rank } from './rank';
import { fetchRecentTrades } from './sources/deribit';
import type { RankedSignal, WinningCriterion } from './types';

export interface BoardSnapshot {
  signals: RankedSignal[];
  mapped: MappedSignal[];
  live: boolean;
  mappingLive: boolean;
  message: string | null;
}

const SAMPLE: RankedSignal[] = [
  {
    id: 'preview:eth-3000-put',
    venue: 'deribit',
    venueInstrument: 'ETH-4SEP26-3000-P',
    underlying: 'ETH',
    isCall: false,
    strike: 3000,
    expiry: Date.UTC(2026, 8, 4, 8) / 1000,
    timestamp: Date.UTC(2026, 8, 2, 8),
    direction: 'buy',
    price: 0.042,
    amount: 10,
    iv: 48.2,
    indexPrice: 2980,
    markPrice: 0.0497,
    criterion: 'inProfit',
    score: 0.184,
    why: 'Up 18.4% from entry on a $1,250 premium.',
    notionalUsd: 1250,
  },
  {
    id: 'preview:btc-64000-put',
    venue: 'deribit',
    venueInstrument: 'BTC-4SEP26-64000-P',
    underlying: 'BTC',
    isCall: false,
    strike: 64000,
    expiry: Date.UTC(2026, 8, 4, 8) / 1000,
    timestamp: Date.UTC(2026, 8, 2, 8),
    direction: 'buy',
    price: 0.018,
    amount: 1.2,
    iv: 51.4,
    indexPrice: 64400,
    markPrice: 0.0206,
    criterion: 'inProfit',
    score: 0.142,
    why: 'Up 14.2% from entry on a $1,391 premium.',
    notionalUsd: 1391,
  },
  {
    id: 'preview:eth-2850-put',
    venue: 'deribit',
    venueInstrument: 'ETH-11SEP26-2850-P',
    underlying: 'ETH',
    isCall: false,
    strike: 2850,
    expiry: Date.UTC(2026, 8, 11, 8) / 1000,
    timestamp: Date.UTC(2026, 8, 2, 8),
    direction: 'buy',
    price: 0.031,
    amount: 8,
    iv: 44.8,
    indexPrice: 2980,
    markPrice: 0.0347,
    criterion: 'inProfit',
    score: 0.118,
    why: 'Up 11.8% from entry on a $739 premium.',
    notionalUsd: 739,
  },
  {
    id: 'preview:btc-62000-put',
    venue: 'deribit',
    venueInstrument: 'BTC-11SEP26-62000-P',
    underlying: 'BTC',
    isCall: false,
    strike: 62000,
    expiry: Date.UTC(2026, 8, 11, 8) / 1000,
    timestamp: Date.UTC(2026, 8, 2, 8),
    direction: 'buy',
    price: 0.015,
    amount: 0.9,
    iv: 49.6,
    indexPrice: 64400,
    markPrice: 0.0164,
    criterion: 'inProfit',
    score: 0.096,
    why: 'Up 9.6% from entry on an $869 premium.',
    notionalUsd: 869,
  },
];

function previewFor(criterion: WinningCriterion, limit: number): RankedSignal[] {
  return SAMPLE.slice(0, limit).map((signal, index) => {
    switch (criterion) {
      case 'bigMoney':
        return {
          ...signal,
          criterion,
          score: signal.notionalUsd,
          why: `$${Math.round(signal.notionalUsd).toLocaleString('en-US')} of premium behind this view.`,
        };
      case 'cheapVolatility':
        return {
          ...signal,
          criterion,
          score: 0.16 - index * 0.025,
          why: `Implied volatility was below the current flow median.`,
        };
      case 'crowdFavourite':
        return {
          ...signal,
          criterion,
          score: signal.amount,
          why: `${signal.amount} contracts traded in this preview window.`,
        };
      case 'inProfit':
        return { ...signal, criterion };
    }
  });
}

export async function getBoardSnapshot(
  criterion: WinningCriterion = 'inProfit',
  limit = 4,
): Promise<BoardSnapshot> {
  let signals: RankedSignal[];
  let live = true;
  let message: string | null = null;

  try {
    const [eth, btc] = await Promise.all([
      fetchRecentTrades('ETH', 300),
      fetchRecentTrades('BTC', 300),
    ]);
    signals = rank([...eth, ...btc], criterion, limit);

    if (signals.length === 0) {
      live = false;
      message = 'No live trades qualify for this ranking right now, so preview data is shown.';
      signals = previewFor(criterion, limit);
    }
  } catch (error) {
    live = false;
    message = `Live Deribit rankings are unavailable. Preview data is shown instead: ${
      error instanceof Error ? error.message : 'unknown market-data error'
    }`;
    signals = previewFor(criterion, limit);
  }

  try {
    const mapped = await mapSignals(signals);
    return { signals, mapped, live, mappingLive: true, message };
  } catch (error) {
    const mappingMessage = `Thetanuts mapping is unavailable: ${
      error instanceof Error ? error.message : 'unknown book error'
    }`;
    const mapped: MappedSignal[] = signals.map((signal) => ({
      signal,
      instrument: null,
      exact: false,
      differences: [],
      unavailable: mappingMessage,
    }));

    return {
      signals,
      mapped,
      live,
      mappingLive: false,
      message: message ? `${message} ${mappingMessage}` : mappingMessage,
    };
  }
}

/**
 * Two signals for a head-to-head comparison.
 *
 * The pair must be different CONTRACTS. `rank()` scores individual trades, and
 * several trades on one instrument routinely take the top slots: measured on
 * 4 Sep 2026, the three best-scoring signals were all BTC-7SEP26-84000-C at
 * 9.2%. Taking the first two rendered "BTC 84,000 call VS BTC 84,000 call",
 * a comparison of a thing with itself.
 *
 * Returns null when the board has no second distinct contract, so the caller
 * shows an empty state rather than a fake matchup.
 */
export function pickMatchup(signals: RankedSignal[]): [RankedSignal, RankedSignal] | null {
  const left = signals[0];
  if (!left) return null;

  const right = signals.find((signal) => signal.venueInstrument !== left.venueInstrument);
  return right ? [left, right] : null;
}
