import { NextResponse } from 'next/server';
import { z } from 'zod';

import { CalldataRefused, fillCalldata } from '@/lib/thetanuts/calldata';
import { maxTradeUsdc } from '@/lib/thetanuts/client';

export const dynamic = 'force-dynamic';

/**
 * Calldata for a wallet the server does not control.
 *
 * This route reads the book and encodes two calls. It holds no key, signs
 * nothing and broadcasts nothing — the person's own wallet does all three.
 *
 * `MAX_TRADE_USDC` is still enforced. It is a guardrail against a first run
 * being a large trade, and that reasoning does not change just because the
 * money belongs to the user rather than to us.
 */

const Body = z.object({
  instrumentId: z.string().min(1),
  budget: z.number().positive().finite(),
});

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = Body.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Send an instrumentId and a budget.' }, { status: 400 });
  }

  const ceiling = maxTradeUsdc();
  if (parsed.budget > ceiling) {
    return NextResponse.json(
      { error: `That trade is above the ${ceiling} ceiling set by MAX_TRADE_USDC.` },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await fillCalldata(parsed.instrumentId, parsed.budget));
  } catch (error) {
    // A refusal is the user's business and says what to do about it. Anything
    // else is ours: it goes to the log, not to the browser.
    if (error instanceof CalldataRefused) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error('[calldata] could not build the fill:', error);
    return NextResponse.json(
      { error: 'The book could not be read just now. Try again in a moment.' },
      { status: 502 },
    );
  }
}
