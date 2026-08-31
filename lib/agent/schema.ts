import { z } from 'zod';

/**
 * The contract between the language model and the rest of OptionArena.
 *
 * Everything the model returns is validated against these schemas before it is
 * used. The model chooses WHICH contract to trade and explains why. It never
 * supplies a price, a premium or a maximum loss: those come from the live book.
 */

export const RISK_LEVELS = ['conservative', 'balanced', 'aggressive'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

/** What the user asks for at step 01. */
export const ViewRequest = z.object({
  /** Free text market view, in the user's own words. */
  view: z.string().min(3).max(500),
  /** Maximum the user is willing to spend, in whole units of collateral. */
  budget: z.number().positive().max(1_000_000),
  risk: z.enum(RISK_LEVELS),
  /** Restrict to one underlying, or let the agent choose. */
  underlying: z.string().optional(),
});
export type ViewRequest = z.infer<typeof ViewRequest>;

/**
 * What the model returns.
 *
 * `instrumentId` must match one of the shortlisted live orders. Anything else
 * is rejected, so the model cannot invent a contract that does not exist.
 */
export const AgentChoice = z.object({
  instrumentId: z.string().min(1),
  /** Why this contract expresses the user's view. Plain language, one or two sentences. */
  reasoning: z.string().min(10).max(600),
  /** The direction the model read from the view. */
  direction: z.enum(['bullish', 'bearish', 'neutral']),
  /** How confident the model is that the view maps onto this contract, 0 to 1. */
  confidence: z.number().min(0).max(1),
});
export type AgentChoice = z.infer<typeof AgentChoice>;

/** A strategy the agent has chosen and the book has priced. */
export const StrategyStatus = z.enum(['draft', 'simulated', 'executed', 'failed']);
export type StrategyStatus = z.infer<typeof StrategyStatus>;

/** One row in the feed. Every executed row carries its transaction hash. */
export interface ExecutedStrategy {
  id: string;
  createdAt: number;
  /** The user's original words. */
  view: string;
  risk: RiskLevel;
  /** What the agent chose and why. */
  reasoning: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  /** The instrument, as shown in the interface. */
  label: string;
  underlying: string;
  structure: string;
  strikes: number[];
  expiry: number;
  /** Amounts as strings, because bigint does not survive JSON. */
  premium: string;
  maxLoss: string;
  maxGain: string | null;
  breakeven: number | null;
  collateralSymbol: string;
  collateralDecimals: number;
  status: StrategyStatus;
  /**
   * The transaction hash. This is the product's proof. It exists only when the
   * trade really happened, and is never derived from anything else.
   */
  txHash: string | null;
  /** Whether this ran against the chain or in demo mode. */
  live: boolean;
  /** Why a failed execution failed, in plain language. */
  error: string | null;
}
