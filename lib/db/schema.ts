import {
  pgTable,
  text,
  bigint,
  integer,
  doublePrecision,
  boolean,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

/**
 * The database schema.
 *
 * Amounts are stored as `text`, deliberately. They are exact decimal strings
 * produced by `lib/thetanuts/decimals.ts`. Storing them as a float would
 * reintroduce the rounding error the whole decimals module exists to prevent,
 * and Postgres `numeric` comes back as a string anyway. Text keeps them exact
 * and keeps the collateral token's decimals meaningful.
 */

/** Strategies built in OptionArena. Executed rows carry a transaction hash. */
export const strategies = pgTable(
  'strategies',
  {
    id: text('id').primaryKey(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),

    /** The user's own words. */
    view: text('view').notNull().default(''),
    risk: text('risk').notNull().default('balanced'),
    reasoning: text('reasoning').notNull().default(''),
    direction: text('direction').notNull().default('neutral'),

    label: text('label').notNull(),
    underlying: text('underlying').notNull(),
    structure: text('structure').notNull(),
    strikes: jsonb('strikes').$type<number[]>().notNull(),
    expiry: bigint('expiry', { mode: 'number' }).notNull(),

    premium: text('premium').notNull(),
    maxLoss: text('max_loss').notNull(),
    maxGain: text('max_gain'),
    breakeven: doublePrecision('breakeven'),
    collateralSymbol: text('collateral_symbol').notNull(),
    collateralDecimals: integer('collateral_decimals').notNull(),

    status: text('status').notNull(),
    /**
     * The proof. Written once, at execution, and never derived from anything
     * else. Null means the strategy was simulated, never that it was lost.
     */
    txHash: text('tx_hash'),
    live: boolean('live').notNull().default(false),
    error: text('error'),

    /** Wallet address or demo session identifier. No auth in week one. */
    trader: text('trader'),
  },
  (table) => [
    index('strategies_created_at_idx').on(table.createdAt),
    index('strategies_tx_hash_idx').on(table.txHash),
    index('strategies_trader_idx').on(table.trader),
  ],
);

/**
 * Trades sourced from external venues, for the P3 copy flow.
 *
 * Defined now so the signals lane can start against a real table rather than
 * inventing one mid-week.
 */
export const signals = pgTable(
  'signals',
  {
    id: text('id').primaryKey(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),

    /** deribit, derive, and so on. */
    venue: text('venue').notNull(),
    /** The venue's own instrument name, kept verbatim for traceability. */
    venueInstrument: text('venue_instrument').notNull(),

    underlying: text('underlying').notNull(),
    isCall: boolean('is_call').notNull(),
    strikes: jsonb('strikes').$type<number[]>().notNull(),
    expiry: bigint('expiry', { mode: 'number' }).notNull(),

    /** Resolved profit and loss, when the venue reports it. */
    realisedPnl: doublePrecision('realised_pnl'),
    /** Return per unit of capital risked. What ranking sorts on. */
    riskAdjusted: doublePrecision('risk_adjusted'),

    /**
     * The nearest Thetanuts instrument, and how it differs. Never substitute
     * silently: if the strike or expiry moved, that is shown to the user.
     */
    mappedInstrumentId: text('mapped_instrument_id'),
    mappingNotes: jsonb('mapping_notes').$type<string[]>(),

    raw: jsonb('raw'),
  },
  (table) => [
    index('signals_venue_idx').on(table.venue),
    index('signals_risk_adjusted_idx').on(table.riskAdjusted),
  ],
);

/**
 * A person. The primary key is their handle, which is what every social table
 * joins on, so an account signed in with Google still gets one.
 *
 * `provider` records how the identity was established, and the interface shows
 * the difference: a Google account is verified, a typed handle is not.
 */
export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
    address: text('address'),
    displayName: text('display_name'),
    /** 'google' or 'handle'. Null on rows written before sign-in existed. */
    provider: text('provider'),
    /** Google's stable `sub`. Never the email, which a person can change. */
    providerAccountId: text('provider_account_id'),
    email: text('email'),
    image: text('image'),
  },
  (table) => [index('users_provider_account_idx').on(table.providerAccountId)],
);

