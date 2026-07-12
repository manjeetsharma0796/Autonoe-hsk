# Plan: Migrate Autonoe → HashKey Chain (Testnet) + Full Rebrand

## Context

**Why:** We are submitting to the **HashKey Chain Horizon Hackathon** (DoraHacks, Japan). HashKey Chain is an OP-Stack Ethereum L2 (native token **HSK**). We evaluated 5 existing repos and selected **Autonoe** as the best candidate: it is a genuine **AI-track** fit (multi-agent LLM "trading tribunal" that executes on-chain trades via an agent wallet) and it is currently built for **Mantle Sepolia** — which is *also* an OP-Stack EVM L2, so the migration is a like-for-like L2 swap with no architectural changes.

**Goal:** Produce a local, git-free copy of Autonoe that runs entirely on **HashKey Chain Testnet**, fully rebranded from Mantle/MNT to HashKey/HSK, with all 7 contracts redeployed and the frontend/agents pointed at the new deployment. The result should be demo-ready with zero visible "Mantle" leftovers.

**Decisions locked with user:**
- **Network:** HashKey Chain **Testnet** (chainId **133**).
- **Rebrand depth:** **Full** — chain config + all cosmetic UI/text/docs (MNT→HSK, Mantle→HashKey, WMNT→WHSK where reasonable).
- **Redeploy:** User provides a **funded testnet deployer private key**; execution includes running `deploy.ts` to redeploy + regenerate `addresses.json`.

**Track fit note:** Autonoe → **AI track** (AI trading agents / AI auto-payments). It does **not** use HSP (HashKey Settlement Protocol), which is fine — HSP is only emphasized for the DeFi track. No HSP work is in scope.

---

## Authoritative HashKey Chain parameters (verified, 2+ sources)

**Testnet (our target):**
- Network name: `HashKey Chain Testnet`
- Chain ID: **133** (hex `0x85`)
- RPC: `https://testnet.hsk.xyz`
- Explorer: `https://testnet-explorer.hsk.xyz` (Blockscout)
- Explorer verify API: `https://testnet-explorer.hsk.xyz/api` (Etherscan-compatible; Blockscout accepts any non-empty placeholder API key)
- Native currency: name `HashKey Platform Token`, symbol **HSK**, decimals **18**
- Faucet: `https://hsk.xyz/faucet` (1 HSK / wallet / 24h)
- OP-Stack / EVM compatible: **yes** → keep `evmVersion: "paris"` (safe, no PUSH0/cancun needed)

**Mainnet (reference only, not our target):** chainId **177** (`0xb1`), RPC `https://mainnet.hsk.xyz`, explorer `https://hashkey.blockscout.com`.

> ⚠️ Before verification step, confirm the exact Blockscout `apiURL` via the explorer's "Verify contract" UI. Sourcify is also generally supported by Blockscout; Sourcify is the current fallback in the repo and can be kept.

---

## Prerequisites (before execution)

1. **Funded deployer key** — a testnet private key with HSK gas from the faucet. Populate in `.env` (never commit):
   - `DEPLOYER_PRIVATE_KEY` (deploys + seeds)
   - `TREASURY_PRIVATE_KEY` (seeds liquidity + house reserve) — can equal deployer for demo
   - `ORACLE_SIGNER_PRIVATE_KEY` (signs price attestations) — can be a fresh key
   - Fund at least the deployer with faucet HSK (may need multiple 24h faucet pulls, or ask organizers for a top-up).
