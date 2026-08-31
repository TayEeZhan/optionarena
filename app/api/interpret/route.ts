import { NextResponse } from 'next/server';

import { ViewRequest } from '@/lib/agent/schema';
import { interpret } from '@/lib/agent/interpret';
import { fetchBuyable, fetchSpot } from '@/lib/thetanuts/book';
import { quoteInstrument } from '@/lib/thetanuts/quote';
import { toWire, type InterpretResponse } from '@/lib/wire';

export const dynamic = 'force-dynamic';

/**
 * Step 01 to step 02: a plain-language view becomes a priced strategy.
 *
 * Nothing here signs anything. The response carries the real maximum loss so
 * the user can decide before step 03.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'The request body is not valid JSON.' }, { status: 400 });
  }

  const parsed = ViewRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(' ') },
      { status: 400 },
    );
  }

  try {
    const buyable = await fetchBuyable(parsed.data.underlying);

    if (buyable.length === 0) {
      return NextResponse.json(
        {
          error:
            `There are no contracts to buy on ${parsed.data.underlying ?? 'any asset'} right now. ` +
            `Only ETH and BTC have resting sell orders on Base.`,
        },
        { status: 503 },
      );
    }

    const [interpretation, spot] = await Promise.all([
      interpret(parsed.data, buyable),
      fetchSpot(),
    ]);

    const quote = quoteInstrument(
      interpretation.instrument,
      parsed.data.budget,
      spot[interpretation.instrument.underlying] ?? null,
    );

    const response: InterpretResponse = {
      quote: toWire(quote),
      reasoning: interpretation.reasoning,
      direction: interpretation.direction,
      confidence: interpretation.confidence,
      decidedBy: interpretation.decidedBy,
      promptVersion: interpretation.promptVersion,
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not price that view.' },
      { status: 500 },
    );
  }
}
