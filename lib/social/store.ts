import 'server-only';

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { and, eq, or } from 'drizzle-orm';

import { battles, calls, friendships, users, type CallSide } from '../db/schema';

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

/** A Google account, as much of it as we keep. */
export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string | null;
  picture: string | null;
}

/** A call on an arena matchup. Both sides are frozen at the moment it was made. */
export interface Call {
  id: string;
  handle: string;
  pairKey: string;
  createdAt: number;
  picked: 'left' | 'right';
  left: CallSide;
  right: CallSide;
  /** The later of the two expiries, in seconds. */
  resolvesAt: number;
  /** 'left', 'right' or 'draw'. Null while the call is still open. */
  winner: string | null;
  resolvedAt: number | null;
  settlement: Record<string, number> | null;
}

export interface SocialStore {
  upsertUser(handle: string): Promise<void>;
  /**
   * Find or create the person behind a Google account, and return their handle.
   *
   * Matched on Google's `sub`, never the email, because an address can be
   * changed or reassigned and `sub` cannot. `suggestion` is only a starting
   * name: if it is taken by someone else, a free variant is chosen.
   */
  upsertGoogleUser(identity: GoogleIdentity, suggestion: string): Promise<string>;
  follow(owner: string, friend: string): Promise<void>;
  unfollow(owner: string, friend: string): Promise<void>;
  /** Handles this person follows. */
  following(owner: string): Promise<string[]>;
  createBattle(battle: Battle): Promise<void>;
  /** Battles this person is in, newest first. */
  battlesFor(handle: string): Promise<Battle[]>;
  getBattle(id: string): Promise<Battle | null>;
  saveBattle(battle: Battle): Promise<void>;
  /** Create or replace this person's call on one matchup pairing. */
  saveCall(call: Call): Promise<void>;
  callFor(handle: string, pairKey: string): Promise<Call | null>;
  /** Every call this person has made, newest first. */
  callsFor(handle: string): Promise<Call[]>;
}

// --- file backend -----------------------------------------------------------

interface StoredUser {
  id: string;
  provider?: string;
  providerAccountId?: string;
  email?: string;
  image?: string;
  displayName?: string;
}

interface SocialFile {
  /** Strings are rows written before sign-in existed. Read, never written. */
  users: (string | StoredUser)[];
  follows: { owner: string; friend: string; createdAt: number }[];
  battles: Battle[];
  calls: Call[];
}

const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'social.json');

function empty(): SocialFile {
  return { users: [], follows: [], battles: [], calls: [] };
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
    if (!data.users.some((row) => handleOf(row) === handle)) {
      data.users.push({ id: handle, provider: 'handle' });
      await this.write(data);
    }
  }

  async upsertGoogleUser(identity: GoogleIdentity, suggestion: string): Promise<string> {
    const data = await this.read();

    const existing = data.users.find(
      (row) => typeof row !== 'string' && row.providerAccountId === identity.sub,
    );
    if (existing) return handleOf(existing);

    const taken = new Set(data.users.map(handleOf));
    const handle = freeHandle(suggestion, taken);

    data.users.push({
      id: handle,
      provider: 'google',
      providerAccountId: identity.sub,
      email: identity.email,
      image: identity.picture ?? undefined,
      displayName: identity.name ?? handle,
    });
    await this.write(data);

    return handle;
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

  async saveCall(call: Call): Promise<void> {
    const data = await this.read();
    // One call per person per pairing: re-picking replaces rather than stacks.
    const index = data.calls.findIndex(
      (row) => row.id === call.id || (row.handle === call.handle && row.pairKey === call.pairKey),
    );
    if (index === -1) data.calls.push(call);
    else data.calls[index] = call;
    await this.write(data);
  }

  async callFor(handle: string, pairKey: string): Promise<Call | null> {
    const data = await this.read();
    return data.calls.find((row) => row.handle === handle && row.pairKey === pairKey) ?? null;
  }

  async callsFor(handle: string): Promise<Call[]> {
    const data = await this.read();
    return data.calls
      .filter((row) => row.handle === handle)
      .sort((a, b) => b.createdAt - a.createdAt);
  }
}

