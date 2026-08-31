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

/** A trader. A wallet address or a demo session is enough for now. */
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  address: text('address'),
  displayName: text('display_name'),
});

export type StrategyRow = typeof strategies.$inferSelect;
export type NewStrategyRow = typeof strategies.$inferInsert;
export type SignalRow = typeof signals.$inferSelect;
