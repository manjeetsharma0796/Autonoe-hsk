# Autonoe Redesign — Phase 0 Foundation

> Authoritative for the full redesign. Where this differs from `MASTER.md`, **this wins**.
> Direction approved 2026-06-09: **Trading desk / terminal**, built **foundation-first**.

## Design Read (taste skill)
Redesign-**overhaul** of an on-chain AI-trading tribunal for crypto-native power users →
a **dark trading-desk / terminal** language, built on Autonoe's existing token system
(Orbitron / Exo 2 / JetBrains Mono · gold+violet) pushed to **real data density**.

## Dials
- `DESIGN_VARIANCE: 6` — grid-disciplined, structured. Terminals are not artsy chaos.
- `MOTION_INTENSITY: 4` on tool surfaces (Trade/Studio/Settings), `6` on marketing (Landing/Markets).
- `VISUAL_DENSITY: 7` — cockpit / packed data. **This is the change.** Today's surfaces sit at ~4,
  which is the root cause of trapped whitespace.

## Skill division of labour
- **taste / impeccable** → Landing + overall anti-default aesthetic discipline (anti-slop).
- **uiux-pro-max** → product/data surfaces (density, tables, charts, forms, a11y).
- **vercel-web-design-guidelines + accesslint** → Phase 4 audit gates.

---

## KEEP (brand equity — do not break)
- Palette + accent roles: **gold = value/markets/Judge**, **violet = AI/verdict**, **green = Supporter**, **red = Discriminator**.
- Fonts: **Orbitron** display, **Exo 2** body, **JetBrains Mono** numerics/tickers/labels.
- The **tribunal-flow** signature (Thesis → Supporter/Discriminator → Judge → Verdict).
- Atmosphere (orbs + grain + vignette) — **but only on marketing surfaces.**

## CHANGE
1. **Expose + use a spacing scale.** Replace hard-coded `22px/104px/360px` with tokens (below).
2. **Tighten radii for tools.** Panels 20→**12**, controls 11→**8**. Marketing keeps softer (16).
3. **Raise density.** Panel padding 22→**14/16**, grid gaps 22→**12/16**, denser stat strips.
4. **Mono numerics everywhere** — prices, balances, stats — with `font-variant-numeric: tabular-nums`.
5. **Atmosphere OFF on tool surfaces.** Orbs/grain add noise on dense data screens (part of "doesn't look good").
6. **Real empty / error / loading states** (skeletons) — kill raw `Could not load… HTTP 500` UI.
7. **New primitives** the redesign needs: model chip, stream panel, resize handle, segmented preset, standard field.

---

## Token layer (implemented in `web/app/globals.css`)

### Spacing — 4px base
`--s1 4 · --s2 8 · --s3 12 · --s4 16 · --s5 20 · --s6 24 · --s8 32 · --s10 40 · --s12 48 · --s16 64`

### Radius
`--r-sm 6 · --r-md 8 · --r-lg 12 · --r-pill 999`  → tools use md/lg; chips use pill.

### Density (tool surfaces)
`--panel-pad 16 · --panel-pad-sm 12 · --grid-gap 16 · --grid-gap-sm 12`

### Motion
`--dur-fast 120ms · --dur 180ms · --ease cubic-bezier(.2,.6,.2,1)` (honor `prefers-reduced-motion`).

### Chart presets (Phase 2)
`--chart-h` driven by preset: Compact 240 · Standard 360 · Tall 520 · Focus = fill. Persisted to localStorage.

---

## Component language (new primitives)
- `.term-panel` — tool card: `bg --panel`, `1px --line`, radius `--r-lg`, padding `--panel-pad`. No hover-lift on tools.
- `.term-head` — panel header strip: title (mono caps) + inline controls, `--s3 --s4` padding, bottom hairline.
- `.stat-strip` — dense inline KPIs, mono tabular numerals, hairline dividers (replaces airy 4-card grids).
- `.model-chip` — `⦿ provider · model ▾` pill; read-only badge OR click-to-override. Lives on every run surface.
- `.stream-panel` — streaming reasoning surface (extends LiveThinking): mono, dim, auto-scroll, collapsible.
- `.seg` — segmented control for chart presets `[Compact][Standard][Tall][Focus]`.
- `.resize-handle` — bottom-edge drag affordance (`⋮⋮`), `row-resize` cursor, persists height.
- `.field` — standard form control (fixes the broken model dropdowns): label + control, clear disabled/loading/error states, never a dead-end.

## Atmosphere policy
| Surface | Orbs/grain | Motion |
|---|---|---|
| Landing, Markets | on | 6 |
| Trade, Studio, Settings, History | **off** | 4 |

## Phase map
- **0 · Foundation** (this doc + tokens + visual proof) ← you are here
- **1 · Model selection** — frictionless Connect→Use, simple default + Advanced, inline model chip + streaming
- **2 · Trade + chart** — presets + drag resize, kill dead space, focus mode
- **3 · App-wide cohesion** — apply tokens to all 6 routes, real empty/error states
- **4 · Audit gates** — Vercel Web Interface Guidelines + AccessLint, fix findings
