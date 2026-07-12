---
title: Autonoe team task board
purpose: Shared async task tracker for the 4-person team — humans and their AI agents
last_updated: 2026-06-03
---

# TODO

Single source of truth for what's in flight on **Autonoe** (see [PRD.md](PRD.md)). Anyone — human or AI agent — can pick pending tasks, add new ones, or release stale ones.

## How to use this file (90-second version)

1. **Find a pickable task** — `Status: pending` AND every entry in `Depends-on` is `done`.
2. **Claim** — change `Status: pending` → `Status: in-progress @your-handle YYYY-MM-DD`. Commit *only that line* on a branch `claim/T-XXX-<slug>`, push, open a PR titled `claim: T-XXX`. **Merging that claim PR is the lock** (we don't run auto-merge — merge it yourself once CI is green; it's a one-line diff).
3. **Work** — branch from `main` into `feat/T-XXX-<slug>` (or `fix/`, `docs/`). Reference `T-XXX` in every commit and the implementation PR title.
4. **Finish** — the same PR that merges the work flips the line to `Status: done @your-handle YYYY-MM-DD` and moves the task block to the **Done** section at the bottom.
5. **Stuck** — change to `Status: blocked — <one-line reason>` and ping the Telegram channel. Keep the entry; don't delete it.
6. **Add a task** — append a block under the right section using the next free ID. State `Acceptance` clearly so anyone can pick it up cold.
7. **Drop a claim** — flip back to `Status: pending`. PR title `unclaim: T-XXX`.

### Stale-claim rule

If a task is `in-progress` for **more than 5 days with zero commits referencing its ID**, anyone may revert it to `pending` and re-claim. Add a `Reverted: <date> by @you — reason` line for the paper trail. You may also `override:` a claim earlier with concrete reason (conflict / blocking your work).

### Solo / no-review fast path

Working alone with no reviewer? Edit `TODO.md` directly on `main`, push (the push is the lock), then start the implementation branch. Don't skip the visible status change — teammates watch the Telegram feed.

## Conventions

| Thing | Convention |
|---|---|
| Branch | `feat/T-XXX-<slug>` / `fix/T-XXX-<slug>` / `docs/T-XXX-<slug>` / `claim/T-XXX-<slug>` |
| Commit | `T-XXX: <verb> <object>` (e.g. `T-102: add mUSD faucet with cooldown`) |
| PR title | `T-XXX — <task title>` (claim/unclaim/override PRs use the `claim:`/`unclaim:`/`override:` prefix) |
| PR body | Link the TODO line; check off Acceptance criteria |
| Scope per PR | One task = one PR. If it balloons, stop and split — the new thing gets its own T-XXX |
| Package manager | **bun** only (`bun install`, `bun --filter '*' test`). Never npm/yarn/pnpm |
| Network | All on-chain work targets **Mantle Sepolia (chain 5003)** |

## Team

