# AI Tools Declaration

Maintained from the first commit, as the hackathon rules require.
Every AI tool used on OptionArena is listed here.

| Tool | Model | What it was used for | When |
|---|---|---|---|
| Claude Code | Claude Opus 5 | Repo scaffold, Thetanuts SDK integration, decimals helpers, agent interpret/price/execute, signals lane, UI implementation | 31 Aug 2026 - ongoing |
| Claude Code | Claude Opus 5 | `docs/PRD.md`, `docs/proposals/arena-layer.md`, the navigation and custody-disclosure fix, README and this file | 31 Aug 2026 - ongoing |
| OpenAI Codex | Codex default model, not recorded at the time | Mobile-first interface: bottom tab bar, icon set, responsive header (`4ac3752`, PR #2) | 2 Sep 2026 |

Every commit above was authored by a named team member who read and tested the
output before committing. Attribution by lane is in the README team table.

## Runtime AI

OptionArena ships an LLM agent as part of the product. It reads a plain-language
market view and returns a structured, defined-risk options strategy.

| Where | Model | Purpose |
|---|---|---|
| `lib/agent/interpret.ts` | Claude (configurable via `LLM_PROVIDER`) | Natural language -> zod-validated strategy object |

The agent never invents prices. It selects an instrument; all pricing and maximum
loss come from the live Thetanuts book. See `docs/decisions.md`.

## Notes

- No AI-generated code was committed without being read and tested.
- Prompts are versioned as files in `lib/agent/prompts/`, not inline strings.
