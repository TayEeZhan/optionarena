# Architecture decisions

Each entry records what we chose, why, and what it rules out. Newest last.

---

## 1. Wallet layer: server-side signing

**Decided 31 Aug 2026. Team decision, taken before P1 as the brief requires.**

OptionArena signs server-side. The private key lives in the host's secret store,
is read only in `lib/thetanuts/client.ts`, and never reaches the browser. Every
module that can touch it imports `server-only`, so an accidental client import
is a build error rather than a leaked key.

**Why.** For a five-day build the alternative costs more than it returns. Every
user, including a judge on demo day, would need ETH on Base before anything
worked, and the demo would depend on their wallet and their gas. Server-side
signing gives instant onboarding and one controlled failure surface.

**What this means, stated plainly.** This is one wallet demonstrating a product,
not self-custody. We say so in the README and in the pitch rather than implying
custody we did not build. Judges will ask.

**What it rules out.** Users cannot trade from their own funds. Moving to
connected wallets later is a change in one file: the SDK's `encodeFillOrder`
already returns calldata for viem, wagmi or any connector.

---

## 2. Agent architecture: the SDK directly, with a thin model adapter

The brief framed this as MCP versus AgentKit. Reading the sponsor's own
material, that is a false choice:

- `@thetanuts-finance/mcp` is a **developer-time** context server. Its purpose is
  `get_sdk_context`, which loads the SDK's modules, types and gotchas into a
  coding agent. It is a tool for us while building, not a product architecture.
  The team should add it to their editor.
- `@thetanuts-finance/agentkit` implies an **autonomous** backend wallet acting
  without review. Our flow has a deliberate human decision at step 02, so an
  autonomous agent would remove the very thing the product is for.

So the product uses `@thetanuts-finance/thetanuts-client` directly, with a thin
model adapter in `lib/agent/llm.ts`. The agent chooses a contract; the human
approves the maximum loss; the agent then executes. That satisfies Track 2,
which requires the agent to place the trade, without pretending the human step
does not exist.

**The model never supplies a number.** It picks an `instrumentId` from a
shortlist of live orders and explains why. Every price, premium and maximum loss
comes from the book. Its answer is validated with zod and checked against the
shortlist, so it cannot name a contract that is not live.

---

## 3. Framework: Next.js App Router, built fresh

The brief says to port the Replit prototype and let the existing code win. The
prototype was not available on the build machine, so there was nothing to read a
`package.json` from. Rather than block, the interface was built to the visual
direction in brief section 10: persistent sidebar with a track-record card,
top-bar breadcrumb and mode indicator, two-column body, near-black with a green
cast, one lime accent, monospace for data.

The flow lives in `components/`, and the integration layer beneath it does not
depend on any of it. If the prototype turns up, it can replace the components
without touching `lib/`.

---

## 4. What is actually tradable on Base

Measured against the live book on 31 Aug 2026, not assumed. Reproduce with
`npm run book`.

| Question | Answer |
|---|---|
| Is the book live? | Yes. Around 295 resting orders, indexer lag 0 blocks |
| Which assets have resting **sell** orders? | ETH and BTC only |
| SOL, XRP, BNB, AVAX? | Bids only. They cannot be bought at all |
| What structures are buyable? | `PHYSICAL_PUT` and `PHYSICAL_CALL` |
| What is a put collateralised in? | `aBasUSDC`, 6 decimals |
| What is a call collateralised in? | `aBasWETH` (18dp) for ETH, `cbBTC` (8dp) for BTC |

This answers open question 5 in the brief. The prototype's assumption of ETH is
correct, and BTC works too. Building around SOL would have produced a product
that cannot fill.

---

## 5. Scope: the USDC side of the book

OptionArena asks for a budget in USDC and promises a maximum loss in USDC, so it
only offers contracts where that is literally true.

All 36 buyable puts are collateralised in `aBasUSDC`. Every buyable call is
collateralised in the asset it delivers. That is normal for physically settled
options, and it means a budget of `5` against a BTC call is 5 cbBTC, roughly
four hundred thousand dollars, not five dollars.

An early version had exactly that bug: a bullish view returned a maximum loss of
`0.128 cbBTC` while the interface said USDC. `fetchBuyable` now defaults to
USDC-collateralised orders.

**Consequence, stated honestly:** only puts are tradable today, so bearish and
protective views work and bullish views do not. The agent says so rather than
dressing a put up as a bullish trade.

