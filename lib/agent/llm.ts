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
}

export interface Llm {
  name: string;
  complete(request: LlmRequest): Promise<string>;
}

/** Anthropic, the default provider. */
function anthropic(apiKey: string): Llm {
  return {
    name: 'anthropic:claude-sonnet-5',
    async complete({ system, user, maxTokens = 700 }) {
      // Imported lazily so the package is only loaded when it is used.
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey });

      const response = await client.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: maxTokens,
        temperature: 0,
        system,
        messages: [{ role: 'user', content: user }],
      });

      return response.content
        .map((block) => (block.type === 'text' ? block.text : ''))
        .filter(Boolean)
        .join('\n');
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
