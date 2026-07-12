# Autonoe — Demo Day stage script

**Tagline:** *You don't trust the strategy — you trust the verified record.*

**One-liner:** Autonoe turns an AI trading desk into a panel of debating agents whose every decision is **executed and logged on-chain on HashKey Chain** — so an agent's track record is auditable even when its strategy stays private.

Track: AI · HashKey Chain Horizon Hackathon. The pitch leans on what scores: **transparency / verifiability** and **real on-chain execution**, not raw PnL.

---

## Before you go on stage (setup checklist)
- [ ] Backend running (`bun src/index.ts`) + web on `:3000`.
- [ ] At least one provider API key set in **Settings** (Mistral/Groq/etc.).
- [ ] Agent wallet **created + unlocked**, funded via the **mUSD faucet** (so `/trade` + Studio show real balances).
- [ ] A little HSK for gas in the agent wallet.
- [ ] Open tabs in order: **Studio → History → Trade**. HashKey explorer tab ready.
- [ ] Do a dry-run trade beforehand so History already has ≥1 fully-enriched row (explorer link + model attribution) to point at.

## The 4-minute path (only touch the REAL surfaces)

1. **Frame the problem (20s).** Retail traders can't verify a bot's track record without seeing its strategy. Autonoe separates the two: private strategy, **public verifiable record**.

2. **Connect + fund (20s).** Connect external wallet → **fund the agent wallet** (mUSD faucet). Show the balance update — these are real on-chain balances, not mock numbers.

3. **Studio — thesis (45s).** Type an intent (e.g. *"medium-term view on WMNT"*). Hit **Generate**. Narrate the live "thinking" trace: real LLM tool-calls pulling **live Bybit data**. Out comes a multi-option, risk-tiered thesis.

4. **Studio — tribunal (45s).** Send an option **To Judge**. Show the turn-taking debate — **Supporter ↔ Discriminator**, then the **Judge** verdict. This is the differentiator: not one model's opinion, a cross-examined one.

5. **Execute → on-chain (40s).** Click **Execute** on the judged option. The agent wallet signs and broadcasts to **HashKey Chain**. Open the tx on the **HashKey explorer**. For WMNT it's a real AMM swap; for BTC/ETH/SUI/SOL an oracle-priced synthetic position. Either way it also writes a **DecisionLog** entry.

6. **History — the payoff (40s).** Go to **History**. The decision is now an **on-chain verified record**: explorer link, source (AI/Human), and **which models produced it**. **Leaderboard** ranks models by their real track record. Land the tagline here.

7. **Trade terminal (20s, optional).** Show `/trade` as the live market terminal — real Bybit prices, **real wallet balances**. Execute on **WMNT** if you want a second live tx.

## Honesty guardrails (what the rubric rewards)
- **Don't click long-tail tokens' Execute on `/trade`** — they're correctly labelled **"advice-only · not executable on-chain"** (only WMNT + the 4 synthetics execute). Lean into this: it's a deliberate, honest scope, not a limitation to hide.
- **PnL shows `0.00` at entry** — decisions are logged at open; realized PnL needs a settlement step (roadmap). Say so plainly; the *record's existence and auditability* is the point, not the number.
- Everything labelled "not financial advice" is intentional.

## If asked "what's real vs roadmap?"
- **Real today:** multi-agent tribunal, human-confirmed execution, AMM + synthetic on-chain trades, DecisionLog commit-reveal, model attribution, HashKey explorer links.
- **Roadmap:** automated PnL settlement, additional oracle sources, portfolio-level risk caps.
