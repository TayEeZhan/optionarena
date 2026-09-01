# OptionArena — project context

A social options desk on Thetanuts Finance V4, Base mainnet. Plain-language view
in, defined-risk options position out, executed on-chain with a verifiable hash.

The full build brief this project follows is `optionsarena.md` (kept outside the
repo). Architectural decisions and their reasoning live in `docs/decisions.md`.
Read `tasks/lessons.md` at the start of every session.

`docs/PRD.md` is what the product is *for*: every feature's pipeline (§3), the
rules a new pipeline follows (§3.9), the interface direction (§4.3) and the
non-negotiables (§4.7). Read §3 before building a pipeline and §4.3 before
touching the interface. Where it and `docs/decisions.md` disagree, decisions
wins; where it and `tasks/todo.md` disagree about what to do next, todo wins.

## Stack

- Next.js 16 App Router, TypeScript, Tailwind v4
- `@thetanuts-finance/thetanuts-client` v0.3.0 with ethers v6
- zod for anything the model returns
- vitest for unit tests
- Node 20 or newer

## Commands

```bash
npm run dev           # dev server, port 5190
npm run book          # inspect the live book, no key needed
npm run verify:fill   # dry run of a real fill; add -- --live to sign
npm test              # unit tests
npm run typecheck     # tsc --noEmit
npm run build         # production build
```

Scripts run with `--conditions=react-server` so the `server-only` guard resolves
outside the bundler. Keep that flag on any new script that imports from `lib/`.

## The decimals rule

**Every token amount goes through `lib/thetanuts/decimals.ts`.** No raw
`parseUnits` anywhere else.

- Amounts are `bigint`, never a JavaScript number
- Format for display at the last possible moment
- `assertMagnitude` before anything is signed
- **Decimals come from the order's own collateral token.** Never hardcode 6, 8
  or 18. Puts settle in aBasUSDC (6dp), ETH calls in aBasWETH (18dp), BTC calls
  in cbBTC (8dp)
- A contract count uses the **same decimals as its collateral token**

## Security rules

- `.env` is gitignored and has been since the first commit. Never commit a key
- Server-side signing only. The key is read in `lib/thetanuts/client.ts` and
  nowhere else. Modules that can reach it import `server-only`
- Use a fresh wallet made only for this project, funded with the minimum
- `MAX_TRADE_USDC` caps a single trade. Never let a code path's first run be a
  large trade
- We deploy no contracts. Deploying our own with real funds is an instant
  disqualification

## Hackathon constraints

- No commit may predate 26 Aug 2026
- Every AI tool used must be declared in `AI_TOOLS.md`, maintained from commit one
- The submission needs a live demo URL and a real mainnet transaction hash

## How to work here

- Plan before building anything non-trivial. Write the plan to `tasks/todo.md`
- Never mark a task complete without proving it works. For anything touching the
  chain, prove it with real output from the real system, not a passing unit test
- After any correction, append the rule to `tasks/lessons.md`
- Plain language in code comments, docs and interface copy
