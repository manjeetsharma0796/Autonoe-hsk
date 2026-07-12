# Running Autonoe locally (E2E demo)

The full happy path — **intent → thesis → debate → execute (real on-chain trade) → on-chain log → history** — runs entirely on localhost against the live **HashKey Chain** deployment.

## Prerequisites
- **bun** (server runtime + `bun:sqlite`): `curl -fsSL https://bun.sh/install | bash`
- **node ≥ 20** (Next.js / tooling)
- A funded **deployer/agent key** and (for live AI) **one provider key** — see `.env` or `.env.local`.

## 1. Environment
Copy `.env.example` → `.env` and set:
```bash
DEPLOYER_PRIVATE_KEY=0x...          # funded with HSK (also the oracle signer)
# ORACLE_SIGNER_PRIVATE_KEY=0x...   # optional; defaults to the deployer key
MISTRAL_API_KEY=...                 # any ONE provider key for live thesis/debate
                                    # (or paste it in the app's /settings page)
```
Free HSK: https://hsk.xyz/faucet · Free Mistral key: https://console.mistral.ai/

## 2. Install + build the chain lib
```bash
bun install
bun run build:packages
```

## 3. Run (two terminals)
```bash
# terminal 1 — AI/agent + oracle backend (bun, :8787)
cd server && bun src/index.ts

# terminal 2 — Next.js UI (:3000), proxies /api/* → :8787
cd web && bun run dev
```
Open http://localhost:3000.

## 4. Demo flow
1. **Wallet drawer** → create the agent wallet (passphrase). Fund it: HSK gas from the faucet link, then "Fund mUSD".
2. **/studio** → type an intent ("hedge my HSK", "long the dip on BTC") → AI thesis with risk-tiered options + "Show thinking" traces.
3. Send to the **Judge Panel** → Supporter → Discriminator → Judge → refined options.
4. **Execute** an option → confirm → the agent wallet signs a real trade (WMNT = AMM swap; BTC/ETH/SUI/SOL = oracle-priced synthetic) → tx + HashKey explorer link.
5. **/history** → the decision + outcome is recorded on-chain (DecisionLog) — the benchmark.

## Deployed contracts (HashKey Chain, chain 133)
Source of truth: `packages/chain/addresses.json`.

| Contract | Address |
|---|---|
| mUSD | `0x6F51259786A6dD1A35dea8A7fF8191C808881758` |
| WMNT (WHSK) | `0x94b5D1401bD847B9f7b2E0553d6A885419D12042` |
| AmmFactory | `0x8dFC3A0777B40009dE796560c4914f8f76F35bDd` |
| AmmRouter | `0x10DD80dc0962b8Ac4569287BB1f1023192561fd6` |
| SyntheticExchange | `0x912B6b677d4E22945Fb4e5E075CE0ADC95786754` |
| DecisionLog | `0xe1a4E05E6c9713DD7511EC1FbbB6a836E05c53D6` |
| PriceOracle | `0xa8647941eb5b1F29d06428eBC81bCD3bE2C99e45` |
| Pool mUSD/WMNT | `0x3e71d74bAF021D5c66Caa457Ef51D06d2Ac362Ef` |

Explorer: `https://testnet-explorer.hsk.xyz/address/<addr>`

## Tests
```bash
bun --filter '*' test              # shared / chain / wallet / server suites
cd contracts && bun run test       # Solidity unit tests
```

## Redeploy (only if needed)
```bash
cd contracts && bun run deploy:hashkey   # deploys + seeds + writes packages/chain/addresses.json
```
