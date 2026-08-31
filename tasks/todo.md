# OptionArena — plan and progress

Submission closes **5 Sep 2026, 11:59 PM MYT**. Pitch at APU on 6 Sep.

---

## P0 — prove it works at all

- [x] Initialise the repo, first commit with `.env` already gitignored
- [x] Confirm the SDK is real and the book is live (295 orders, indexer lag 0)
- [x] Build `scripts/verify-fill.ts` with every pre-flight check
- [x] Prove the path short of signing: price, magnitude, balance, allowance,
      `callStaticFillOrder` against live chain state
- [ ] **Place one real trade on Base mainnet** — needs a funded key
- [ ] **Record the hash in `docs/decisions.md`** as evidence

> Until the hash exists, the Track 2 entry is not valid. This is the single
> highest-priority item in the project.

## P1 — make the interface real

- [x] Workspace shell: sidebar, top bar, mode indicator, track-record card
- [x] Step 01 Describe: free text, budget, risk level, example chips
- [x] Step 02 Preview: real pricing, real maximum loss, payoff diagram, breakeven
- [x] Step 03 Prove: transaction hash with a live Basescan link
- [x] Step 04 Share: executed strategies join the feed
- [x] Market pulse from the live indexer, replacing the mock
- [x] Demo mode as the default, with an unmissable live distinction
- [ ] Port the Replit prototype's visuals over the current components, if the
      team wants the original look. The integration layer does not depend on them

## P2 — the agent executes

- [x] `interpret.ts`: plain language to a zod-validated choice from live orders
- [x] `quote.ts`: price that choice against the real book
- [x] `execute.ts`: the agent places the order behind seven checks
- [x] Versioned prompt files, not inline strings
- [x] Rule-based fallback that labels itself when no model is configured
- [ ] Set `ANTHROPIC_API_KEY` and compare the model against the fallback
- [ ] Find a working spot-price source. `api.getMarketPrices()` was unavailable,
      which is what currently blocks denominating a budget for calls

## P3 — the differentiator

- [ ] Deribit adapter: public API, trade history, identify the right endpoints
- [ ] Decide what "winning trade" means concretely: resolved P&L or inferred
- [ ] `rank.ts`: risk-adjusted scoring, never raw percentage gain
- [ ] `map.ts`: external instrument to nearest Thetanuts instrument
- [ ] **Validate the mapping before building the copy interface.** Thetanuts has
      ETH and BTC puts on a handful of expiries. If Deribit's liquid contracts do
      not map onto that, the copy feature needs rethinking
- [ ] Feed and leaderboard populated with sourced data
- [ ] Copy flow: select a sourced strategy, agent maps and executes it

## P4 — submit

- [x] README with description, problem, chain, contract addresses, setup, team
- [x] `AI_TOOLS.md` maintained from the first commit
- [ ] Fill in team names in the README
- [ ] Deploy to Vercel and keep the URL working. **Do not leave this to 5 Sep**
- [ ] Demo video, 3 to 5 minutes
- [ ] **Record a backup video of a successful live trade.** Play it if the live
      attempt hangs on stage
- [ ] Confirm whether Devfolio takes both tracks as one submission or two
- [ ] Rehearse the five-minute pitch out loud, with a timer

---

## Open questions still to resolve

| # | Question | Status |
|---|---|---|
| 1 | Does Devfolio handle both tracks as one submission? | Open |
| 2 | Which venues can we pull trade data from, and what is a "winning" trade? | Open |
| 3 | Do Deribit's liquid contracts map onto Thetanuts' Base book? | Open, blocks P3 |
| 4 | MCP or AgentKit? | **Resolved** — neither. See `docs/decisions.md` §2 |
| 5 | Which assets have real quotes? | **Resolved** — ETH and BTC. §4 |
| 6 | Wallet layer? | **Resolved** — server-side signing. §1 |
| 7 | What framework is the prototype on? | Unresolved, prototype unavailable. §3 |

---

## Review — 31 Aug 2026

Built the repo from nothing to a working product on the live book: the SDK
integration, decimals with tests, the agent, the execution path with its checks,
the four-step interface, feed, leaderboard and profile.

Three bugs were found by running against the live book rather than by reasoning
about it, and all three would have cost real money. They are written up in
`tasks/lessons.md` and `docs/decisions.md`.

The honest gap: no real fill has been placed, because that needs a funded key.
Everything up to the signature is proven.