2. **LLM provider keys** (at least one) for the agents to function at demo time: `GROQ_API_KEY`, `MISTRAL_API_KEY`, `NVIDIA_API_KEY`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`.
3. **Bun** installed (repo is Bun workspaces, `engines.node >= 20`).

---

## Repo facts (confirmed by exploration)

- **Monorepo:** Bun workspaces — `packages/*` (`@autonoe/chain`, `@autonoe/shared`, `@autonoe/wallet`), `server`, `web`, `contracts`. Root `bun.lock`. Stray `contracts/package-lock.json` (npm) can be deleted.
- **Chain source of truth:** `packages/chain/src/network.ts` — exports `MANTLE_SEPOLIA_CHAIN_ID`, `RPC_URL`, `EXPLORER_URL`, `FAUCET_URL`, the viem-shaped `mantleSepolia` object, and `txUrl()/addressUrl()` helpers. **But the same literals are duplicated in `clients.ts`**, and two web files hardcode the explorer independently (see below).
- **Contracts (deploy order):** `MUSD` → `WMNT` → `AmmFactory` → `AmmRouter(factory)` → `DecisionLog` → `PriceOracle(oracleSigner)` → `SyntheticExchange(musd, oracle)`. Deploy script auto-writes `packages/chain/addresses.json` including `chainId` from the live network.
- **`.git` exists** at repo root — must be removed.
- **Only one env file:** root `.env.example` (no per-package env files). Both contracts and server read root `.env`/`.env.local`.
- **`evmVersion` already `paris`** — correct for HashKey, no change needed.

---

## Execution steps

### Step 0 — Clone fresh & de-git
```bash
# Work in the user's project dir (or a chosen target dir), NOT the scratchpad
git clone https://github.com/manjeetsharma0796/autonoe autonoe-hashkey
cd autonoe-hashkey
rm -rf .git .github            # remove git history + old CI workflows
rm -f contracts/package-lock.json   # stray npm lock; repo uses Bun
git init                       # fresh history (optional; do only if user wants a new repo)
bun install
```
Also drop this plan into the repo as `plan.md` so any agent can pick it up.

### Step 1 — Chain source of truth: `packages/chain/src/network.ts`  ⭐ most important file
Rewrite to HashKey testnet. Rename the export `mantleSepolia` → `hashkeyTestnet` and the const `MANTLE_SEPOLIA_CHAIN_ID` → `HASHKEY_TESTNET_CHAIN_ID` (cross-file rename — see Step 8). Values:
- chain id `133`
- `RPC_URL`: `process.env.HASHKEY_TESTNET_RPC ?? 'https://testnet.hsk.xyz'`
- `EXPLORER_URL`: `'https://testnet-explorer.hsk.xyz'`
- `FAUCET_URL`: `'https://hsk.xyz/faucet'`
- object: `name: 'HashKey Chain Testnet'`, `nativeCurrency: { name: 'HashKey Platform Token', symbol: 'HSK', decimals: 18 }`, both `rpcUrls.default` and `rpcUrls.public` → `https://testnet.hsk.xyz`, `blockExplorers.default: { name: 'HashKey Explorer', url: EXPLORER_URL }`, `testnet: true`.
- **Note line ~22** hardcodes the RPC a second time in `rpcUrls.public` — update it too.

### Step 2 — viem client duplicate: `packages/chain/src/clients.ts`
`defineChain(...)` re-hardcodes `name`, `nativeCurrency` (MNT), and `blockExplorers.name` independently of network.ts. Update all three to HashKey/HSK. Keep importing id/RPC/explorer from `network.ts`.

### Step 3 — Hardhat config: `contracts/hardhat.config.ts`
- Rename network key `mantleSepolia` → `hashkeyTestnet`; `url: process.env.HASHKEY_TESTNET_RPC || "https://testnet.hsk.xyz"`; `chainId: 133`.
- Keep `solidity 0.8.24`, `viaIR: true`, `evmVersion: "paris"`.
- Verification: keep `sourcify: { enabled: true }` AND add a Blockscout `etherscan.customChains` entry for chainId 133 → `apiURL: https://testnet-explorer.hsk.xyz/api`, `browserURL: https://testnet-explorer.hsk.xyz`, with a placeholder `apiKey`. (Confirm apiURL from the explorer verify UI before relying on it.)

### Step 4 — Contracts package script: `contracts/package.json`
Rename script `deploy:mantle` → `deploy:hashkey` and its `--network mantleSepolia` → `--network hashkeyTestnet`. Update the package description (mentions WMNT).

### Step 5 — Env files: root `.env.example` (+ create `.env`)
- Rename `MANTLE_SEPOLIA_RPC` → `HASHKEY_TESTNET_RPC=https://testnet.hsk.xyz` (also update references in `network.ts`, `hardhat.config.ts`, and the comment in `server/src/loadEnv.ts`).
- Keep all LLM keys, `PORT`, `DEPLOYER_PRIVATE_KEY`, `TREASURY_PRIVATE_KEY`, `ORACLE_SIGNER_PRIVATE_KEY`.
- Create a real `.env` (gitignored) with the user's funded keys + at least one LLM key.

### Step 6 — Hardcoded frontend explorer URLs (functional — easy to miss)
Replace the self-defined Mantlescan bases; prefer importing `txUrl` from `@autonoe/chain`:
- `web/app/history/page.tsx:11` — `MANTLESCAN_BASE = "https://sepolia.mantlescan.xyz/tx"` (used ~line 159)
- `web/components/wallet/ExecuteModal.tsx:74` — `explorerBase = 'https://sepolia.mantlescan.xyz/tx/'` (used ~lines 255, 273)

### Step 7 — Redeploy contracts + regenerate addresses (needs funded key)
```bash
cd contracts
bun run deploy:hashkey     # runs: hardhat run scripts/deploy.ts --network hashkeyTestnet
```
This deploys all 7 contracts, seeds mUSD/WMNT liquidity + house reserve + markets (BTC,ETH,SUI,SOL), and **overwrites `packages/chain/addresses.json`** with the new HashKey addresses and `chainId: 133`. This automatically fixes the EIP-712 oracle domain used in `packages/chain/src/syntheticExecutor.ts` and `server/src/oracle.ts` (both read `addresses.chainId`).
- Tune seed sizes via env if faucet HSK is tight: `SEED_WMNT` (default 2), `SEED_MUSD_BASEUNITS`, `HOUSE_RESERVE_BASEUNITS`.
- Then verify (optional): `hardhat verify --network hashkeyTestnet <addr> <args>` per contract, or rely on Sourcify.

### Step 8 — Export rename fan-out (`mantleSepolia` → `hashkeyTestnet`)
The `mantleSepolia` symbol is imported by name in `web/components/Providers.tsx` (lines ~9, 15, 18). After renaming in `network.ts`, update Providers.tsx. Grep the repo for `mantleSepolia` to catch any other importers. `WalletProvider.tsx` and wagmi config already flow from `@autonoe/chain`, so no other functional wiring changes.

### Step 9 — Full cosmetic rebrand (Mantle/MNT → HashKey/HSK)
Systematic find/replace across the web app, server prompts, and docs. Representative locations (not exhaustive — grep to complete):
- **Labels & headers:** `web/app/trade/page.tsx` ("Wrapped Mantle", "Mantle Sepolia · testnet", "Mantle Turing Test 2026"), `web/app/markets/page.tsx`, `web/app/history/page.tsx` (226, 358), `web/components/AppShell.tsx` (many "MNT" labels), `web/components/share/ShareCard.tsx` (253, 331 footer).
- **Landing:** `web/components/landing/*` (Hero, FinalCta, MarketsPreview, HowItWorks, Benchmark, Tribunal).
- **Trade/markets widgets:** `web/components/trade/*` (data.ts, SwapBox, AiRail, Balances), `web/components/markets/*`, `web/components/studio/*`, `web/components/intake/IntakeChat.tsx` (`mantle: "WMNT"`), `web/components/settings/*`.
- **Agent prompts (affect LLM output text):** `server/src/agents/chatAgent.ts:20`, `thesis.ts:122`, `assistant.ts:13`, `tools.ts:75,80`.
- **Script log labels:** `contracts/scripts/verify-state.ts:28`, `check.ts:3,14` ("MNT").
- **Docs:** `README.md`, `PRD.md`, `DEMO.md`, `RUNNING.md`, `operator.md`, root `package.json:6` description.
- **WMNT → WHSK:** The wrapped-native token contract is named `WMNT` ("Wrapped Mantle"). Renaming to `WHSK` touches `contracts/contracts/WMNT.sol`, the deploy script, exported ABIs, and every `addresses.WMNT` reference in `packages/chain` + web. **Recommendation:** rename the on-chain token *symbol/name* strings inside the contract to WHSK/"Wrapped HSK", but consider keeping the Solidity artifact key `WMNT` in `addresses.json`/ABIs to avoid a wide, error-prone rename right before submission — decide during execution based on time. (Prototype dir `prototype/*` is a standalone mock — ignore.)

### Step 10 — Update tests pinning old values
- `packages/chain/src/network.test.ts` — asserts `5003`, `MNT`, mantlescan URLs → update to `133`, `HSK`, HashKey explorer.
- `packages/chain/src/sign.test.ts` — hardcodes `5003`/`5003n` → `133`/`133n`.

### Step 11 — Build & typecheck
```bash
bun run build:packages
bun run typecheck
bun --filter '*' test
```

---

## Verification (end-to-end, before declaring done)

1. **Config sanity:** grep the repo for `5003`, `mantle`, `Mantle`, `MNT`, `mantlescan` — only intentional leftovers (e.g. artifact key `WMNT` if kept) should remain. No functional `mantle` RPC/explorer/chainId anywhere.
2. **Contracts live:** confirm `packages/chain/addresses.json` shows `chainId: 133` and 7 fresh addresses; open one address on `https://testnet-explorer.hsk.xyz` and confirm it exists with the deploy tx.
3. **Build passes:** `bun run build:packages && bun run typecheck` clean; `bun --filter '*' test` green (after Step 10).
4. **App runs on HashKey:** start web + server per `RUNNING.md`. In the browser:
   - Connect wallet → it prompts to add/switch to **HashKey Chain Testnet (133)**, native token shows **HSK**.
   - Header/branding shows HashKey, not Mantle.
   - Run one AI thesis → tribunal → **execute a trade**; confirm the tx and that the "view on explorer" link opens `testnet-explorer.hsk.xyz` (validates Step 6 + Step 1).
   - Check history page tx links resolve on HashKey explorer.
5. **Oracle/synthetic path:** execute a synthetic trade to confirm the EIP-712 domain (chainId 133) signs/verifies correctly (validates addresses.json chainId propagation).

---

## Risk / watch-list

- **Faucet limits (1 HSK/24h):** seeding an AMM pool + house reserve may need more gas/native than one faucet pull. Reduce `SEED_WMNT`/reserve envs, or request organizer top-up. This is the most likely blocker.
- **Blockscout verify apiURL:** confirm exact `/api` path from the explorer UI; Sourcify fallback is already enabled if Etherscan-style verify misbehaves.
- **WMNT rename scope creep:** full WHSK rename is wide; keep the artifact key stable if time-constrained (see Step 9).
- **RPC reliability:** single official public RPC (`testnet.hsk.xyz`). If flaky, check chainlist for backups or use a keyed provider.
- **Native-currency `name` cosmetic mismatch** across registries (HashKey Platform Token vs HashKey EcoPoints) — symbol HSK is what matters; pick one name deliberately.

---

## Files touched — quick index
- **Functional (must):** `packages/chain/src/network.ts`, `packages/chain/src/clients.ts`, `contracts/hardhat.config.ts`, `contracts/package.json`, root `.env.example`/`.env`, `web/app/history/page.tsx`, `web/components/wallet/ExecuteModal.tsx`, `web/components/Providers.tsx`, `packages/chain/addresses.json` (regenerated by deploy), `packages/chain/src/network.test.ts`, `packages/chain/src/sign.test.ts`, `server/src/loadEnv.ts` (comment).
- **Cosmetic (full rebrand):** `web/app/*`, `web/components/**` (landing, trade, markets, studio, settings, AppShell, ShareCard, intake), `server/src/agents/*`, `contracts/scripts/{verify-state,check}.ts`, docs, optional `contracts/contracts/WMNT.sol`.
- **Delete:** `.git/`, `.github/`, `contracts/package-lock.json`.