> **Team channel:** Telegram group (bot token + chat id live as repo secrets `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`). Notification workflow: [`.github/workflows/telegram-notify.yml`](.github/workflows/telegram-notify.yml) — posts on PR open / conflict / merge / push to main, plus a "today's tally" leaderboard. CI: [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

| Handle | OS | Preferred area | Status |
|---|---|---|---|
| `@____` | TBD | Contracts & chain (Track 1) | fill before first claim |
| `@____` | TBD | Backend + agents (Track 2) | fill before first claim |
| `@____` | TBD | Wallet + execution (Track 3) | fill before first claim |
| `@____` | TBD | Frontend UI (Track 4) | fill before first claim |

## Active claims

`grep "Status: in-progress" TODO.md` to see who's on what.

## Sections

0. [Foundations](#0--foundations) — `T-0xx` — monorepo, shared contracts (done)
1. [Contracts & Chain](#1--contracts--chain) — `T-1xx` — Solidity/Hardhat + viem
2. [Backend, Proxy & Agents](#2--backend-proxy--agents) — `T-2xx` — Express, provider proxy, LangChain.js
3. [Wallet & Execution](#3--wallet--execution) — `T-3xx` — embedded EOA, swaps
4. [Frontend UI](#4--frontend-ui) — `T-4xx` — 5 routes + wallet drawer
5. [Infra / DevOps / Docs](#5--infra--devops--docs) — `T-5xx`
6. [Integration & Demo](#6--integration--demo) — `T-6xx`
7. [Done](#done)
8. [Blocked](#blocked)

### Status legend
- `pending` — anyone with deps cleared can pick
- `in-progress @handle YYYY-MM-DD` — locked
- `review` — implementation PR open, awaiting review
- `blocked — <reason>` — stuck
- `done @handle YYYY-MM-DD` — completed; move block to Done

> **Interface contracts are frozen in [PRD.md §12](PRD.md).** Build against them and mock what isn't ready, so all four tracks run in parallel.

---

## 0 — Foundations

_(All done — the shared base every track builds on.)_

---

## 1 — Contracts & Chain

> Solidity/Hardhat + the viem library other tracks call. Independent of tracks 2–4 after Foundations.

### T-101 — Hardhat project + Mantle Sepolia config
- Status: done @manjeet_s 2026-06-05 — `contracts/` Hardhat (solc 0.8.24, viaIR, evmVersion paris for L2), `mantleSepolia` (5003) network from env; `npx hardhat compile` green. `contracts` added to root workspaces.
- Depends-on: —
- Scope: contracts
- Acceptance: `contracts/` with `hardhat.config.ts`; `npx hardhat compile` passes; network `mantleSepolia` (5003) configured from `DEPLOYER_PRIVATE_KEY` + RPC env. Add `contracts` to root `workspaces`.

### T-102 — `mUSD` stablecoin
- Status: done @manjeet_s 2026-06-05 — `contracts/contracts/mUSD.sol` (6-dec ERC-20, `faucet()` cooldown+cap, `ownerMint`); tests pass.
- Depends-on: T-101
- Scope: contracts
- Acceptance: `contracts/contracts/mUSD.sol` — ERC-20, 6 decimals; `faucet()` mints a fixed amount with per-address cooldown + cap; `ownerMint()` for seeding. Hardhat tests pass.

### T-103 — `WMNT` wrapper (hybrid: real AMM asset only)
- Status: done @manjeet_s 2026-06-05 — `WMNT.sol` (WETH-style deposit/withdraw); wrap/unwrap test passes.
- Depends-on: T-101
- Scope: contracts
- Acceptance: `WMNT.sol` (WETH-style deposit/withdraw wrapper), 18-dec. Tests pass. (Hybrid decision 2026-06-05 — `MockBTC`/`MockETH` are **no longer deployed**; all non-WMNT assets are oracle-priced synthetics, see T-110/T-111.)

### T-104 — Uniswap V2 fork (single `mUSD/WMNT` pool)
- Status: done @manjeet_s 2026-06-05 — `contracts/contracts/amm/{AmmFactory,AmmPair,AmmRouter}.sol`: V2-style constant-product AMM (0.30% fee, `addLiquidity`/`swapExactTokensForTokens`/`getAmountsOut`/`quote`). Note: a faithful **V2-style minimal** impl (not the canonical 0.5.16 fork) for a clean 0.8.24/paris compile + to avoid the init-code-hash pitfall — same external surface the chain lib (T-108) expects. createPair + addLiquidity + swap tested.
- Depends-on: T-103
- Scope: contracts
- Acceptance: canonical Uniswap V2 core + periphery (Factory, Router02) compiled with WMNT as WETH; the `mUSD/WMNT` `createPair` + quote works in a Hardhat test.

### T-105 — `DecisionLog` contract
- Status: done @manjeet_s 2026-06-05 — `DecisionLog.sol` (`logDecision` with signed `pnl`, per-user history, getters, event); tested incl. negative pnl.
- Depends-on: T-101
- Scope: contracts
- Acceptance: `DecisionLog.sol` with `logDecision(thesisHash, verdictHash, asset, amountIn, amountOut, pnl, optionRef)` emitting an event + storing a per-user history; getters; tests pass.

### T-110 — `PriceOracle` (signed-pull) — NEW (hybrid)
- Status: done @manjeet_s 2026-06-05 — `PriceOracle.sol` (ECDSA `ecrecover`, chainid+address-bound digest, maxAge freshness, owner signer rotation); tests cover valid / wrong-signer / stale / tampered.
- Depends-on: T-101
- Scope: contracts
- Acceptance: `PriceOracle.sol` verifies a server-signed price attestation `{symbol, price, timestamp}` via `ecrecover` against a configurable trusted signer; rejects stale (beyond a max-age) or wrong-signer attestations; owner can rotate the signer. Tests cover valid/stale/forged cases. (Pyth-style pull oracle — no standing keeper; price is supplied with the trade.)

### T-111 — `SyntheticExchange` (mUSD clearing house) — NEW (hybrid)
- Status: done @manjeet_s 2026-06-05 — `SyntheticExchange.sol` (open/close long+short, oracle-verified entry/close, house reserve payout, market registry); tests: long profit, short profit, long loss, insufficient-reserve revert, unknown-market revert.
- Depends-on: T-102, T-110
- Scope: contracts
- Acceptance: `SyntheticExchange.sol` — `openPosition(symbol, direction, sizeMUSD, priceAttestation)` pulls mUSD from the trader and stamps entry price (verified via `PriceOracle`); `closePosition(id, priceAttestation)` settles `pnl = sizeMUSD × Δprice × directionSign` in mUSD from a treasury-funded **house reserve**; supports `long`/`short`; per-user position storage + getters; guards (house solvency, position ownership). Hybrid tests: long profit, short profit, loss, insufficient-reserve revert.

### T-106 — Deploy + seed script
- Status: done @manjeet_s 2026-06-05 — `contracts/scripts/deploy.ts` deploys all 7 contracts, seeds `mUSD/WMNT`, funds house reserve, registers BTC/ETH/SUI/SOL, writes `packages/chain/addresses.json`. Validated end-to-end on the local Hardhat network. **Live Mantle Sepolia run + ABI export + verify lands in T-107 (needs a faucet-funded `DEPLOYER_PRIVATE_KEY`).**
- Depends-on: T-102, T-103, T-104, T-105, T-110, T-111
- Scope: contracts
- Acceptance: `contracts/scripts/deploy.ts` deploys mUSD + WMNT + factory + router + DecisionLog + PriceOracle + SyntheticExchange, creates **and seeds** the `mUSD/WMNT` pair, **funds the SyntheticExchange house reserve** with mUSD, sets the oracle trusted signer, registers the synthetic market list (BTC/ETH/SUI/SOL), and prints all addresses.

### T-107 — Export addresses + ABIs
- Status: done @manjeet_s 2026-06-05 — **deployed live to Mantle Sepolia (5003)**: all 7 contracts + the `mUSD/WMNT` pool. On-chain state verified (pool 2000 mUSD/2 WMNT, 100k mUSD house reserve, BTC/ETH/SUI/SOL registered); all contracts **verified on Sourcify**. Helper scripts: `scripts/{check,verify-state,export-abis}.ts`. Note: mantlescan's Etherscan-style verify now needs a paid V2 API key — Sourcify used instead (keyless); set `MANTLESCAN_API_KEY` later for a mantlescan badge.
- Depends-on: T-106
- Scope: chain
- Acceptance: live Mantle Sepolia addresses written to `packages/chain/addresses.json` (incl. `oracle`, `syntheticExchange`, `oracleSigner`, `pools.mUSD_WMNT`, `syntheticMarkets`; no `MockBTC`/`MockETH`) and ABIs to `packages/chain/abis/`; contracts verified.

### T-108 — viem chain library
- Status: done @manjeet_s 2026-06-05 — `packages/chain/src/{clients,abis,addresses,swapExecutor,syntheticExecutor,decisionLog}.ts`. AMM `getQuote`/`swap` (approve+slippage+receipt check); synthetic `openSynthetic`/`closeSynthetic`/`signPriceAttestation`/`priceToX18`/`getOracleConfig`; `writeDecision`/`readHistory`. **Live integration verified on testnet**: real 500 mUSD→WMNT swap + synthetic BTC long open→close (pnl +100 mUSD / payout 1100). Offline unit test (`sign.test.ts`) covers attestation recovery. tsc -b green.
- Depends-on: T-107
- Scope: chain
- Acceptance: `packages/chain/src/{clients,swapExecutor,syntheticExecutor,decisionLog}.ts` — AMM: `getQuote()`, `swap()` (approve + `swapExactTokensForTokens` + slippage). Synthetic: `openSynthetic()` / `closeSynthetic()` (submit signed price attestation), `getOraclePrice()`. Plus `writeDecision()`, `readHistory()`. Integration tests execute a real `mUSD/WMNT` swap **and** a synthetic open/close on testnet.

### T-109 — Register synthetic markets (was: extra pools)
- Status: pending
- Depends-on: T-106
- Scope: contracts
- Acceptance: a config-driven `registerMarkets.ts` adds synthetic markets (BTC/ETH/SUI/SOL, extendable) to `SyntheticExchange` + the exported `syntheticMarkets` list — no per-asset contract or liquidity seeding. (Trivial now; this is the "trade whatever pairs" lever.)

---

## 2 — Backend, Proxy & Agents

> Node/Express + LangChain.js. Mock the chain lib (PRD §12) until T-108 lands.

### T-201 — Server scaffold + SQLite kv
- Status: done @manjeet_s 2026-06-03 — Express app + bun:sqlite kv (`server/src/{app,index,store}.ts`); boots on :8787. Static `web/` serving deferred until the web build exists.
- Depends-on: —
- Scope: api
- Acceptance: `server/` boots Express; SQLite kv (Mono pattern) with get/set/del; serves the `web/` build. Add `server` to root `workspaces`.

### T-202 — Provider proxy (Mono port)
- Status: done @manjeet_s 2026-06-03 — registry + `/api/providers`, `/api/keys` (AES-GCM at rest), `/api/models` for all 5 providers; LangChain model factory (`server/src/{providers,models,crypto}.ts`). AI calls route through providers via the factory rather than a raw chat passthrough.
- Depends-on: T-201
- Scope: api
- Acceptance: `GET /api/providers`, `POST /api/keys` (encrypted at rest), `GET /api/models`, chat proxy for Groq / Mistral / NVIDIA / Gemini / OpenRouter.

### T-203 — Role→model config API
- Status: done @manjeet_s 2026-06-03 — `GET/PUT /api/roles` with sensible defaults merged over stored map (`server/src/roles.ts`).
- Depends-on: T-201
- Scope: api
- Acceptance: `GET/PUT /api/roles` persists a `RoleModelMap` (PRD §12) with sensible defaults.

### T-204 — Data subagents (now real LangChain tools)
- Status: done @manjeet_s 2026-06-03 — real tools in `server/src/agents/tools.ts` over **Bybit v5 public market data** (`server/src/market/bybit.ts`, no key) + **computed indicators** RSI/SMA/EMA/MACD (`server/src/market/indicators.ts`), gated by the active-source allow-list, each recording a reasoning trace. WMNT analysis maps to Bybit `MNTUSDT`; the on-chain tool stays placeholder pending T-108; news/web-search deferred (T-209).
- Depends-on: —
- Scope: api
- Acceptance: `server/agents/subagents/{onchain,market,news,indicators}.ts` — each a callable tool returning structured data, gated by `activeSources`; onchain reads via the chain lib (mock until T-108).

### T-205 — Thesis agent (+ human thesis)
- Status: done @manjeet_s 2026-06-03 — **tool-calling loop**: the model picks Bybit/indicator/on-chain tools per intent, then a structured finalize emits a zod-validated thesis (`server/src/agents/thesis.ts`). `/api/thesis` + `/api/thesis/human`; tools actually called become the reasoning traces. Injectable resolver + fetcher → unit-tested with a fake model + fixture candles.
- Depends-on: T-202, T-203, T-204
- Scope: api
- Acceptance: `POST /api/thesis` → valid `Thesis` using the `thesis` role's model, orchestrating only active subagents, populating `reasoning` + per-subagent `traces`. `POST /api/thesis/human` structures a user-written thesis (source `human`) into options.

### T-206 — Debate graph
- Status: done @manjeet_s 2026-06-03 — Supporter → Discriminator → Judge, each on its own model; `/api/debate` returns refined options + per-judge traces (`server/src/agents/debate.ts`). Accepts AI or human thesis.
- Depends-on: T-202, T-203
- Scope: api
- Acceptance: `POST /api/debate` → `DebateResult` (accepts AI or human thesis); Supporter → Discriminator → Judge each use their configured model; returns refined options (predicted % + risk + caveats) plus per-judge `traces`.

### T-207 — History + leaderboard endpoints
- Status: done @manjeet_s 2026-06-05 — `server/src/history.ts` + `store.ts` (`TradeMeta`/`recordTrade`/`listTrades`). `/api/history` joins on-chain DecisionLog (`@autonoe/chain` `readHistory`) with off-chain trade metadata → `HistoryRecord[]` (guards `isDeployed()`); `/api/leaderboard` aggregates realized PnL per role+provider+model. `tsc --noEmit` green. (txHash per-record filled once the execute flow calls `recordTrade` — T-409 wiring.)
- Depends-on: T-108, T-201
- Scope: api
- Acceptance: `GET /api/history` merges SQLite records + on-chain DecisionLog, storing models used per role; `GET /api/leaderboard` aggregates realized outcomes by model + role.

### T-208 — Assistant chat endpoint
- Status: done @manjeet_s 2026-06-03 — `/api/assistant` replies via the assistant-role model (`server/src/agents/assistant.ts`). Returns a full message; streaming can be added later.
- Depends-on: T-202, T-203
- Scope: api
- Acceptance: `POST /api/assistant` replies via the assistant-role model with optional market/position context; can spin off a thesis.

### T-209 — Web search / news tool (deferred)
- Status: pending — deferred per scope decision; theses are currently grounded in price + indicators + on-chain only.
- Depends-on: T-202, T-205
- Scope: api
- Acceptance: a Tavily (or Brave/Exa) web-search tool registered for `subagent.news` and surfaced to the thesis agent's tool loop, so theses can cite news/sentiment.

### T-210 — Signed-price oracle endpoint — NEW (hybrid)
- Status: done @manjeet_s 2026-06-05 — `server/src/oracle.ts` + `GET /api/price/sign?symbol=`: fetches live Bybit price, signs `{chainId, oracle, symbol, priceX18, timestamp}` (EIP-191) with `ORACLE_SIGNER_PRIVATE_KEY` (falls back to `DEPLOYER_PRIVATE_KEY` = on-chain signer). Verified offline: signature recovers to signer, digest matches PriceOracle. `tsc --noEmit` green. Unit test `server/tests/oracle.test.ts`.
- Depends-on: T-204
- Scope: api
- Acceptance: `GET /api/price/sign?symbol=` returns a server-signed attestation `{symbol, price, timestamp, signature}` for a synthetic market, signing the live market price (Bybit feed, T-204) with the `ORACLE_SIGNER_PRIVATE_KEY`; the signer address matches the one set in `PriceOracle` (T-110). Unit-tested: signature recovers to the expected signer. Consumed by the wallet execute flow (T-304) when opening/closing a synthetic position.

---

## 3 — Wallet & Execution

> In-browser embedded wallet (viem). Build against the chain-lib interface; mock `swap()` until T-108.

### T-301 — Wallet generate + encrypt + persist
- Status: done @manjeet_s 2026-06-03 — `@autonoe/wallet`: viem EOA + WebCrypto PBKDF2/AES-GCM keystore, injectable `WalletStore` + `memoryStore()` (`packages/wallet/src/wallet.ts`). 14 tests pass.
- Depends-on: —
- Scope: wallet
- Acceptance: `packages/wallet/src/wallet.ts` generates an EOA (viem), encrypts the key with a passphrase (WebCrypto), persists in IndexedDB; unlock round-trip test passes. Add `packages/wallet` to root `workspaces`.

### T-302 — Export wallet
- Status: done @manjeet_s 2026-06-03 — `exportPrivateKey` + `exportKeystoreJSON` (`packages/wallet/src/export.ts`); tested (no plaintext key in keystore JSON). MetaMask-import polish later.
- Depends-on: T-301
- Scope: wallet
- Acceptance: reveal private key + download a MetaMask-importable keystore JSON; re-import verified in a test.

### T-303 — Spending-limit policy
- Status: done @manjeet_s 2026-06-03 — `SpendingPolicy` + `checkPolicy`/`enforcePolicy` + persistence + `DEFAULT_POLICY` (`packages/wallet/src/policy.ts`); tested allow/deny.
- Depends-on: T-301
- Scope: wallet
- Acceptance: enforces max trade size + token allowlist before signing; rejects over-limit with a clear error; tested.

### T-304 — Agent-sign + execute (AMM **or** synthetic)
- Status: done @manjeet_s 2026-06-05 — `packages/wallet/src/execute.ts`: `executeOption` (policy gate → WMNT AMM swap OR synthetic open via server-signed attestation → on-chain DecisionLog) + `closeSyntheticPosition` (realizes pnl, logs it). Manual-confirm (UI confirms before calling). **Adversarially reviewed (Opus)**: fixed C1 (close now logs the authoritative on-chain position symbol via `readPosition`), H1 (decision-log write is non-throwing after a committed trade — returns `logError` so the UI never retries a double-trade), M1 (zero-quote guard), M2 (oracle symbol-echo assertion). `tsc` green; `readPosition` verified live.
- Depends-on: T-301, T-303, T-108, T-210
- Scope: wallet
- Acceptance: given a chosen option, **branches by asset** — `WMNT` → AMM `swap()`; any other symbol → fetch a signed price attestation (`/api/price/sign`, T-210) then `openSynthetic()`/`closeSynthetic()` via the chain lib. Returns `SwapResult`; triggers the DecisionLog write. Execution is manual-confirm (no auto-execute).

### T-305 — Funding helpers
- Status: done @manjeet_s 2026-06-05 — `packages/wallet/src/funding.ts`: `getAgentBalances` (MNT/mUSD/WMNT), `fundMUSD` (agent calls the mUSD faucet, receipt-checked), `MNT_FAUCET_URL` surfaced for gas. Note: agent needs a little MNT for gas before the mUSD faucet (the drawer surfaces the faucet link).
- Depends-on: T-107
- Scope: wallet
- Acceptance: auto-seed mUSD on wallet creation + faucet re-mint call; native MNT faucet link surfaced.

---

## 4 — Frontend UI

> **Next.js (App Router, React 19)**. **6 routes + wallet drawer** (PRD §11a–§11g). Build to `design-system/autonoe/MASTER.md`. Use the `frontend-design` skill for polish, `web3-vfx-stack` for the landing. Mock API responses (PRD §12) until endpoints land. Client-only libs (wagmi, Lenis/GSAP, charts) need `'use client'`.

### T-401 — App scaffold + routing + theme
- Status: done @manjeet_s 2026-06-03 — Next.js 16 App Router (Tailwind v4, Turbopack) in `web/`; ported design tokens/atmosphere to `app/globals.css`, fonts via next/font, wagmi Providers (injected/MetaMask, Mantle Sepolia), AppShell nav + wallet-drawer stub, Lenis smooth-scroll, 6 route stubs, `next.config` rewrites `/api/*`→bun backend. `tsc` + `next build` green.
- Depends-on: —
- Scope: web
- Acceptance: **Next.js App Router** app scaffolded with bun (`bunx create-next-app`); 6 routes as `app/` segments (`/`, `/markets`, `/trade`, `/studio`, `/history`, `/settings`); design tokens applied (dark OLED, gold `#F59E0B` + purple `#8B5CF6`, Orbitron/Exo 2); motion/VFX deps via bun (Lenis, gsap + @gsap/react, framer-motion); a client Providers wrapper for wagmi/RainbowKit; MetaMask connect on Mantle Sepolia. Add `web` to root `workspaces`. See PRD §10a boundary + §11b motion stack + §11h workflow.

### T-402 — Global shell + wallet drawer
- Status: done @manjeet_s 2026-06-05 — `web/components/wallet/WalletProvider.tsx` (privateKey in a ref only, never persisted) + drawer in `AppShell.tsx`: agent address, MNT/mUSD/WMNT balances, fund mUSD (faucet) + MNT gas faucet link, export (reveal key behind passphrase / download keystore), spending-policy editor, create/unlock forms, and an explicit "acting wallet" indicator distinguishing the MetaMask funding wallet from the agent wallet. Persistent testnet disclaimer. `localStorage` `WalletStore` (`web/lib/walletStore.ts`). tsc clean. (Sonnet agent + Opus review.)
- Depends-on: T-401, T-301
- Scope: web
- Acceptance: persistent nav + a global slide-over wallet drawer reachable from every route; balances/fund/export/limits (calls `packages/wallet`); clearly distinguishes funding wallet (MetaMask) vs autonomous agent wallet with an "acting wallet" indicator; persistent "testnet · not financial advice" disclaimer.

### T-403 — ReasoningTrace component ("Show thinking")
- Status: done @manjeet_s 2026-06-05 — `web/components/studio/ThinkingTrace.tsx` generalized into one reusable component accepting a `ReasoningTrace` (summary collapsed → `steps[]` expanded); reused across thesis reasoning, subagent traces, and judge arguments. (web-wiring agent)
- Depends-on: T-401
- Scope: web
- Acceptance: reusable collapsible trace — shows `summary` collapsed, expands to `steps[]` (PRD §12 `ReasoningTrace`); reused by thesis, subagents, and judges.

### T-404 — Landing page (`/`) — VISUAL TEMPLATE
- Status: done @manjeet_s 2026-06-03 — `app/page.tsx` + `components/landing/*` (Hero char-split, Tribunal flow, HowItWorks, Benchmark count-up, MarketsPreview, FinalCta); GSAP/useGSAP reveals. `next build` green.
- Depends-on: T-401
- Scope: web
- Acceptance: **built first as the visual reference for the whole app** (PRD §11h). Full motion stack — Lenis smooth scroll + GSAP/ScrollTrigger + Aceternity/Magic UI hero effects + gold/purple atmosphere. Sections: hero + how-it-works (thesis → judge → execute) + on-chain-benchmark pitch + "Launch App" CTA. Reviewed via screenshot/preview and iterated to approval; the approved tokens + motion language become the template the other routes inherit.

### T-405 — Trade page — chart + execute (`/trade`)
- Status: done @manjeet_s 2026-06-03 — `app/trade/page.tsx` + `components/trade/*` (SVG chart, pair selector, swap box, balances). **UI only on sample data**; live price feed + real swap wiring tracked in T-409/T-601.
- Depends-on: T-401, T-304
- Scope: web
- Acceptance: TradingView embed for the selected pair; manual swap/execute via `packages/wallet`; balances/positions.

### T-406 — Trade page — side AI rail
- Status: done @manjeet_s 2026-06-03 — `components/trade/AiRail.tsx`: Quick Thesis (option card + "Show thinking" + "Refine in Judge Panel"→/studio) and Assistant chat tabs. **UI only on sample data**; live `/api/thesis` + `/api/assistant` wiring tracked in T-601.
- Depends-on: T-405, T-403, T-205, T-208
- Scope: web
- Acceptance: tabbed rail — Quick Thesis (intent → inline thesis + "Refine in Judge Panel" → `/studio`) and Assistant chat (`/api/assistant`); reasoning traces shown.

### T-407 — Studio Step 1 — Thesis (AI or human) (`/studio`)
- Status: done @manjeet_s 2026-06-03 — `app/studio/page.tsx` + `components/studio/*`: intent input, source toggles, AI/human modes, risk-tiered option cards + "Show thinking". **UI only on sample data**; live `/api/thesis`(`/human`) wiring tracked in T-601.
- Depends-on: T-401, T-403
- Scope: web
- Acceptance: AI mode fires `POST /api/thesis`; human mode posts `/api/thesis/human`; renders risk-tiered option cards + pair suggestion + thesis reasoning trace; per-option branch buttons "Execute" / "Send to Judge Panel".

### T-408 — Studio Step 2 — Judge Panel
- Status: done @manjeet_s 2026-06-03 — `components/studio/StepJudge.tsx` + `TribunalFlow.tsx`: Supporter/Discriminator/Judge columns with traces, verdict bar, refined options + animated confidence bars. **UI only on sample data**; live `/api/debate` wiring tracked in T-601.
- Depends-on: T-407, T-403
- Scope: web
- Acceptance: Supporter/Discriminator/Judge arguments (each with a reasoning trace), verdict, and refined options with predicted % + risk + caveats graphed; "Execute" per option.

### T-409 — Execute flow (shared)
- Status: done @manjeet_s 2026-06-05 — `web/components/wallet/ExecuteModal.tsx`: manual-confirm modal (never auto-executes) → unlock if needed → `executeOption` → tx status + mantlescan links for the trade + decision log; non-blocking `logError` "do NOT retry" warning. Wired into StepThesis (zero verdictHash) + StepJudge refined options (matches `ThesisOption` by `optionRef`, derives verdictHash). **Opus-reviewed** (manual-confirm, policy gate, correct params, key only in ref). tsc clean.
- Depends-on: T-407, T-408, T-304
- Scope: web
- Acceptance: from a chosen option (direct from thesis OR from judge) → confirm → tx status + PnL + mantlescan link (calls `packages/wallet` execute).

### T-410 — Settings page (`/settings`)
- Status: done @manjeet_s 2026-06-05 — `web/app/settings/page.tsx` + `components/settings/{ProviderCard,RoleModelPanel,DataSourcePanel}.tsx`: per-provider key paste + "Get free key" link + note (→ `/api/keys` then `/api/models`), per-role model dropdowns (incl. assistant) via `/api/roles`, data-source toggles persisted to localStorage (`getActiveSources()` for the thesis call). tsc clean. (Sonnet agent; committed with the web batch.)
- Depends-on: T-401, T-203
- Scope: web
- Acceptance: per-provider paste field + "Get free key" link + free-tier note; auto-populate models on paste; per-role model dropdowns (incl. `assistant`); data-source toggles; persists via `/api/keys`, `/api/roles`.

### T-411 — History / Benchmark page (`/history`)
- Status: done @manjeet_s 2026-06-05 — `app/history/page.tsx` is now a full Benchmark dashboard: cumulative **PnL-over-time** SVG chart + **win-rate/summary** stats strip + the on-chain DecisionLog records table (mantlescan links). Reads `/api/history`. Verified live. (`components/benchmark/{PnlChart,BenchmarkStats,Leaderboard}.tsx`.)
- Depends-on: T-401, T-207
- Scope: web
- Acceptance: DecisionLog records + PnL-over-time / win-rate charts + mantlescan links; reads `/api/history`.

### T-412 — Model performance leaderboard
- Status: done @manjeet_s 2026-06-05 — `components/benchmark/Leaderboard.tsx` on the Benchmark page: reads `/api/leaderboard`, groups by role, ranks each (provider, model) by realized avg PnL with trades + win-rate. Friendly empty state until model-attributed trades exist (needs a thesis with `modelsUsed` recorded — see note). tsc + next build green.
- Depends-on: T-411, T-207
- Scope: web
- Acceptance: on the Benchmark page, ranks models per role (thesis/supporter/discriminator/judge) by realized outcome; reads `/api/leaderboard`.

### T-413 — Share thesis/verdict card
- Status: done @manjeet_s 2026-06-05 — `web/components/share/ShareCard.tsx`: a `ShareButton` on each thesis option (StepThesis) and the verdict (StepJudge) opens a preview modal → **Download PNG** (dependency-free SVG→canvas export, 1200×630 branded card) + **Copy summary** (clipboard). Verdict variant shows the judge summary + confidence. tsc + next build green.
- Depends-on: T-407, T-408
- Scope: web
- Acceptance: one-click share of a thesis or verdict as an image/link card.

### T-414 — Markets overview page (`/markets`)
- Status: done @manjeet_s 2026-06-03 — `app/markets/page.tsx` + `components/markets/*`: stats header (count-up), gainers/losers, sortable table w/ favorites + sparklines, rows→/trade. **UI on sample data**; live feed via T-204 wiring tracked in T-601.
- Depends-on: T-401, T-405
- Scope: web
- Acceptance: Binance-style markets overview (PRD §11g) — market-stats header, sortable table of all `mUSD/<asset>` pairs (price, 24h %, 24h volume, sparkline), top gainers/losers strip, favorite toggle; clicking a row opens `/trade` with the pair preloaded. Reuses the market price feed (T-204 / T-405), no new backend contract.

### T-415 — Interactive prediction chart
- Status: done @manjeet_s 2026-06-05 — `server` `GET /api/candles?symbol=&interval=&limit=` (reuses Bybit `getKline`) + `web/components/charts/PredictionChart.tsx`: SVG candlesticks with the Judge's **predicted-return band** (entry line + low/high shading + target marker) and hover OHLC tooltips. Wired into `/trade` ChartPanel (live candles) and the `/studio` verdict (StepJudge). Note: custom SVG instead of TradingView lightweight-charts — avoids a new dependency, matches the app's existing chart style. tsc + next build green.
- Depends-on: T-405, T-204
- Scope: web
- Acceptance: real candles via TradingView **lightweight-charts** fed by Bybit data (through the server/market layer), with the Judge's **predicted-return band** + entry/target markers overlaid on the selected option, and hover tooltips. Used on `/trade` and the `/studio` verdict view to visualize the thesis prediction. Add a server endpoint to expose candles (or reuse the market tool output) so the UI doesn't call Bybit directly.

### T-416 — Frictionless API-key UX (Mono pattern) — NEW
- Status: done @manjeet_s 2026-06-05 — closes the PRD §11e/§11f "no forced trip to Settings" goal. `web/components/keys/ProviderKeyPanel.tsx`: provider chips (READY/NEEDS-KEY dots) + one key row with inline `Save · clear · get key →` + instant filterable model list (FREE + context badges) + reassurance line. `KeyQuickPanel.tsx` makes the same panel a **global top-overlay** opened from a "Models" button in the nav (drop a key from anywhere). Settings page §01 rebuilt around it; role/data-source panels preserved. tsc + next build green.
- Depends-on: T-410
- Scope: web
- Acceptance: a frictionless, tasteful key-add moment matching the Mono reference — inline chips + single key field + live models, reachable globally without navigating to Settings first.

---

## 5 — Infra / DevOps / Docs

### T-503 — Push repo to GitHub + secrets + branch protection
- Status: pending
- Depends-on: —
- Scope: infra
- Acceptance: create the GitHub remote and push; add repo secrets `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` (Settings → Secrets → Actions); confirm CI runs on PRs and the Telegram bot posts to the team chat; enable branch protection on `main` requiring the CI check. **This unblocks the entire claim/PR + notification workflow.**

---

## 6 — Integration & Demo

### T-601 — Wire UI ↔ server (real endpoints)
- Status: done @manjeet_s 2026-06-05 — `web/lib/api.ts` typed client; Studio (StepThesis→`/api/thesis`(`/human`), StepJudge→`/api/debate`), Trade AiRail (Quick Thesis→`/api/thesis`, Assistant→`/api/assistant`), History page→`/api/history` all live with loading/error states. `tsc` green. (Markets still sample — no markets feed endpoint; execute buttons disabled pending T-409.) (web-wiring agent)
- Depends-on: T-205, T-206, T-401
- Scope: integration
- Acceptance: thesis + debate render from the live API, no mocks.

### T-602 — Wire wallet ↔ chain lib (real swap)
- Status: done @manjeet_s 2026-06-05 — **verified live on Mantle Sepolia**: `executeOption({asset:'WMNT'})` ran a real `mUSD/WMNT` AMM swap from the agent wallet (25 mUSD → WMNT). Synthetic path (BTC) also verified.
- Depends-on: T-304, T-108
- Scope: integration
- Acceptance: a real `mUSD/WMNT` swap executes from the agent wallet on testnet.

### T-603 — On-chain logging live
- Status: done @manjeet_s 2026-06-05 — **verified live**: each `executeOption` writes a DecisionLog entry (authoritative id from the receipt event); `/api/history` returns the on-chain record and the history page renders it with a mantlescan link.
- Depends-on: T-304, T-105, T-207
- Scope: integration
- Acceptance: each executed option writes to DecisionLog; the history page shows the on-chain record.

### T-604 — E2E happy path
- Status: done @manjeet_s 2026-06-06 — **verified end-to-end LIVE on Mantle Sepolia with a real LLM (Mistral)**: intent "long the dip on ETH" → thesis (grounded in real Bybit ETH price + RSI 30.87 + MACD, 2 risk-tiered options, 3 subagent traces) → debate (Supporter→Discriminator→Judge, refined options + 0.65 confidence) → `executeOption` opened a synthetic ETH long from the agent wallet → DecisionLog write → `/api/history` shows the record. Fixed two issues found during the live run: (1) provider keys from `.env`/`.env.local` are now seeded into the store at boot (`seedEnvProviderKeys`); (2) `ensureAllowance` now uses a sticky max-uint approve + polls until the allowance reflects, defeating Mantle's load-balanced read-after-write RPC staleness (was `ERC20InsufficientAllowance`).
- Depends-on: T-601, T-602, T-603
- Scope: integration
- Acceptance: intent → thesis → debate → swap → on-chain log passes end-to-end (local fork or live Mantle Sepolia).

### T-605 — Demo polish + script
- Status: done @manjeet_s 2026-06-05 — `RUNNING.md`: local-run steps + the rehearsed demo narrative (PRD §16) + deployed addresses; mantlescan links work (verified live). Design system implemented across all routes; `next build` clean. (Final on-device design pass + the optional polish tasks T-412/413/415 remain as stretch.)
- Depends-on: T-604
- Scope: docs
- Acceptance: UI passes a design review; the demo narrative (PRD §16) is rehearsed; mantlescan links work.

---

## Done

_(newest first)_

### T-502 — Workflow helper scripts (lint-todo + leaderboard)
- Status: done @manjeet_s 2026-06-02
- Depends-on: T-001
- Scope: infra
- Acceptance: `scripts/lint-todo.ts` (validates this file's structure — unique ids, valid Status, Acceptance present; CI-gated) and `scripts/leaderboard.ts` (git-log tally for the Telegram "today's tally" post). Both run under bun.

### T-501 — CI + Telegram-notify workflows (bun)
- Status: done @manjeet_s 2026-06-02
- Depends-on: T-001
- Scope: infra
- Acceptance: `.github/workflows/ci.yml` (bun install --frozen-lockfile → lint-todo → `bun --filter '*' typecheck` → `bun --filter '*' test`) and `.github/workflows/telegram-notify.yml` (Telegram-only: PR opened/conflict/merged + push to main, tagged CLAIM/REVIEW/DONE/CONFLICT/MERGED, plus a leaderboard post). Goes live once T-503 sets the secrets.

### T-004 — Env + network config
- Status: done @manjeet_s 2026-06-02
- Depends-on: T-001
- Scope: chain
- Acceptance: `.env.example` (provider keys, RPC, deployer key); `packages/chain/src/network.ts` exports `mantleSepolia` (viem-shaped, chain 5003), `txUrl`/`addressUrl`, faucet/explorer constants; placeholder `packages/chain/addresses.json` (Track 1 fills via T-107).

### T-003 — Freeze REST API contract
- Status: done @manjeet_s 2026-06-02
- Depends-on: T-001
- Scope: shared
- Acceptance: `packages/shared/src/api.ts` — `API` route map + typed request/response for all 10 endpoints (PRD §12).

### T-002 — Freeze shared types
- Status: done @manjeet_s 2026-06-02
- Depends-on: T-001
- Scope: shared
- Acceptance: `packages/shared/src/types.ts` — all PRD §12 domain types exported as `@autonoe/shared` (incl. `ReasoningTrace`, `assistant` role, `Thesis.source/suggestedPair/reasoning/traces/modelsUsed`, role/asset const arrays). Smoke-tested via `bun test`.

### T-001 — Monorepo scaffold (bun)
- Status: done @manjeet_s 2026-06-02
- Depends-on: —
- Scope: setup
- Acceptance: bun workspaces (`packages/*`), `tsconfig.base.json` + project references, `bun install` + `bun run build` + `bun --filter '*' typecheck`/`test` all green. Track owners add `web`/`server`/`contracts`/`packages/wallet` to root `workspaces` when they scaffold.

---

## Blocked

_(none)_