/**
 * Who follows whom. One row per direction: `owner` follows `friend`.
 *
 * Deliberately not mutual-consent. Every strategy is already public in the
 * feed, so a friends list is a filter over public data rather than a privacy
 * boundary, and asking both sides to agree would be a consent prompt that
 * protects nothing. If strategies ever become private, this becomes the wrong
 * shape and the mutual version is the fix.
 */
export const friendships = pgTable(
  'friendships',
  {
    owner: text('owner').notNull(),
    friend: text('friend').notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('friendships_owner_idx').on(table.owner),
    index('friendships_friend_idx').on(table.friend),
  ],
);

/**
 * A friendly contest between two strategies.
 *
 * Nothing is staked. `winner` stays null until both options have expired, at
 * which point the result is computed from the settlement price rather than from
 * anything either player reports. Until then the interface compares the two
 * positions on what they risk and what they pay if right, which is a comparison
 * of conviction and is labelled as such.
 */
export const battles = pgTable(
  'battles',
  {
    id: text('id').primaryKey(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
    challenger: text('challenger').notNull(),
    opponent: text('opponent').notNull(),
    challengerStrategyId: text('challenger_strategy_id').notNull(),
    opponentStrategyId: text('opponent_strategy_id').notNull(),
    /** The later of the two expiries. Nothing resolves before this. */
    resolvesAt: bigint('resolves_at', { mode: 'number' }).notNull(),
    /** A handle, or 'draw'. Null while the battle is still running. */
    winner: text('winner'),
    resolvedAt: bigint('resolved_at', { mode: 'number' }),
    /** The settlement prices the result was computed from, kept for audit. */
    settlement: jsonb('settlement').$type<Record<string, number>>(),
  },
  (table) => [
    index('battles_challenger_idx').on(table.challenger),
    index('battles_opponent_idx').on(table.opponent),
  ],
);

/**
 * A call on an arena matchup: which of two sourced trades does better.
 *
 * A forecast, not a wager. Nothing is staked and nothing is transferred.
 *
 * Both sides are **snapshotted** rather than referenced. The matchup is picked
 * from live Deribit flow and rotates within minutes, so a row pointing at
 * signal ids would be unresolvable almost immediately. Everything resolution
 * needs — strike, expiry, direction, the price paid — is copied in here, and
 * after that the call never needs the board again.
 */
export const calls = pgTable(
  'calls',
  {
    id: text('id').primaryKey(),
    handle: text('handle').notNull(),
    /** The two signal ids joined, so one person has one call per pairing. */
    pairKey: text('pair_key').notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
    /** 'left' or 'right', as the matchup was shown. */
    picked: text('picked').notNull(),
    left: jsonb('left').$type<CallSide>().notNull(),
    right: jsonb('right').$type<CallSide>().notNull(),
    /** The later of the two expiries, in seconds. Nothing resolves before it. */
    resolvesAt: bigint('resolves_at', { mode: 'number' }).notNull(),
    /** 'left', 'right' or 'draw'. Null while the call is still open. */
    winner: text('winner'),
    resolvedAt: bigint('resolved_at', { mode: 'number' }),
    /** The settlement prices the result came from, kept so it can be checked. */
    settlement: jsonb('settlement').$type<Record<string, number>>(),
  },
  (table) => [index('calls_handle_idx').on(table.handle)],
);

/** One side of a call, frozen at the moment it was made. */
export interface CallSide {
  signalId: string;
  label: string;
  underlying: string;
  isCall: boolean;
  strike: number;
  /** Seconds, matching `strategies.expiry`. */
  expiry: number;
  /** Price paid, in the venue's own convention: a fraction of the underlying. */
  price: number;
}

export type StrategyRow = typeof strategies.$inferSelect;
export type NewStrategyRow = typeof strategies.$inferInsert;
export type SignalRow = typeof signals.$inferSelect;
