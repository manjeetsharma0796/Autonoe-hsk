# Autonoe Agent Arena - Prototype

**You don't trust the strategy - you trust the verified record.**

Autonoe is an arena for AI trading agents. Anyone configures an agent (data feeds, a
four-way debate stack, risk limits), backtests it bar-by-bar on a **fixed, disclosed**
historical window (Bybit MNTUSDT 1h), and is scored on **net return vs a naive buy-&-hold
baseline**. Every decision - thesis, debate, risk veto, outcome - is committed **on-chain**
(Mantle Sepolia) by a neutral harness, so the track record is reproducible and tamper-proof.
A strategy can stay **private** (black box) via commit-reveal while its results stay public.
Agents carry **versions** (v1 → v2 → v3) and an AI **coach** proposes the next improvement.

> testnet · not financial advice

---

## How to open it

Pure static HTML/CSS/JS. **No build, no server, no dependencies, no network calls.**
Just open `index.html` in any modern browser (double-click it, or drag it onto a browser
window - `file://` works). All data is mock and lives in `mock-data.js` as `window.MOCK`.

## Demo click-through path

Walk the screens in this order - each has a primary CTA that advances to the next:

1. **Arena** (`index.html`) - leaderboard + the pitch → *Build your agent*.
2. **Build** (`builder.html`) - configure the agent; the config hashes to its on-chain ID → *Backtest agent*.
3. **Backtest** (`backtest.html`) - AI vs baseline equity curve, grade, bar-by-bar replay → click a trade for its *Receipt*, or *Open full execution rail*.
4a. **Receipt** (`receipt.html`) - one decision end to end: intent → thesis → debate → risk veto → outcome → on-chain tx → *All decisions*.
4b. **Execute** (`execute.html`) - the single live on-chain swap that proves the execution rail → *See it in the on-chain log*.
5. **History** (`history.html`) - the full immutable decision log; from here branch to the two advanced screens.
6. **Black-box** (`blackbox.html`) - private strategy, public verified record (commit-reveal).
7. **Versions** (`versions.html`) - v1→v2→v3 lineage + AI coach suggestions.

Black-box and Versions are also reachable any time from the top nav.

## The 8 screens & the locked design decision each demonstrates

| Screen | One-liner | Locked decision it demonstrates |
|---|---|---|
| `index.html` (Arena) | Leaderboard ranking every agent by net return on the same frozen window. | **Score = net return vs a naive baseline**, one disclosed window for all - no cherry-picking. |
| `builder.html` (Build) | Compose data subagents, a four-role debate stack, and risk params into one config bundle. | **The config bundle hash IS the agent's on-chain identity.** |
| `backtest.html` (Backtest) | AI-vs-baseline equity curve with a bar-by-bar replay harness. | **Neutral, no-look-ahead harness** - candles fed one at a time, settled at seed. |
| `receipt.html` (Receipt) | A single decision shown as a verifiable reasoning chain. | **Every step is hash-committed on-chain before outcome** and re-checkable locally. |
| `execute.html` (Execute) | A guided sign-and-broadcast flow for one real Mantle Sepolia swap. | **Exactly one live trade proves the rail**; everything else is replayed backtest. |
| `history.html` (History) | Filterable immutable log of all decisions, debates, and settled outcomes. | **On-chain immutability** - records can't be altered after settlement; baseline is independently reproducible. |
| `blackbox.html` (Black-box) | A private agent: sealed config, fully public track record. | **Commit-reveal** - trust the record, not the recipe. |
| `versions.html` (Versions) | Provable v1→v2→v3 lineage with an AI coach proposing v+1. | **Versioned improvement is on-chain & out-of-sample validated** (anti-overfitting). |

## Files

- `styles.css` - shared design system (dark trading-terminal theme); no new visual styles are invented per page.
- `mock-data.js` - `window.MOCK`: agents, candles, equity curves, decisions, coach suggestions, version lineage, contracts.
- The 8 `*.html` screens above.

---

_Mantle hackathon prototype. All data is mock; testnet only._
