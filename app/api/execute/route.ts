import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { fetchBuyable, fetchSpot } from '@/lib/thetanuts/book';
import { quoteInstrument } from '@/lib/thetanuts/quote';
import { execute, ExecutionRefused } from '@/lib/agent/execute';
import { canSign } from '@/lib/thetanuts/client';
import { getStore } from '@/lib/db/store';
import { formatUnits, fromUnits } from '@/lib/thetanuts/decimals';
import { RISK_LEVELS, type ExecutedStrategy } from '@/lib/agent/schema';
import type { ExecuteResponse } from '@/lib/wire';

export const dynamic = 'force-dynamic';

/**
 * How much worse a fill may get between step 02 and step 03 before it is
 * refused. Two percent is tight enough to protect the user and loose enough to
 * survive a normal market-maker requote.
 */
const SLIPPAGE_TOLERANCE = 0.02;

const Body = z.object({
  instrumentId: z.string().min(1),
  budget: z.number().positive(),
  mode: z.enum(['demo', 'live']),
  view: z.string().default(''),
  risk: z.enum(RISK_LEVELS).default('balanced'),
  reasoning: z.string().default(''),
  direction: z.enum(['bullish', 'bearish', 'neutral']).default('neutral'),
  /**
   * The maximum loss the user saw and approved at step 02, as an exact string.
   * The server refuses to trade if the live book no longer agrees with it.
   */
  approvedMaxLoss: z.string().optional(),
  /** The contract count the user saw at step 02, for the slippage check. */
  approvedContracts: z.string().optional(),
});

/**
 * Step 03: execute and prove.
 *
 * The order is re-fetched and re-priced here rather than trusting anything the
 * browser sent. A resting order can disappear between step 02 and step 03, and
 * the price the user is charged must be the price on the book right now.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'The request body is not valid JSON.' }, { status: 400 });
  }

  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(' ') },
      { status: 400 },
    );
  }

  const { instrumentId, budget, mode, view, risk, reasoning, direction, approvedMaxLoss, approvedContracts } =
    parsed.data;

  // Live mode is only possible when the server holds a key. Never pretend.
  if (mode === 'live' && !canSign()) {
    return NextResponse.json(
      { error: 'This deployment has no signing key, so it cannot trade live.' },
      { status: 409 },
    );
  }

  try {
    const buyable = await fetchBuyable();
    const instrument = buyable.find((i) => i.id === instrumentId);

    if (!instrument) {
      return NextResponse.json(
        {
          error:
            'That order is no longer on the book. Resting orders expire quickly. ' +
            'Price the strategy again.',
        },
        { status: 410 },
      );
    }

    const spot = await fetchSpot();
    const quote = quoteInstrument(instrument, budget, spot[instrument.underlying] ?? null);

    // Never trade a maximum loss the user has not seen. The maker's remaining
    // size can shrink between step 02 and step 03, which shrinks the fill.
    const liveMaxLoss = fromUnits(quote.maxLoss, quote.collateralDecimals);
    if (approvedMaxLoss !== undefined && approvedMaxLoss !== liveMaxLoss) {
      return NextResponse.json(
        {
          error:
            `The book moved. You approved a maximum loss of ${approvedMaxLoss} ` +
            `${quote.collateralSymbol} but this fill is now ${liveMaxLoss} ` +
            `${quote.collateralSymbol}. Price the strategy again and check the new number.`,
        },
        { status: 409 },
      );
    }

    // Slippage. Market makers requote about once a minute, so the same budget
    // can buy fewer contracts than step 02 showed. Spending the same money for
    // materially less exposure is a worse trade, and the user has not agreed to
    // it, so refuse rather than quietly filling.
    if (approvedContracts !== undefined) {
      const approved = Number(approvedContracts);
      const live = Number(fromUnits(quote.numContracts, quote.collateralDecimals));

      if (Number.isFinite(approved) && approved > 0 && live < approved * (1 - SLIPPAGE_TOLERANCE)) {
        const worseBy = ((1 - live / approved) * 100).toFixed(1);
        return NextResponse.json(
          {
            error:
              `The price moved against you. The same ${liveMaxLoss} ${quote.collateralSymbol} ` +
              `now buys ${worseBy}% fewer contracts than the quote you approved. ` +
              `Price the strategy again to see the current terms.`,
          },
          { status: 409 },
        );
      }
    }

    const strategy: ExecutedStrategy = {
      id: randomUUID(),
      createdAt: Date.now(),
      view,
      risk,
      reasoning,
      direction,
      label: quote.label,
      underlying: quote.underlying,
      structure: quote.structure,
      strikes: quote.strikes,
      expiry: quote.expiry,
      premium: formatUnits(quote.premium, quote.collateralDecimals),
      maxLoss: formatUnits(quote.maxLoss, quote.collateralDecimals),
      maxGain:
        quote.maxGain === null ? null : formatUnits(quote.maxGain, quote.collateralDecimals),
      breakeven: quote.breakeven,
      collateralSymbol: quote.collateralSymbol,
      collateralDecimals: quote.collateralDecimals,
      status: mode === 'live' ? 'executed' : 'simulated',
      txHash: null,
      live: mode === 'live',
      error: null,
    };

    if (mode === 'demo') {
      // A simulated strategy joins the feed, clearly marked, with no hash.
      await getStore().save(strategy);

      const response: ExecuteResponse = {
        live: false,
        txHash: null,
        explorerUrl: null,
        blockNumber: null,
        gasUsed: null,
        spentDisplay: `${formatUnits(quote.premium, quote.collateralDecimals)} ${quote.collateralSymbol}`,
        strategyId: strategy.id,
      };
      return NextResponse.json(response);
    }

    const result = await execute(instrument, quote, budget);

    strategy.txHash = result.txHash;
    await getStore().save(strategy);

    const response: ExecuteResponse = {
      live: true,
      txHash: result.txHash,
      explorerUrl: result.explorerUrl,
      blockNumber: result.blockNumber,
      gasUsed: result.gasUsed,
      spentDisplay: `${formatUnits(result.spent, result.collateralDecimals)} ${result.collateralSymbol}`,
      strategyId: strategy.id,
    };
    return NextResponse.json(response);
  } catch (error) {
    const refused = error instanceof ExecutionRefused;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'The trade could not be placed.' },
      { status: refused ? 409 : 500 },
    );
  }
}
