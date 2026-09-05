import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { AgentChoice, type ViewRequest } from './schema';
import { getLlm } from './llm';
import { describeInstrument, type Instrument } from '../thetanuts/book';
import { fromChain } from '../thetanuts/decimals';

/**
 * Plain language in, a chosen contract out.
 *
 * The model picks from a shortlist of contracts that are live right now. It is
 * never asked for a price, so it cannot invent one. Its answer is validated
 * against a zod schema and against the shortlist before it goes any further.
 */

const PROMPT_VERSION = 'interpret.v1';

export interface Interpretation {
  instrument: Instrument;
  reasoning: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  /** Which model chose this, or `rules` when no model was configured. */
  decidedBy: string;
  promptVersion: string;
}

async function loadPrompt(): Promise<string> {
  const file = path.join(process.cwd(), 'lib', 'agent', 'prompts', `${PROMPT_VERSION}.md`);
  const text = await readFile(file, 'utf-8');
  // Everything after the "## System" heading is the system prompt.
  const marker = text.indexOf('## System');
  return marker === -1 ? text : text.slice(marker + '## System'.length).trim();
}

/** Render the shortlist the model chooses from. */
function renderShortlist(instruments: Instrument[]): string {
  return instruments
    .map((i) => {
      const days = (i.hoursToExpiry / 24).toFixed(1);
      const iv = i.greeks
        ? `${(i.greeks.iv * 100).toFixed(0)}% implied volatility`
        : 'volatility unknown';
      const delta = i.greeks ? `, delta ${i.greeks.delta.toFixed(2)}` : '';
      return (
        `- id: ${i.id}\n` +
        `  ${describeInstrument(i)}\n` +
        `  ${i.isCall ? 'Call' : 'Put'}, strike ${i.strikes.join(' / ')}, ` +
        `expires in ${days} days, ${iv}${delta}\n` +
        `  price ${fromChain(i.pricePerContract, 'price')} per contract, paid in ${i.collateral.symbol}`
      );
    })
    .join('\n');
}

/**
 * Choose a contract for a view.
 *
 * @param request     what the user asked for
 * @param instruments live, buyable contracts to choose from
 */
export async function interpret(
  request: ViewRequest,
  instruments: Instrument[],
): Promise<Interpretation> {
  if (instruments.length === 0) {
    throw new Error(
      'There are no buyable contracts on the book right now, so there is nothing to choose from.',
    );
  }

  // Keep the shortlist small enough to reason about carefully.
  const shortlist = instruments.slice(0, 40);
  const llm = getLlm();

  if (!llm) {
    return { ...chooseByRules(request, shortlist), decidedBy: 'rules', promptVersion: 'none' };
  }

  const system = await loadPrompt();
  const user =
    `Market view: ${request.view}\n` +
    `Budget: ${request.budget}\n` +
    `Risk level: ${request.risk}\n\n` +
    `Live contracts to choose from:\n${renderShortlist(shortlist)}`;

  let raw: string;
  try {
    // `prefill: '{'` starts the model's turn inside the object, so it cannot
    // preface the answer with a sentence. Production was falling back to the
    // rule-based selector with "model returned an unusable answer", which is
    // this branch: the call succeeded and the reply would not parse.
    raw = await llm.complete({ system, user, maxTokens: 1500, prefill: '{' });
  } catch (error) {
    // A model outage must not take the product down. Fall back and say so.
    //
    // The provider's own error text is logged, never returned. It reached the
    // browser once, carrying a request id and billing state, and a provider
    // error is not something a user should have to read or a client should be
    // trusted with.
    console.error('[interpret] model call failed:', message(error));

    return {
      ...chooseByRules(request, shortlist),
      decidedBy: 'rules (the model could not be reached)',
      promptVersion: 'none',
    };
  }

  const parsed = AgentChoice.safeParse(extractJson(raw));
  if (!parsed.success) {
    // Logged, never returned: the raw reply is needed to diagnose a schema
    // mismatch, and the browser has no business seeing it.
    console.error(
      '[interpret] model reply did not validate:',
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      '| raw:',
      raw.slice(0, 500),
    );

    return {
      ...chooseByRules(request, shortlist),
      decidedBy: 'rules (model returned an unusable answer)',
      promptVersion: 'none',
    };
  }

  const chosen = shortlist.find((i) => i.id === parsed.data.instrumentId);
  if (!chosen) {
    // The model named a contract that is not on the shortlist. Never trade it.
    return {
      ...chooseByRules(request, shortlist),
      decidedBy: 'rules (model chose a contract that is not live)',
      promptVersion: 'none',
    };
  }

  return {
    instrument: chosen,
    reasoning: parsed.data.reasoning,
    direction: parsed.data.direction,
    confidence: parsed.data.confidence,
    decidedBy: llm.name,
    promptVersion: PROMPT_VERSION,
  };
}