// --- postgres backend -------------------------------------------------------

class PostgresSocialStore implements SocialStore {
  private db;

  constructor(connectionString: string) {
    this.db = drizzle(neon(connectionString), { schema: { friendships, battles, users, calls } });
  }

  async upsertUser(handle: string): Promise<void> {
    await this.db
      .insert(users)
      .values({ id: handle, createdAt: Date.now(), displayName: handle, provider: 'handle' })
      .onConflictDoNothing({ target: users.id });
  }

  async upsertGoogleUser(identity: GoogleIdentity, suggestion: string): Promise<string> {
    const existing = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.providerAccountId, identity.sub))
      .limit(1);

    if (existing[0]) return existing[0].id;

    const taken = new Set(
      (await this.db.select({ id: users.id }).from(users)).map((row) => row.id),
    );
    const handle = freeHandle(suggestion, taken);

    await this.db
      .insert(users)
      .values({
        id: handle,
        createdAt: Date.now(),
        displayName: identity.name ?? handle,
        provider: 'google',
        providerAccountId: identity.sub,
        email: identity.email,
        image: identity.picture,
      })
      .onConflictDoNothing({ target: users.id });

    return handle;
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

  async saveCall(call: Call): Promise<void> {
    // One call per person per pairing. The id is derived from both, so a
    // re-pick collides with itself and updates rather than stacking.
    await this.db
      .insert(calls)
      .values(call)
      .onConflictDoUpdate({
        target: calls.id,
        set: {
          picked: call.picked,
          winner: call.winner,
          resolvedAt: call.resolvedAt,
          settlement: call.settlement,
        },
      });
  }

  async callFor(handle: string, pairKey: string): Promise<Call | null> {
    const rows = await this.db
      .select()
      .from(calls)
      .where(and(eq(calls.handle, handle), eq(calls.pairKey, pairKey)))
      .limit(1);
    return rows[0] ? callFromRow(rows[0]) : null;
  }

  async callsFor(handle: string): Promise<Call[]> {
    const rows = await this.db.select().from(calls).where(eq(calls.handle, handle));
    return rows.map(callFromRow).sort((a, b) => b.createdAt - a.createdAt);
  }
}

function callFromRow(row: typeof calls.$inferSelect): Call {
  return {
    id: row.id,
    handle: row.handle,
    pairKey: row.pairKey,
    createdAt: row.createdAt,
    picked: row.picked as 'left' | 'right',
    left: row.left,
    right: row.right,
    resolvesAt: row.resolvesAt,
    winner: row.winner,
    resolvedAt: row.resolvedAt,
    settlement: row.settlement ?? null,
  };
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

/** The handle on a stored user, whichever shape the row is in. */
function handleOf(row: string | StoredUser): string {
  return typeof row === 'string' ? row : row.id;
}

/**
 * A handle nobody else holds.
 *
 * Two people called alex@ at different domains are different people, so the
 * second one gets alex2 rather than being silently merged into the first.
 */
function freeHandle(suggestion: string, taken: Set<string>): string {
  if (!taken.has(suggestion)) return suggestion;

  for (let n = 2; n < 1000; n += 1) {
    const suffix = String(n);
    const candidate = `${suggestion.slice(0, 20 - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }

  // Effectively unreachable, and still better than returning someone else's.
  return `${suggestion.slice(0, 13)}${Date.now().toString(36).slice(-6)}`;
}

let socialStore: SocialStore | null = null;

/** Postgres when DATABASE_URL is set, the local file otherwise. */
export function getSocialStore(): SocialStore {
  if (socialStore) return socialStore;

  const url = process.env.DATABASE_URL;
  socialStore = url ? new PostgresSocialStore(url) : new FileSocialStore();

  return socialStore;
}
