# OptionArena — plan and progress

Submission closes **5 Sep 2026, 11:59 PM MYT**. Pitch at APU on 6 Sep.

---

## P0 — prove it works at all

- [x] Initialise the repo, first commit with `.env` already gitignored
- [x] Confirm the SDK is real and the book is live (295 orders, indexer lag 0)
- [x] Build `scripts/verify-fill.ts` with every pre-flight check
- [x] Prove the path short of signing: price, magnitude, balance, allowance,
      `callStaticFillOrder` against live chain state
- [x] Fund the key — 1 aBasUSDC and gas are on Base, and the OptionBook
      allowance is granted on-chain (`0x39dcfb41…`, an approval, not a fill)
- [ ] **Place one real trade on Base mainnet** — **blocked inside the
      protocol**, not on our side. Every buyable order is physically settled
      and reverts with `Panic(0x11)` in the OptionBook. Seven hypotheses ruled
      out, including the allowance. See `docs/decisions.md` §14
- [x] **Record the evidence in `docs/decisions.md`** — §14, with the decoded
      calldata and the approval hash

> The blocker changed on 5 Sep. It was "no funded key"; it is now "the
> physically settled side of the book does not fill for a taker". Money will
> not solve it and neither will more simulation — the next move is asking the
> Thetanuts team whether that path is fillable today.
>
> Until a fill exists the Track 2 entry rests on the diagnosis rather than on a
> hash. Do not describe the approval transaction as a trade.

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

- [x] Deribit adapter: public API, no key needed, `lib/signals/sources/deribit.ts`
- [x] Decide what "winning trade" means: the user picks from four criteria
- [x] `rank.ts`: four criteria, notional floor, a stated reason per signal
- [x] `map.ts`: nearest Thetanuts instrument with every difference disclosed
- [x] **Validate the mapping.** 39/39 exact from the Thetanuts side. See §11
- [ ] Persist sourced signals to the `signals` table instead of fetching each time
- [ ] Build the signals UI: criterion chooser, ranked list, differences panel
- [ ] Feed and leaderboard populated with sourced data
- [ ] Copy flow: select a sourced strategy, agent maps and executes it

## P4 — submit

- [x] README with description, problem, chain, contract addresses, setup, team
- [x] `AI_TOOLS.md` maintained from the first commit
- [ ] Fill in team names in the README
- [ ] **Provision Postgres (Neon or Supabase) and run `npm run db:push`.** The
      deployed feed loses everything without it, see `docs/decisions.md` §8
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
| 1 | Does Devfolio handle both tracks as one submission? | **Resolved** — one submission, both tracks |
| 2 | Which venues, and what is a "winning" trade? | **Resolved** — Deribit public API; the user picks from four criteria. §12 |
| 3 | Do Deribit's contracts map onto Thetanuts' book? | **Resolved** — yes, 39/39 exact one way. §11 |
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
