import 'server-only';

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { and, eq, or } from 'drizzle-orm';

import { battles, friendships, users } from '../db/schema';

/**
 * Friends and battles.
 *
 * Two backends behind one interface, exactly as `lib/db/store.ts` does for
 * strategies and for the same reason: Postgres in production because a
 * serverless filesystem loses every write, a JSON file locally so the product
 * runs with no configuration at all.
 *
 * Nothing here gates anything. A handle carries no authority, following is a
 * filter over data already public in the feed, and a battle stakes nothing.
 * See `lib/auth/session.ts`.
 *
 * Units follow the schema they mirror: `createdAt` and `resolvedAt` are epoch
 * milliseconds like `strategies.createdAt`, `resolvesAt` is epoch seconds like
 * `strategies.expiry`.
 */

export interface Battle {
  id: string;
  createdAt: number;
  challenger: string;
  opponent: string;
  challengerStrategyId: string;
  opponentStrategyId: string;
  /** The later of the two expiries, in seconds. Nothing resolves before it. */
  resolvesAt: number;
  /** A handle, or 'draw'. Null while the battle is still running. */
  winner: string | null;
  resolvedAt: number | null;
  /** The settlement prices the result came from, kept so it can be checked. */
  settlement: Record<string, number> | null;
}

export interface SocialStore {
  upsertUser(handle: string): Promise<void>;
  follow(owner: string, friend: string): Promise<void>;
  unfollow(owner: string, friend: string): Promise<void>;
  /** Handles this person follows. */
  following(owner: string): Promise<string[]>;
  createBattle(battle: Battle): Promise<void>;
  /** Battles this person is in, newest first. */
  battlesFor(handle: string): Promise<Battle[]>;
  getBattle(id: string): Promise<Battle | null>;
  saveBattle(battle: Battle): Promise<void>;
}

// --- file backend -----------------------------------------------------------

interface SocialFile {
  users: string[];
  follows: { owner: string; friend: string; createdAt: number }[];
  battles: Battle[];
}

const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'social.json');

function empty(): SocialFile {
  return { users: [], follows: [], battles: [] };
}

class FileSocialStore implements SocialStore {
  private async read(): Promise<SocialFile> {
    try {
      return { ...empty(), ...(JSON.parse(await readFile(DATA_FILE, 'utf-8')) as SocialFile) };
    } catch {
      // No file yet is the normal first-run state, not an error.
      return empty();
    }
  }

  private async write(data: SocialFile): Promise<void> {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  }

  async upsertUser(handle: string): Promise<void> {
    const data = await this.read();
    if (!data.users.includes(handle)) {
      data.users.push(handle);
      await this.write(data);
    }
  }

  async follow(owner: string, friend: string): Promise<void> {
    const data = await this.read();
    if (!data.follows.some((row) => row.owner === owner && row.friend === friend)) {
      data.follows.push({ owner, friend, createdAt: Date.now() });
      await this.write(data);
    }
  }

  async unfollow(owner: string, friend: string): Promise<void> {
    const data = await this.read();
    data.follows = data.follows.filter((row) => !(row.owner === owner && row.friend === friend));
    await this.write(data);
  }

  async following(owner: string): Promise<string[]> {
    const data = await this.read();
    return data.follows.filter((row) => row.owner === owner).map((row) => row.friend);
  }

  async createBattle(battle: Battle): Promise<void> {
    await this.saveBattle(battle);
  }

  async battlesFor(handle: string): Promise<Battle[]> {
    const data = await this.read();
    return data.battles
      .filter((battle) => battle.challenger === handle || battle.opponent === handle)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async getBattle(id: string): Promise<Battle | null> {
    return (await this.read()).battles.find((battle) => battle.id === id) ?? null;
  }

  async saveBattle(battle: Battle): Promise<void> {
    const data = await this.read();
    const index = data.battles.findIndex((row) => row.id === battle.id);
    if (index === -1) data.battles.push(battle);
    else data.battles[index] = battle;
    await this.write(data);
  }
}

// --- postgres backend -------------------------------------------------------

class PostgresSocialStore implements SocialStore {
  private db;

  constructor(connectionString: string) {
    this.db = drizzle(neon(connectionString), { schema: { friendships, battles, users } });
  }

  async upsertUser(handle: string): Promise<void> {
    await this.db
      .insert(users)
      .values({ id: handle, createdAt: Date.now(), displayName: handle })
      .onConflictDoNothing({ target: users.id });
  }

  async follow(owner: string, friend: string): Promise<void> {
    await this.db
      .insert(friendships)
      .values({ owner, friend, createdAt: Date.now() })
      .onConflictDoNothing();
  }

  async unfollow(owner: string, friend: string): Promise<void> {
    await this.db
      .delete(friendships)
      .where(and(eq(friendships.owner, owner), eq(friendships.friend, friend)));
  }

  async following(owner: string): Promise<string[]> {
    const rows = await this.db
      .select({ friend: friendships.friend })
      .from(friendships)
      .where(eq(friendships.owner, owner));
    return rows.map((row) => row.friend);
  }

  async createBattle(battle: Battle): Promise<void> {
    await this.db.insert(battles).values(battle).onConflictDoNothing({ target: battles.id });
  }

  async battlesFor(handle: string): Promise<Battle[]> {
    const rows = await this.db
      .select()
      .from(battles)
      .where(or(eq(battles.challenger, handle), eq(battles.opponent, handle)));
    return rows.map(fromRow).sort((a, b) => b.createdAt - a.createdAt);
  }

  async getBattle(id: string): Promise<Battle | null> {
    const rows = await this.db.select().from(battles).where(eq(battles.id, id)).limit(1);
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async saveBattle(battle: Battle): Promise<void> {
    await this.db
      .insert(battles)
      .values(battle)
      .onConflictDoUpdate({
        target: battles.id,
        set: {
          winner: battle.winner,
          resolvedAt: battle.resolvedAt,
          settlement: battle.settlement,
        },
      });
  }
}

function fromRow(row: typeof battles.$inferSelect): Battle {
  return {
    id: row.id,
    createdAt: row.createdAt,
    challenger: row.challenger,
    opponent: row.opponent,
    challengerStrategyId: row.challengerStrategyId,
    opponentStrategyId: row.opponentStrategyId,
    resolvesAt: row.resolvesAt,
    winner: row.winner,
    resolvedAt: row.resolvedAt,
    settlement: row.settlement ?? null,
  };
}

let socialStore: SocialStore | null = null;

/** Postgres when DATABASE_URL is set, the local file otherwise. */
export function getSocialStore(): SocialStore {
  if (socialStore) return socialStore;

  const url = process.env.DATABASE_URL;
  socialStore = url ? new PostgresSocialStore(url) : new FileSocialStore();

  return socialStore;
}