**How to lift it:** convert the budget through a spot price and denominate per
instrument. That needs a spot source; `api.getMarketPrices()` was unavailable
during the build. This is the first thing to pick up in P2.

---

## 6. Decimals

Every token amount goes through `lib/thetanuts/decimals.ts`. No raw `parseUnits`
anywhere else. Amounts are bigint, formatting happens at the edge, and
`assertMagnitude` proves the order of magnitude before anything is signed.

The rule that is not documented anywhere and had to be derived: **a contract
count uses the same decimals as the collateral token.** It follows from the
identity `contracts * price / 1e8 == collateral`, which holds exactly on every
live order. A fixed contract-decimals constant is wrong, and using one made a
call's remaining size read as `4099251066830 USDC` instead of `4.09 WETH`.

---

## 7. Order identity

`order.nonce` is not an identifier. On the live book, 72 maker-sell orders shared
13 distinct nonces, and one nonce covered 18 contracts across different strikes
**and** expiries. Matching on it let step 03 fill a contract the user never saw.

Identity is now a hash of maker, implementation, collateral token, price feed,
strikes, expiry and option type: the fields that define the contract.

Price and nonce are deliberately **excluded**. A first fix included them, and
because makers requote about once a minute, ids expired within seconds and users
were told their order had gone. Price movement is handled where it belongs, as a
slippage check at step 03 with a 2% tolerance.

---

## 8. Persistence

`lib/db/store.ts` is one interface with two implementations. The file store means
the product runs with no configuration at all. `PostgresStore` takes over as soon
as `DATABASE_URL` is set. Nothing above that file knows which is in use.

**Postgres is required in production, not optional.** Vercel's filesystem is
read-only and per-invocation, so the file store silently loses every strategy on
the deployed URL: the feed and leaderboard would be empty for the judges. This
was nearly shipped as a working local demo with a broken deployment.

Drizzle with the Neon HTTP driver, because it works in a serverless function
without holding a connection open between invocations. Schema in
`lib/db/schema.ts` covers `strategies`, `signals` and `users`, so the P3 signals
lane starts against a real table rather than inventing one mid-week.

Amounts are stored as `text`, deliberately. They are exact decimal strings from
`decimals.ts`, and a float column would reintroduce the rounding error that whole
module exists to prevent.

Remaining for the data lane: provision the database, run `npm run db:push`, and
set `DATABASE_URL` in Vercel.

---

## 9. Evidence of a real mainnet fill

**Status: not yet placed.** This section is the one the submission depends on.

The whole path is built and every check short of the signature has been run
against the live book. `npm run verify:fill` performs a dry run: it prices a real
contract, proves the magnitude, checks the balance and the allowance, and
simulates the fill with `callStaticFillOrder` against live chain state.

To complete it, someone on the team with the funded key runs:

```bash
npm run verify:fill -- --live --budget 1
```

Then paste the result here:

```
Transaction hash:
Basescan:
Block:
Spent:
Date:
```

Until that hash is in this file, the Track 2 entry is not yet valid.

---

## 10. Tooling added for a four-person week

Chosen to remove friction between four people on one repo, not to add ceremony.

| Addition | What it prevents |
|---|---|
| `.gitattributes` with `eol=lf` | Windows and macOS machines rewriting whole files and making merges unreadable |
| ESLint with custom rules | `parseUnits` imported outside `decimals.ts`, and `any` in code that moves money |
| Prettier and `.editorconfig` | Formatting arguments in review, and diffs full of whitespace |
| Husky and lint-staged | Unformatted or failing code reaching a branch someone else pulls |
| GitHub Actions CI | A broken `main` discovered on demo day. Also fails on a committed key |
| Drizzle and Neon Postgres | The deployed feed silently losing every strategy |
| `next/font` | An external font request on load, and a flash of unstyled text on venue wifi |
| sonner | Execution outcomes that are easy to miss on a projector |
| `vercel.json` | A mainnet fill timing out at the default function limit |

**Deliberately not added.** A component library, because the visual direction is
pinned and shadcn would fight it. A data-fetching library, because the flow makes
two POST requests and TanStack Query would be more code for less clarity. A state
manager, because the only shared state is the demo/live mode and React context
already holds it.

The single most important line here: **`DATABASE_URL` must be set in production.**
Vercel's filesystem is read-only and per-invocation, so the file store loses
everything on the deployed URL. Locally it needs no configuration at all.
