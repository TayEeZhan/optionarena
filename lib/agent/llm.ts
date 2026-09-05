import 'server-only';

/**
 * A thin adapter over whichever language model the team has access to.
 *
 * The rest of the agent talks to this interface only, so swapping provider is
 * a change in one file rather than a change everywhere.
 */

export interface LlmRequest {
  system: string;
  user: string;
  /** Keep responses short and deterministic. Strategy choice is not creative writing. */
  maxTokens?: number;
  /**
   * Text to put in the model's mouth, so the reply continues from it.
   *
   * Passing `{` is how the caller demands JSON and gets it: the model cannot
   * open with a preamble because its turn has already started mid-object. The
   * prefill is prepended back onto the reply, so callers see a whole document.
   */
  prefill?: string;
}

export interface Llm {
  name: string;
  complete(request: LlmRequest): Promise<string>;
}

/** Anthropic, the default provider. */
function anthropic(apiKey: string): Llm {
  return {
    name: 'anthropic:claude-sonnet-5',
    async complete({ system, user, maxTokens = 700, prefill }) {
      // Imported lazily so the package is only loaded when it is used.
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey });

      // No `temperature`: claude-sonnet-5 rejects it as deprecated, and sending
      // it failed every request with a 400 while the product quietly fell back
      // to the rule-based selector. Determinism comes from the prompt telling
      // the model to pick from a fixed shortlist, not from a sampling knob.
      const response = await client.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: maxTokens,
        system,
        messages: prefill
          ? [
              { role: 'user', content: user },
              { role: 'assistant', content: prefill },
            ]
          : [{ role: 'user', content: user }],
      });

      const text = response.content
        .map((block) => (block.type === 'text' ? block.text : ''))
        .filter(Boolean)
        .join('\n');

      // The prefill is not echoed back by the API, so put it back. Without
      // this the reply starts at the first field name and no parser can read
      // it as an object.
      return prefill ? prefill + text : text;
    },
  };
}

/**
 * The configured model, or null when no key is set.
 *
 * Null is a supported state, not a failure. OptionArena falls back to a
 * rule-based selector so the product runs with no configuration at all.
 */
export function getLlm(): Llm | null {
  const provider = (process.env.LLM_PROVIDER || 'anthropic').toLowerCase();

  if (provider === 'anthropic') {
    const key = process.env.ANTHROPIC_API_KEY;
    return key ? anthropic(key) : null;
  }

  // Another provider can be added here without touching the agent.
  return null;
}
