import { describe, expect, it } from 'vitest';

import { extractJson } from '../interpret';

/**
 * Reading the model's answer.
 *
 * Production was falling back to the rule-based selector with "model returned
 * an unusable answer" — the branch where the call succeeded and the reply would
 * not parse. These are the shapes a model actually returns, and every one of
 * them has to survive, because failing here silently throws away a valid
 * contract choice and quietly downgrades the product to a heuristic.
 */

const CHOICE = {
  instrumentId: 'ae38cb234f1fe61345930959',
  reasoning: 'A put at 2300 expresses a bearish view on ETH.',
  direction: 'bearish',
  confidence: 0.7,
};

describe('extractJson', () => {
  it('reads a bare object', () => {
    expect(extractJson(JSON.stringify(CHOICE))).toEqual(CHOICE);
  });

  it('reads a fenced object', () => {
    expect(extractJson('```json\n' + JSON.stringify(CHOICE) + '\n```')).toEqual(CHOICE);
  });

  it('reads an unlabelled fence', () => {
    expect(extractJson('```\n' + JSON.stringify(CHOICE) + '\n```')).toEqual(CHOICE);
  });

  it('ignores a closing remark after the object', () => {
    const reply = JSON.stringify(CHOICE) + '\n\nLet me know if you want a different strike.';
    expect(extractJson(reply)).toEqual(CHOICE);
  });

  it('ignores a preamble before the object', () => {
    expect(extractJson('Here is my choice:\n\n' + JSON.stringify(CHOICE))).toEqual(CHOICE);
  });

  // The regression. Slicing from the first `{` to the last `}` spanned from the
  // brace in the prose to the brace in the sign-off, and JSON.parse threw.
  it('ignores braces in prose on either side of the object', () => {
    const reply =
      'The shortlist uses {id} placeholders, so I copied the id exactly.\n' +
      JSON.stringify(CHOICE) +
      '\nReplace {strike} if you want another one.';
    expect(extractJson(reply)).toEqual(CHOICE);
  });

  it('keeps a brace that is inside a string', () => {
    const withBrace = { ...CHOICE, reasoning: 'A put at 2300 {the strike} suits a bearish view.' };
    expect(extractJson('Answer:\n' + JSON.stringify(withBrace))).toEqual(withBrace);
  });

  it('keeps an escaped quote inside a string', () => {
    const quoted = { ...CHOICE, reasoning: 'The view says "ETH drops", so a put fits.' };
    expect(extractJson(JSON.stringify(quoted))).toEqual(quoted);
  });

  it('reads the object when the model prefaced it with a broken fragment', () => {
    const reply = 'I considered {ETH 2400 Put} first.\n\n' + JSON.stringify(CHOICE);
    expect(extractJson(reply)).toEqual(CHOICE);
  });

  it('returns null when the reply is truncated mid-object', () => {
    expect(extractJson('{"instrumentId": "abc", "reasoning": "cut off here')).toBeNull();
  });

  it('returns null when there is no object at all', () => {
    expect(extractJson('I could not find a suitable contract.')).toBeNull();
  });

  it('returns null for an empty reply', () => {
    expect(extractJson('')).toBeNull();
  });
});
