<div align="center">

# Autonoe

### Verifiable AI trading on HashKey Chain. Cross-examined decisions, executed on-chain, provable forever.

*You do not trust the strategy. You trust the verified record.*

![HashKey Chain](https://img.shields.io/badge/HashKey-Chain-0066FF?style=flat-square)
![Runtime](https://img.shields.io/badge/runtime-Bun-111111?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-16%20·%20React%2019-black?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square)
![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?style=flat-square)
![Hackathon](https://img.shields.io/badge/HashKey-Horizon%20Hackathon%20Japan-F5A524?style=flat-square)

</div>

---

Most AI trading bots are black boxes: you are told a model is profitable, but you cannot verify which model made which call, or whether the record was edited after the fact. Autonoe fixes that.

An AI agent researches the market and produces a multi-option trading thesis. A three-agent tribunal (Supporter, Discriminator, Judge) cross-examines it. An embedded agent wallet executes the chosen option as a real on-chain trade on HashKey Chain. Every decision is committed on-chain with a commit-reveal hash, so anyone can later prove which AI produced a winning call, locked in before the outcome was known.

> Built for the HashKey Chain Horizon Hackathon, Japan. AI track.

---

## Why Autonoe is different

| | |
|---|---|
| Cross-examined, not one-shot | Every thesis can be sent to a tribunal where a Discriminator is required to argue the bear case before a Judge rules. |
| Provable AI attribution | The on-chain `thesisHash` is a commit-reveal of the canonical payload including which models produced the call. |
| Auditable model track record | Every trade records which model played which role. The Model Leaderboard ranks providers by on-chain-anchored performance. |
| Actually on HashKey Chain, end to end | Real AMM swaps, oracle-signed synthetic positions, a DecisionLog contract, and an embedded agent wallet. |
| Risk controls, not runaway bots | Mandatory bear case, spending cap, token allow-list, stop-loss, explicit Hold, and human confirmation on every trade. |

---

## How it works

1. **Intent** — describe a market view or use chat intake to scope asset, size, risk, and horizon.
2. **Thesis** — a LangChain agent calls real tools (on-chain AMM state, Bybit candles, technical indicators, optional news) and returns risk-tiered options.
3. **Tribunal** — Supporter and Discriminator debate; the Judge issues refined options with confidence.
4. **Execute** — the embedded agent wallet signs a real trade on HashKey Chain after you confirm.
5. **Record** — the decision is committed on-chain to `DecisionLog`, then surfaced on history with explorer links, model attribution, and one-tap verify.

---

## Tech stack

- **Contracts:** mUSD, wrapped native HSK, AMM factory/router, signed-price oracle, synthetic exchange, decision log
- **Agents:** multi-provider LLM tribunal (Mistral, Groq, Gemini, OpenRouter, and more)
- **Frontend:** Next.js 16, React 19, embedded agent wallet
- **Runtime:** Bun workspaces monorepo

---

## Quick start

```bash
bun install
cp .env.example .env
# Fill provider keys and deployer keys in .env
bun run build:packages
```

See `RUNNING.md` for local dev, `plan.md` for the HashKey Chain migration plan, and `DEMO.md` for the demo flow.

---

## Hackathon fit

**Track:** AI. Autonomous trading agents and AI-driven on-chain execution.

**Chain:** HashKey Chain (OP-Stack EVM L2, native token HSK).

---

## License

MIT