/**
 * A deterministic selector used when no model is configured, when the model is
 * unavailable, or when it returns something unusable.
 *
 * It reads direction from the words in the view and picks a strike by risk
 * level. It is deliberately simple and is always labelled as `rules` so nobody
 * mistakes it for the agent.
 */
function chooseByRules(
  request: ViewRequest,
  instruments: Instrument[],
): Omit<Interpretation, 'decidedBy' | 'promptVersion'> {
  const text = request.view.toLowerCase();

  const bearishWords = [
    'fall',
    'drop',
    'down',
    'crash',
    'bear',
    'sell',
    'lower',
    'decline',
    'dump',
  ];
  const bullishWords = [
    'rise',
    'up',
    'moon',
    'bull',
    'rally',
    'higher',
    'pump',
    'grow',
    'climb',
    'break',
    'breaks',
    'above',
    'surge',
    'jump',
  ];

  const bearish = bearishWords.some((w) => text.includes(w));
  const bullish = bullishWords.some((w) => text.includes(w));

  const direction: 'bullish' | 'bearish' | 'neutral' =
    bearish && !bullish ? 'bearish' : bullish && !bearish ? 'bullish' : 'neutral';

  // If the view names an asset, honour it. Choosing an ETH contract for a view
  // about BTC is wrong however good the strike is.
  const named = request.underlying
    ? request.underlying.toUpperCase()
    : [...new Set(instruments.map((i) => i.underlying))].find((symbol) =>
        text.includes(symbol.toLowerCase()),
      );

  const onAsset = named ? instruments.filter((i) => i.underlying === named) : instruments;
  const universe = onAsset.length > 0 ? onAsset : instruments;

  const wantCall = direction === 'bullish';
  const matching = universe.filter((i) => i.isCall === wantCall);
  const pool = matching.length > 0 ? matching : universe;

  // Conservative prefers the longest expiry available, aggressive the shortest.
  const byExpiry = [...pool].sort((a, b) =>
    request.risk === 'conservative' ? b.expiry - a.expiry : a.expiry - b.expiry,
  );

  // Within that expiry, pick a strike by how far the risk level reaches.
  const expiry = byExpiry[0].expiry;
  const sameExpiry = byExpiry
    .filter((i) => i.expiry === expiry)
    .sort((a, b) => a.strikes[0] - b.strikes[0]);

  const index =
    request.risk === 'conservative'
      ? Math.floor(sameExpiry.length / 2)
      : request.risk === 'balanced'
        ? Math.floor(sameExpiry.length / 3)
        : 0;

  const instrument = sameExpiry[wantCall ? sameExpiry.length - 1 - index : index] ?? pool[0];

  // A bullish view has no honest answer when only puts are priced in USDC.
  // Say that rather than dressing a put up as a bullish trade.
  const mismatch = wantCall && !instrument.isCall;

  const configured = Boolean(getLlm());
  const why = configured
    ? `because the language model could not be reached`
    : `because no language model is configured`;

  const reasoning = mismatch
    ? `Chosen by rule, not by a model, ${why}. ` +
      `The view reads as bullish, but no contract priced in USDC expresses that today: ` +
      `on Base only puts are collateralised in USDC. This is the closest available ` +
      `contract, and it does not match the view. Treat it with care.`
    : `Chosen by rule, not by a model, ${why}. ` +
      `The view reads as ${direction}, so this is ${instrument.isCall ? 'a call' : 'a put'} ` +
      `at strike ${instrument.strikes.join(' / ')} on the ${request.risk} setting.`;

  return {
    instrument,
    reasoning,
    direction,
    confidence: mismatch ? 0.15 : direction === 'neutral' ? 0.25 : 0.5,
  };
}

/** Pull the first JSON object out of a model response. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);

  // Try the fenced block first, then the whole reply. A model that writes a
  // sentence before the fence still gets read correctly.
  for (const candidate of fenced ? [fenced[1], text] : [text]) {
    const object = firstBalancedObject(candidate);
    if (object !== null) return object;
  }

  return null;
}

/**
 * The first `{...}` in the text that is balanced and parses.
 *
 * Slicing from the first `{` to the last `}` was the previous approach, and it
 * breaks on the two things a model actually does: writing a sentence that
 * contains a brace before the answer, and adding a closing remark after it.
 * Either one makes the slice span from prose to prose, `JSON.parse` throws,
 * and a perfectly good contract choice is thrown away for the rule-based
 * fallback. Scanning for a balanced object is quotation- and escape-aware, so
 * a brace inside a string cannot end the object early.
 */
function firstBalancedObject(text: string): unknown {
  for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
      const char = text[i];

      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = !inString;
      } else if (!inString && char === '{') {
        depth++;
      } else if (!inString && char === '}') {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(text.slice(start, i + 1));
          } catch {
            break; // Not valid JSON. Try the next opening brace.
          }
        }
      }
    }
  }

  return null;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
