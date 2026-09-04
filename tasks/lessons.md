# Lessons

Read this at the start of each session. Each entry is a rule that prevents a
recurrence, written after something went wrong.

---

## 1. Never assume a token's decimals. Read them from the order.

**What happened.** `decimals.ts` was written with a fixed set of quantities,
including `size: 18` for contract counts and an assumption that collateral is
USDC at 6. Both are wrong. A call's remaining size printed as
`4099251066830.090142 USDC` when the real value was `4.09 aBasWETH`, and a
contract count printed as `1.69e-12` when it was `1.69`.

**Why it matters.** The same code would have sent `2e-12 WETH` for a 2 USDC
budget. The magnitude assertion only catches this if it checks against the
*order's own* token.

**Rule.** Every amount is denominated by the collateral token on the order it
belongs to. Look it up by address, use its decimals, and pass those decimals
into `assertMagnitude`. Never hardcode 6, 8 or 18 anywhere outside the token
config.

**Corollary, derived not documented:** a contract count uses the same decimals
as the collateral token. It follows from `contracts * price / 1e8 == collateral`,
which holds exactly on every live order.

---

## 2. A field named like an identifier is not necessarily unique. Check.

**What happened.** `order.nonce` was used as the instrument id. On the live book,
72 maker-sell orders shared 13 distinct nonces, and one nonce covered 18
contracts across different strikes **and** expiries. Step 02 quoted an ETH 2350
put and the feed recorded an ETH 2250 put.

**Why it matters.** A user could approve one contract and fill a different one,
with real money.

**Rule.** Before matching on any id, count distinct values against real data. If
it is not unique, derive identity from the fields that define the thing.

---

## 3. Identity must be stable under normal market behaviour.

**What happened.** The fix for lesson 2 hashed price and nonce into the id. That
made it unique but useless: market makers requote about once a minute, so ids
expired within seconds and step 03 answered "that order is no longer on the
book" to users who had simply read the screen.

**Why it matters.** A correctness fix that makes the product unusable is not a
fix. It also hid a real problem behind a plausible error message.

**Rule.** Identity names the *thing*, not its current price. Handle price
movement as an explicit, tolerance-based slippage check at the point of
execution, which is the honest place for it.

---

## 4. If the interface names a unit, only offer instruments that use it.

**What happened.** Step 01 asks for a budget in USDC. The agent was free to pick
any buyable contract. It picked a BTC call, which is collateralised in cbBTC, so
the "5 USDC" budget became 5 cbBTC. The quote came back as a maximum loss of
`0.128 cbBTC`, roughly eleven thousand dollars, under a label saying USDC.

**Why it matters.** This is the decimals disaster wearing a product costume. No
individual conversion was wrong; the unit the user was promised simply was not
the unit being spent.

**Rule.** When the interface promises a unit, filter the instrument set to
instruments denominated in that unit. If you want to widen the set later, convert
through an explicit spot price and show the user the converted number.

---

## 5. Run it against the live system before building on top of it.

**All four lessons above were found by running `npm run book` and the real flow,
not by reading types.** Every one of them typechecked. Every one would have
passed a unit test written from the same wrong assumptions.

**Rule.** For anything touching the chain, the first proof is real output from
the real system, printed and read. Unit tests come after, to lock in what the
real system actually said.

---

## 6. When a dependency's helper returns zero, find out why before trusting it.

**What happened.** `calculateMaxPayout` and `calculatePayoutAtPrice` returned `0`
for every contract. It would have been easy to render a flat payoff diagram and
move on. The cause: those helpers do not cover physically settled
implementations, and every buyable order on Base is physically settled.

**Rule.** A zero, an empty array or a null from a dependency is a question, not
an answer. Find out whether it means "nothing" or "not supported", and say which
one in the code comment.

---

## 7. A graceful fallback hides the thing it is falling back from.

**What happened.** The agent had never run in production. Three bugs stacked: a
`temperature` parameter `claude-sonnet-5` rejects, so every call returned 400; a
600-character cap on `reasoning` that threw away otherwise-valid answers; and
`max_tokens: 700`, too small for a 40-instrument shortlist, truncating replies
into unparseable JSON. All three landed in the same place — the rule-based
selector, which is honest, clearly labelled and looks completely fine.

**Why it matters.** The fallback was *well built*. It degrades instead of
failing and says on screen that it did. That quality is exactly what let three
bugs live for days: nothing was ever red, and the deployment looked healthy.

**Rule.** A fallback needs a signal that distinguishes "not configured" from
"configured and failing", and someone has to look at it. Check behaviour, not
configuration — `decidedBy` naming a model is the only proof the agent ran. A
variable present in a dashboard proves nothing, and neither does a green deploy.

**Corollary.** When a call fails, read the provider's actual error before
ranking causes. The first diagnosis here was "probably no credit, top up $5";
the log said `temperature` is deprecated. The key and the balance were fine the
whole time. A ranked guess offered ahead of available evidence reads as a
finding and gets acted on — expand the log row first.
