import 'server-only';

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ExecutedStrategy } from '../agent/schema';

/**
 * Where executed strategies live.
 *
 * The store is an interface with a file-backed implementation, so the product
 * runs with no configuration at all. Setting DATABASE_URL is the seam for
 * Postgres: implement `PostgresStore` against this same interface and switch in
 * `getStore`. Nothing above this file changes.
 *
 * Every executed row carries its transaction hash. That hash is the product's
 * proof, so it is written once, at execution, and never derived from anything.
 */

export interface StrategyStore {
  list(limit?: number): Promise<ExecutedStrategy[]>;
  save(strategy: ExecutedStrategy): Promise<void>;
  get(id: string): Promise<ExecutedStrategy | null>;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'strategies.json');

class FileStore implements StrategyStore {
  private async readAll(): Promise<ExecutedStrategy[]> {
    try {
      return JSON.parse(await readFile(DATA_FILE, 'utf-8')) as ExecutedStrategy[];
    } catch {
      // No file yet is the normal first-run state, not an error.
      return [];
    }
  }

  async list(limit = 50): Promise<ExecutedStrategy[]> {
    const all = await this.readAll();
    return all.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  }

  async get(id: string): Promise<ExecutedStrategy | null> {
    return (await this.readAll()).find((s) => s.id === id) ?? null;
  }

  async save(strategy: ExecutedStrategy): Promise<void> {
    const all = await this.readAll();
    const index = all.findIndex((s) => s.id === strategy.id);
    if (index === -1) all.push(strategy);
    else all[index] = strategy;

    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(DATA_FILE, JSON.stringify(all, null, 2), 'utf-8');
  }
}

let store: StrategyStore | null = null;

export function getStore(): StrategyStore {
  if (!store) store = new FileStore();
  return store;
}

/**
 * Rank strategies by risk-adjusted performance, not by raw return.
 *
 * A leaderboard sorted by percentage gain rewards whoever took the most risk
 * and got lucky. This scores return per unit of capital risked, and requires a
 * minimum number of trades before anyone ranks at all, so one lucky trade does
 * not top the board.
 */
export interface LeaderboardRow {
  trader: string;
  trades: number;
  /** Total realised and unrealised return, in USDC terms. */
  totalReturn: number;
  /** Total capital put at risk across all trades. */
  totalRisked: number;
  /** Return per unit risked. The column the board is sorted by. */
  riskAdjusted: number;
  /** Share of trades that made money. */
  hitRate: number;
}

/** Minimum trades before a trader appears on the board. */
export const MIN_TRADES_TO_RANK = 3;
