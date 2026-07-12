# Running Autonoe locally (E2E demo)

The full happy path — **intent → thesis → debate → execute (real on-chain trade) → on-chain log → history** — runs entirely on localhost against the live **Mantle Sepolia (chain 5003)** deployment.

## Prerequisites
- **bun** (server runtime + `bun:sqlite`): `curl -fsSL https://bun.sh/install | bash`
- **node ≥ 20** (Next.js / tooling)
- A funded **deployer/agent key** and (for live AI) **one provider key** — see `.env.local`.

## 1. Environment
Copy `.env.example` → `.env.local` and set:
```bash
DEPLOYER_PRIVATE_KEY=0x...          # funded with testnet MNT (also the oracle signer)
# ORACLE_SIGNER_PRIVATE_KEY=0x...   # optional; defaults to the deployer key
GROQ_API_KEY=gsk_...                # any ONE provider key for live thesis/debate
                                    # (or paste it in the app's /settings page)
```
Free MNT: https://faucet.sepolia.mantle.xyz · Free Groq key: https://console.groq.com/keys

## 2. Install + build the chain lib
```bash
bun install
bun --filter '@autonoe/chain' run build   # produces packages/chain/dist (consumed by server + web)
```

## 3. Run (two terminals)
```bash
# terminal 1 — AI/agent + oracle backend (bun, :8787)
cd server && bun src/index.ts

# terminal 2 — Next.js UI (:3000), proxies /api/* → :8787
cd web && bun run dev     # or: npm run dev
```
Open http://localhost:3000.

## 4. Demo flow
1. **Wallet drawer** → create the agent wallet (passphrase). Fund it: MNT gas from the faucet link, then "Fund mUSD".
2. **/studio** → type an intent ("hedge my MNT", "long the dip on BTC") → AI thesis with risk-tiered options + "Show thinking" traces.
3. Send to the **Judge Panel** → Supporter → Discriminator → Judge → refined options.
4. **Execute** an option → confirm → the agent wallet signs a real trade (WMNT = AMM swap; BTC/ETH/SUI/SOL = oracle-priced synthetic) → tx + mantlescan link.
5. **/history** → the decision + outcome is recorded on-chain (DecisionLog) — the benchmark.

## Deployed contracts (Mantle Sepolia, chain 5003)
Source of truth: `packages/chain/addresses.json` (all Sourcify-verified).

| Contract | Address |
|---|---|
| mUSD | `0x6F51259786A6dD1A35dea8A7fF8191C808881758` |
| WMNT | `0x94b5D1401bD847B9f7b2E0553d6A885419D12042` |
| AmmFactory | `0x8dFC3A0777B40009dE796560c4914f8f76F35bDd` |
| AmmRouter | `0x10DD80dc0962b8Ac4569287BB1f1023192561fd6` |
| SyntheticExchange | `0x912B6b677d4E22945Fb4e5E075CE0ADC95786754` |
| DecisionLog | `0xe1a4E05E6c9713DD7511EC1FbbB6a836E05c53D6` |
| PriceOracle | `0xa8647941eb5b1F29d06428eBC81bCD3bE2C99e45` |
| Pool mUSD/WMNT | `0x3e71d74bAF021D5c66Caa457Ef51D06d2Ac362Ef` |

Explorer: `https://sepolia.mantlescan.xyz/address/<addr>`

## Tests
```bash
bun --filter '*' test              # shared / chain / wallet / server suites
cd contracts && npx hardhat test   # Solidity unit tests
```

## Redeploy (only if needed)
```bash
cd contracts && npm run deploy:mantle   # deploys + seeds + writes packages/chain/addresses.json
```
