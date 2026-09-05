import 'server-only';

import type { SourcedTrade } from '../types';

/**
 * Deribit as a signal source.
 *
 * Deribit is where the deep options flow actually is, and its market data API
 * is public and needs no key. That is the whole reason this venue is first.
 *
 * One honest limit, which shapes everything downstream: public trades carry no
 * trader identity. We can see the trade, never who made it. So OptionArena
 * ranks TRADES, never traders, and never claims a track record it cannot see.
 */

const API = 'https://www.deribit.com/api/v2/public';

/** Deribit names instruments like `ETH-4SEP26-2350-P`. */
export function parseDeribitName(name: string): {
  underlying: string;
  expiry: number;
  strike: number;
  isCall: boolean;
} | null {
  const parts = name.split('-');
  if (parts.length !== 4) return null;

  const [underlying, expiryText, strikeText, type] = parts;
  const strike = Number(strikeText);
  if (!Number.isFinite(strike)) return null;

  // `4SEP26` -> 2026-09-04, settled at 08:00 UTC, which is Deribit's convention.
  const match = expiryText.match(/^(\d{1,2})([A-Z]{3})(\d{2})$/);
  if (!match) return null;

  const [, dayText, monthText, yearText] = match;
  const months = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ];
  const month = months.indexOf(monthText);
  if (month === -1) return null;

  const expiry = Date.UTC(2000 + Number(yearText), month, Number(dayText), 8) / 1000;

  return { underlying, expiry, strike, isCall: type === 'C' };
}

interface DeribitTrade {
  trade_id: string;
  instrument_name: string;
  timestamp: number;
  direction: string;
  price: number;
  amount: number;
  iv?: number;
  index_price: number;
  mark_price?: number;
}

async function call<T>(path: string): Promise<T> {
  const response = await fetch(`${API}/${path}`, {
    // Market data goes stale fast, and a cached signal feed is a lying one.
    cache: 'no-store',
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Deribit returned ${response.status} for ${path}.`);
  }

  const body = (await response.json()) as { result?: T; error?: { message?: string } };
  if (body.error) throw new Error(`Deribit: ${body.error.message ?? 'unknown error'}`);
  if (body.result === undefined) throw new Error(`Deribit returned no result for ${path}.`);

  return body.result;
}

/**
 * Recent public option trades for one currency.
 *
 * @param currency ETH or BTC. Those are the only two Thetanuts can fill.
 * @param count    how many recent trades to read, capped by Deribit at 1000.
 */
export async function fetchRecentTrades(
  currency: 'ETH' | 'BTC',
  count = 200,
): Promise<SourcedTrade[]> {
  const result = await call<{ trades: DeribitTrade[] }>(
    `get_last_trades_by_currency?currency=${currency}&kind=option&count=${Math.min(count, 1000)}`,
  );

  const trades: SourcedTrade[] = [];

  for (const trade of result.trades ?? []) {
    const parsed = parseDeribitName(trade.instrument_name);
    if (!parsed) continue;

    // Expired contracts cannot be copied, so they are not signals.
    if (parsed.expiry * 1000 <= Date.now()) continue;

    trades.push({
      id: `deribit:${trade.trade_id}`,
      venue: 'deribit',
      venueInstrument: trade.instrument_name,
      underlying: parsed.underlying,
      isCall: parsed.isCall,
      strike: parsed.strike,
      expiry: parsed.expiry,
      timestamp: trade.timestamp,
      direction: trade.direction === 'sell' ? 'sell' : 'buy',
      price: trade.price,
      amount: trade.amount,
      iv: typeof trade.iv === 'number' ? trade.iv : null,
      indexPrice: trade.index_price,
      markPrice: typeof trade.mark_price === 'number' ? trade.mark_price : null,
    });
  }

  return trades;
}

/** Every live option instrument on Deribit, used to check coverage. */
/**
 * The settlement price Deribit published for an expiry date.
 *
 * This is the number an expired option actually paid out against, not a spot
 * quote taken afterwards, which is why a battle can be resolved honestly
 * without OptionArena needing a price feed of its own. Returns null when the
 * date has not settled yet, or is older than Deribit still publishes.
 *
 * @param currency ETH or BTC.
 * @param expiry   expiry in seconds, as stored on a strategy.
 */
export async function fetchDeliveryPrice(
  currency: 'ETH' | 'BTC',
  expiry: number,
): Promise<number | null> {
  const wanted = new Date(expiry * 1000).toISOString().slice(0, 10);

  const result = await call<{ data: { date: string; delivery_price: number }[] }>(
    `get_delivery_prices?index_name=${currency.toLowerCase()}_usd&offset=0&count=90`,
  );

  return result.data.find((row) => row.date === wanted)?.delivery_price ?? null;
}

export async function fetchInstruments(currency: 'ETH' | 'BTC') {
  return call<
    { instrument_name: string; strike: number; expiration_timestamp: number; option_type: string }[]
  >(`get_instruments?currency=${currency}&kind=option&expired=false`);
}
