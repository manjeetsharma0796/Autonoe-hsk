# Autonoe — Step-1 Intake + Step-2 Judge Panel Prototypes

These are interactive HTML mockups exploring the **Step-1 intake** and **Step-2 judge-panel** UX before building any of it into the real Next.js app. Each file is a self-contained static page (all CSS and JS inlined, zero dependencies, no build, no backend) that lets us feel out the conversational intake flow, the adversarial tribunal debate, the per-role model pickers, and the outcome charts with realistic mock data. They are throwaway design probes — the logic and layout they validate will later be ported into `web/`.

## Where the code lives

All of these are **self-contained static HTML files in the `prototype/` folder at the repo root**. There is no build step and no backend — you can open any `.html` file directly in a browser. Alternatively, serve the folder via the `.claude/launch.json` config named **`judge-prototype`** (`python3 -m http.server 4323 --directory prototype`), which exposes them at `http://localhost:4323/<file>.html`.

| File | Direct URL (served) |
| --- | --- |
| `prototype/judge-panel.html` | http://localhost:4323/judge-panel.html |
| `prototype/judge-panel-debate.html` | http://localhost:4323/judge-panel-debate.html |
| `prototype/intent-intake.html` | http://localhost:4323/intent-intake.html |
| `prototype/model-chip.html` | http://localhost:4323/model-chip.html |

## Components

### `prototype/judge-panel.html` — Judge Panel Prototype

**One-liner:** Single-file interactive tribunal: intent gating → parallel opening statements → turn-taking AI debate → judge verdict → SVG outcomes chart → editable option cards, with "Re-evaluate" appending fresh blind rounds.

**Purpose:** Prototype for the Step-2 "Judge Panel" screen of Autonoe. It stages a 3-agent debate tribunal — Supporter (bull case), Discriminator (bear case), and Judge (ruling) — against a user-typed trading intent, producing ranked option cards the user can edit and execute. The prototype is self-contained (all CSS and JS inlined) and mirrors the logic that will live in `web/components/studio/StepJudge.tsx`.

**Features:**

- **Step-1 intent gating:** Generate button is disabled (opacity 0.38, cursor not-allowed) until the textarea is non-empty; a 150 ms polling loop (`Flow._pollGating`) enforces this. Clicking Generate collapses Step 1 into a compact summary bar showing the quoted intent and amber source-tag chips, advances the flow stepper to Step 2, and fires the first round.
- **Flow stepper:** a two-step progress bar (01 Thesis / 02 Judge Panel) with amber active state, dimmed done state, and a connecting divider. Clicking the 'edit' link in the collapsed Step 1 summary re-expands it and polls gating again.
- **Embedded TribunalModels picker (ModelChip-style):** a tabbed card with Supporter / Discriminator / Judge role tabs, a 3-column provider grid (Groq, Mistral, NVIDIA, OpenRouter, Gemini), per-provider API key input (password field; green glow dot when a key is present), a filterable model list (max-height 160 px scrollable), and a three-row summary footer. Selecting Supporter cascades provider + model to the other two roles unless they have been individually overridden (marked with a 'CUSTOM' badge). Emits `onChange` snapshots used by every subsequent round.
- **Round header:** amber 'ROUND N' badge, truncated italic intent string, status text ('opening statements… / debating… / verdict ready'), and per-agent ModelChip tags (colored dot + provider label + model name).
- **3-column panel grid:** Supporter (green top border), Discriminator (red top border), Judge (amber top border), each 460 px tall with a scrollable message area, per-panel state badge, per-panel model label, and a free-text chat input form.
- **Active-speaker glow:** `.speaking` class adds a colored box-shadow ring (1 px solid + 26 px diffuse glow in the panel's accent color); `.waiting` class sets opacity 0.5 and shows an animated pulsing '… considering' badge (1.1 s ease-in-out infinite).
- **PHASE 1 — Parallel opening statements:** Supporter and Discriminator stream simultaneously via `Promise.all()`; Judge is in waiting/'awaiting debate' state throughout.
- **PHASE 2 — Turn-taking debate (4 turns):** each turn sets the speaker to 'speaking' and the other agent to 'waiting / considering rebuttal', waits 500 ms as a 'thinking' beat, streams the reply, then pauses 260 ms before the next turn.
- **'↳ replying to' tags:** each debate turn carries a `replyTo` string (e.g. '"thin volume"') rendered as an italicised block-left-bordered caption above the message body.
- **Highlighted contested numbers:** numeric claims in message HTML are wrapped in `<mark class="hot">` (amber background, monospace, bold) — e.g. RSI 28, +38%, 1.305, 1.182.
- **Streaming caret:** a blinking 7×14 px block cursor (1 s steps infinite) in the panel's accent color is appended to the message node during word-by-word streaming and removed on completion.
- **PHASE 3 — Judge ruling:** Judge transitions to 'speaking', streams the verdict text, then a verdict bar (amber pill at the bottom of the Judge panel) appears showing the top-confidence option and its direction.
- **SVG 'Option Outcomes vs Baseline' chart:** 900×240 viewBox, Y axis labeled 'RETURN %' (vertical, rotated), X axis labeled with 6 datetime ticks ('06-11 00:00' through '06-13 12:00') and a footer 'TIME · 1h BARS · BYBIT MNTUSDT'. Four sinusoidal series: dashed grey Baseline + solid Option 1 (green), Option 2 (red), Option 3 (blue). A dashed horizontal zero-return line is drawn separately. Y-axis tick labels are ±% integers computed from the data range.
- **Chart hover tooltip:** absolute-positioned amber-bordered card showing 'Bar N/48', then one row per visible option with color-coded label, entry price, and current % P/L (sign-prefixed). Tooltip is clamped to stay within the chart bounds.
- **Legend chips:** click-to-toggle (sets opacity 0.4 when off, redraws paths); double-click-to-isolate (hides all others, marks them off, redraws).
- **Option cards (3-column grid):** each card shows option ID, direction badge (▲ LONG green / ▼ SHORT red), editable Size (mUSD) and Stop-loss inputs (number, monospace), read-only Entry and Take-profit, predicted return band, an amber gradient confidence progress bar with percentage, and an 'EXECUTE' button. Clicking a card selects it (amber border + glow). Execute fires an alert with direction, editable size, and entry price.
- **Per-panel chat:** each panel has a free-text input; submitting appends a right-aligned user bubble then streams a canned `REPLY[role]` response after a 320 ms delay.
- **'⟳ Re-evaluate' button:** appends a brand-new round div below all previous rounds (`roundCount++`), snapshots current picker state, scrolls to the new round, and runs the full three-phase debate. Each round is seeded by its index (sin-wave phase and amplitude vary), making chart series and confidence scores differ across rounds. Previous rounds are not read — models are read fresh from the picker.

**How it works:**

1. Page loads: `boot()` calls `Flow.init()` which injects the two-step stepper bar, the Step-1 shell (intent textarea + model-config slot), and the Step-2 shell (wrapping `#rounds`) into `.wrap`. `IntentStep.mount()` renders the textarea + data-source pills into `#intent-step`. `buildConfigBar()` mounts the TribunalModels picker + Re-evaluate button into `#model-config`.
2. Step 1 visible, Step 2 hidden (`display:none`). Generate button is disabled. A 150 ms poll watches `IntentStep.getIntent()` and enables Generate only when the field is non-empty.
3. User pastes an API key into the picker → green dot lights up, mock model list populates, Supporter selection cascades to Discriminator and Judge unless overridden.
4. User types intent (e.g. "WMNT looks oversold…") and optionally toggles On-chain / Market / Indicators / News source pills.
5. User clicks "Generate thesis": Step 1 collapses to summary bar (quoted intent + source chips + edit link), stepper advances to active Step 2, `flow-step2` gains `.visible` class, polling stops, `onGenerate` callback fires `runEvaluation()`.
6. `runEvaluation()`: increments `roundCount`, reads current intent from `IntentStep`, calls `snapshotRoles()` to read provider+model for each agent from the picker, builds a round DOM node via `buildRound()`, appends to `#rounds`, smooth-scrolls to it, updates the status pill to "ROUND N", then calls `runRound()`.
7. `runRound()` Phase 1: `initChart()` draws the SVG with seed-varied series and wires hover + legend. `renderOpts()` builds option cards. Panel chat forms get submit listeners. Judge set to waiting/'awaiting debate'. Supporter + Discriminator both set to 'speaking'. `Promise.all` streams both opening statements word-by-word in parallel.
8. Phase 2: status text changes to 'debating — taking turns…'. 4 DEBATE turns execute sequentially: speaker set to speaking + other set to waiting, 500 ms pause, `streamInto()` appends a message with '↳ replying to' tag and streams word-by-word, 260 ms pause, next turn.
9. Phase 3: status → 'judge ruling…'. Judge set to speaking. 400 ms pause. Verdict streamed. Judge cleared. Highest-confidence option found; verdict bar shown in Judge panel. Status → 'verdict ready'.
10. User can interact: click legend chips to toggle/isolate chart series; hover chart for per-bar tooltip; click option cards to select; edit Size or Stop-loss inline; click EXECUTE for confirmation alert; type questions into any panel chat form for a streaming reply.
11. User clicks "⟳ Re-evaluate": returns to step 6 with new `roundCount` and whatever provider+model is now in the picker. Old rounds remain visible above, unchanged.

**Implementation:** All CSS and JS are inlined in a single HTML file (~1,564 lines). Three self-contained IIFE modules are declared before page logic: `TribunalModels` (`window.TribunalModels`) handles the ModelChip picker with provider/model/key state and cascading role defaults; `IntentStep` (`window.IntentStep`) manages the textarea, source pills, and gating; `Flow` (`window.Flow`) builds the two-step stepper shell and wires the Generate transition. The page-logic layer (`ROLEMETA`, `OPENING`, `DEBATE`, `RULING`, `cfg`, `snapshotRoles`, `buildRound`, `runRound`, `runEvaluation`) is vanilla JS, no framework or bundler. Streaming is a word-split `setInterval` timer with a blinking caret span inserted at the live boundary. The SVG chart is drawn by `innerHTML` string concatenation into a fixed 900×240 viewBox with `preserveAspectRatio="none"` so it fills its container; series data are generated deterministically from a seed via sinusoidal amplitude + drift functions (`ser`/`makeSeries`). Confidence scores per option are seed-perturbed copies of `BASE_OPTS`, clamped to 35–92%. State badges use CSS animation (`pulse`: 50% opacity 0.45) and the speaking glow uses box-shadow transitions. The picker uses a violet accent (`#6d5fe6`) distinct from the three role colors to avoid confusion. Round isolation (blindness to previous rounds) is enforced by design: `runEvaluation()` only reads `IntentStep` and `TribunalModels` at call time; the `OPENING`/`DEBATE`/`RULING` constants are fixed mock copy.

**Mirrors:** `web/components/studio/StepJudge.tsx` — the 3-column Supporter / Discriminator / Judge tribunal layout, the per-panel model label chip, the verdict bar, and the option card grid (editable size/stop, confidence bar, Execute button) are all direct prototypes of that component's structure.

**Status:** Prototype — not wired to the real app; uses fixed mock debate copy and sinusoidal mock series data; API key input populates mock model lists only.

### `prototype/judge-panel-debate.html` — Judge Panel — Live Debate

**One-liner:** Iterative adversarial debate between Supporter and Discriminator agents, mediated by an OBSERVER who chooses when to call the Judge for a verdict.

**Purpose:** A standalone HTML prototype for Autonoe's Step-2 judge panel. Two AI agents (Supporter, Discriminator) rebut each other in an alternating left/right transcript. Each rebuttal pulls simulated tool evidence (Bybit candles, RSI, on-chain depth) shown as evidence chips, and any numbers that clash are collected in a live "Contested" strip. The human OBSERVER controls debate pacing via two buttons, then the Judge agent issues a synthesis ruling that reveals a return chart and three tradeable option cards.

**Features:**

- **Per-agent model picker:** each of Supporter, Discriminator, and Judge has independent provider (Groq/Mistral/NVIDIA/OpenRouter/Gemini) and model dropdowns in a config bar at the top.
- **Alternating left/right chat bubbles:** Supporter (green, triangle-up avatar, left-aligned) vs Discriminator (red, triangle-down avatar, right-aligned), each bubble showing role name, `provider·model` tag, and rebuttal label.
- **Evidence chips per turn** rendered with a magnifying-glass prefix, sourced from Bybit 1h candles, RSI14, VWAP, volume delta, orderbook depth, risk/reward, trend filter, invalidation.
- **Contested strip:** numbers wrapped in `<mark class="hot">` (amber mono highlight) accumulate de-duplicated into amber chip tokens labelled '⚡ Contested:' as turns arrive.
- **Word-by-word streaming simulation** with blinking caret; after typing finishes, HTML re-inserts so highlights pop in atomically.
- **Research shimmer:** both agents show a spinner row ('pulling Bybit candles, indicators, on-chain depth…') before the opening pair of turns appears.
- **OBSERVER controls:** '⟳ Continue debate (N left)' advances two turns per click; '⚖ Rule now' halts debate at any point; Continue button relabels to 'debate exhausted' at end of authored turns and disables.
- **Status pill:** cycles RESEARCHING → DEBATING → VERDICT.
- **Judge ruling** injected as a centred amber transcript bubble (⚖ avatar), streams its synthesis text, then reveals verdict bar, chart card, and option cards.
- **Verdict bar:** amber banner with verdict text, confidence %, stop, and invalidation level.
- **Return chart:** 48-bar SVG polyline chart (MNTUSDT 1h) with dashed baseline and three option overlays (OPT1 green, OPT2 red, OPT3 blue); x-axis shows date/time labels; y-axis shows return %; hover tooltip shows bar number, entry price, and live return % per visible series.
- **Legend chips:** click to toggle individual series visibility; double-click to isolate one series.
- **Three option cards** in a responsive 3-column grid: direction badge (LONG/SHORT), editable size and stop-loss inputs, fixed entry and take-profit, predicted return band, confidence bar, EXECUTE button (fires alert stub).

**How it works:**

1. Page loads: `buildConfig()` renders three provider+model dropdowns (Supporter defaults to Groq llama-3.3-70b, Discriminator to Mistral medium, Judge to Gemini 2.0-flash); `openingPhase()` fires automatically.
2. Research shimmer: two spinner rows (Supporter + Discriminator) appear for 1200 ms then are removed.
3. Opening pair: turns 0 and 1 (Supporter opens with RSI28/6-9% relief claim; Discriminator counters with thin-volume/dead-cat/1.305 supply wall) stream word-by-word, highlights pop in after each stream, Contested strip populates.
4. Controls enable: `roundtag` reads 'rebuttal 1 · your move'; status pill reads DEBATING; Continue button shows remaining round count; Rule Now is active.
5. OBSERVER clicks Continue: turns 2+3 stream (Supporter cites +38% volume delta; Discriminator argues one bar is not a trend, RSI can stay low in downtrend). Contested strip gains additional tokens. Roundtag advances.
6. OBSERVER clicks Continue again: turns 4+5 stream (Supporter proposes scaled entry, stop at 1.182, 1:1 R/R into 1.305; Discriminator concedes reduced size, reframes 1.305 as invalidation not TP). Continue button disables with label 'debate exhausted'.
7. OBSERVER clicks Rule now (at any point after step 3): controls div hides, a Judge bubble appears centre-aligned in the transcript, streams synthesis text ('Supporter wins asymmetry point; Discriminator wins on invalidation. Net: reduced-size long…'), then resolves.
8. Verdict bar renders: 'Verdict: LONG OPT-1 (reduced size) — confidence 66% · stop 1.182 · invalidation 1.305'.
9. `initChart()` renders SVG; `renderOpts()` paints three option cards with OPT-1 pre-selected; ruling section scrolls into view smoothly.
10. User may toggle/isolate chart series via legend chips, hover for tooltips, edit size/stop fields on cards, click a card to select it, then click EXECUTE (fires alert stub).

**Implementation:** Pure vanilla JS + inline SVG, single self-contained HTML file, zero dependencies. State is managed via a module-level `ptr` integer (index into the `TURNS` array) and a `vis` object keyed by series name. Streaming is a `setInterval` word-splitter that inserts plain text word-by-word, replaces `innerHTML` with the full marked-up HTML after completion, then calls `updateContested()` to diff against a `seen` Set and append only new contested tokens. The chart is fully procedural: 48 synthetic data points are generated with `ser()` (sinusoidal drift + trend) and drawn as SVG path elements recomputed on every vis toggle via `draw()`. Tooltip is an absolutely-positioned div driven by `svg.onmousemove` with right-edge clamping. The `PROVIDERS` registry and `ROLEMETA` array drive config UI generation without hardcoded HTML. The authored `TURNS` array carries pre-written text with `<mark class="hot">` spans for contested numbers — six turns total (3 exchange pairs). CSS custom properties define the full dark-terminal palette (`--bg #0a0d12`, `--amber #f5a623`, `--green #22c55e`, `--red #ef4444`). No build step, no framework.

**Mirrors / reuses:** Shares the return chart, option cards, legend chip interaction, confidence bar, and option card editable inputs with the earlier `judge-panel.html` (v1) prototype. Adds the debate transcript, contested strip, OBSERVER controls, research shimmer, and streaming layer as new layers on top of that v1 foundation.

**Status:** Prototype, not wired to the real app.

### `prototype/intent-intake.html` — Intent Intake — Step-1 Conversational Chatbot

**One-liner:** An 8-question conversational intake chatbot that elicits a user's trading intent and produces an editable Trade Brief ready to hand off to the tribunal.

**Purpose:** Drives the user through a structured sequence of eight trade-intent questions in a chat UI styled after Claude's own interface: no avatar, plain flowing assistant text, a subtle grey "▸ thinking" line before each reply, and dark right-aligned user bubbles. The goal is to convert an unstructured desire into a fully-specified Trade Brief (asset, capital, risk level, horizon, trade type, target, stop) with auto-suggested data-source toggles, before handing off to the Agent Arena tribunal.

**Features:**

- **8 sequential intake questions** defined in a `QUESTIONS` array: goal, asset, capital, risk appetite, time horizon, trade type (spot/convert/leverage), profit target, and stop-loss preference.
- **Sparkle/violet option buttons** per question (✦ prefix, dark border-radius rows with hover glow in `--violet`) plus a permanently visible dashed 'or type your own answer' field with a pencil (✎) icon and Send button — Enter key also submits.
- **'…or type your own answer' freeform input** is always present beneath the structured options, mirroring Claude Code's custom-input pattern.
- **Dangerous options** (leverage, no stop) carry a `warn` class: red border on hover and a red sub-label (e.g. 'simulated · risky', '⚠ risky').
- **Animated amber block-cursor caret** blinks inside the assistant text while words stream in (word-by-word at 22 ms/word).
- **Subtle grey '▸ thinking' line** appears above each assistant message when a `think` label is defined (e.g. 'Reading your goal', 'Locking down risk').
- **Progress counter** top-right shows '1 / 8' advancing to '8 / 8' then 'brief ready'.
- **Dynamic inline SVG mini-chart** renders after the user picks an asset (`chart:true` flag): 64-point seeded pseudo-random price series, gradient-fill under the line (green or red), 2 subtle horizontal grid lines, delta percentage badge, end-dot marker, axis labels '48h ago' / 'now', and a Bybit 1h attribution line.
- **Data-source pills** are individually clickable to toggle on/off before submission.
- **Trade Brief card** assembles automatically at the end: amber-tinted prose statement generated from all answers, 2-column metadata grid (Asset/Capital/Risk/Horizon/Trade type/Target), auto-suggested data-source toggle pills (On-chain, Market, Indicators, News — pre-activated based on answers), and a full-width 'Run the tribunal →' CTA button. The Trade type field renders red when 'leverage' was chosen.
- **'Run the tribunal →'** fires an alert showing the statement text plus the active source list (wired to tribunal handoff point).
- **Start-over button** resets all answers and re-renders from question 1.

**How it works:**

1. Page loads and immediately calls `ask(0)`, injecting the first assistant turn with a '▸ Reading your goal' think line and streaming the question text word-by-word with a blinking amber caret.
2. Once streaming completes the HTML is swapped in (supporting inline code tags in question text) and `renderOptions` appends the option buttons plus the always-present freeform input row below them.
3. User either clicks a pre-built option or types in the freeform field and presses Enter or Send. Either path calls `choose(i, wrap, value, label)`.
4. `choose()` stores value in `answers[id]` and label in `LABELS[id]`, removes the option UI, and appends a dark right bubble with the chosen label.
5. For the asset question (`chart:true`), a new assistant turn streams a short commentary ('Quick read on X before we size it — here is the recent action:') and then `inlineChart()` appends the SVG price card beneath it.
6. After a 300 ms delay, `ask(i+1)` is called and the cycle repeats for each remaining question.
7. After question 8 (stop), `ask()` detects `i >= QUESTIONS.length` and calls `finish()`.
8. `finish()` streams a closing line ('Got it — here's your brief…'), builds the Trade Brief card from the collected answers, auto-activates the relevant data-source pills, and appends it to the chat.
9. User optionally toggles sources on/off, then clicks 'Run the tribunal →' which currently fires an alert with the brief text and active sources (tribunal handoff stub).

**Implementation:** Vanilla JS, no dependencies, single HTML file. State held in two plain objects: `answers` (raw values) and `LABELS` (human-readable labels). `stream()` is a Promise-based word-ticker that inserts a blinking caret span ahead of words and resolves when all words are placed. `inlineChart()` generates a deterministic-looking 64-point series using two overlaid sine waves seeded by the sum of the asset ticker's char codes, computes min/max normalization, builds SVG path strings directly, and injects a `linearGradient` with a unique id per render (`_icN` counter) to avoid SVG `defs` collisions. `suggestedSources()` applies three rules: Market and Indicators are always on; On-chain is excluded when leverage is chosen; News is added when horizon is 'month' or goal is 'hedge'. `statement()` generates the prose summary using a goal-verb lookup table falling back to a generic form. The brief card is `innerHTML`-injected then event listeners are attached via `querySelectorAll` after insertion. All turns use a `rise` keyframe (opacity 0 → 1, translateY 6px → 0, 250 ms) for smooth reveal. Color tokens are CSS custom properties on `:root` (`--violet`, `--amber`, `--green`, `--red`, `--dim`, `--muted`). Font stacks: 'Inter' for UI text, 'SF Mono'/ui-monospace for code and numeric data.

**Mirrors / reuses:** Mirrors the Claude / Claude Code conversational interface conventions: no avatar on assistant turns, plain flowing text, streaming word-by-word output, dark right bubble for user replies, and a dashed freeform input row always available alongside structured choices. The option button style (violet border-glow on hover, ✦ sparkle prefix) is consistent with the Autonoe Agent Arena sparkle-option pattern used in `judge-panel` and related prototypes.

**Status:** Prototype, not wired to the real app — tribunal handoff is an `alert()` stub; chart uses seeded pseudo-random data, not live Bybit prices.

### `prototype/model-chip.html` — ModelChip Prototype

**One-liner:** Compact per-role AI model picker chip with inline provider switching, API-key paste, and auto-fill propagation across tribunal roles.

**Purpose:** A self-contained vanilla-JS replica of the Autonoe ModelChip used on the Tribunal panel. Each of the three agent roles (Supporter, Discriminator, Judge) gets its own chip displaying the active provider and model. Clicking opens a popover that lets the user switch provider, paste an API key without leaving the page, filter models, and select one — all without navigating to Settings.

**Features:**

- **Compact pill chip per role** showing 'provider · model' in monospace; turns gold/amber with a 'needs key' badge when the selected provider lacks an API key.
- **Popover header names the role** (e.g. 'Model · Supporter') so context is never lost when the panel is crowded.
- **Provider row of pill buttons** (Groq, Mistral, NVIDIA, OpenRouter, Gemini) each with a 6px status dot: grey = no key, green glow = keyed and live; active provider highlighted in violet.
- **Inline API-key form:** if the selected provider has no key, the model list is replaced by a key form (password input + gold Save button + 'get a key →' link + 'stored server-side, never in the browser' note). Pressing Enter or Save unlocks the provider globally and redraws the list immediately.
- **Provider-level shared keys:** saving a key on any role's chip marks that provider as live (`hasKey=true`) everywhere — opening another role's chip sees it already unlocked. No need to paste the same key three times.
- **Model list rows** show 'circle modelName FREE ctx-window' where FREE is a green bordered badge and the context window is shown as e.g. '128K' right-aligned in faint text.
- **Filter input** ('filter models…') appears above the list only when a provider has more than 6 models; real-time substring match on both label and id.
- **Auto-fill propagation:** choosing a model on the Supporter chip (the primary role, `r.primary=true`) copies provider+model to Discriminator and Judge unless those roles have already been manually overridden. Non-primary roles that are auto-filled show an 'AUTO' (synced) tag on the chip.
- **Manual override:** choosing a model directly on Discriminator or Judge sets `overridden:true` for that role, permanently opting it out of future Supporter auto-fills.
- **Chip states:** unset (gold border, 'Choose model'), set+keyed (violet dot, full label), set+no-key (amber dot + warn-tag), auto-synced (violet + 'auto' grey badge).
- **Dismissal:** click-outside and Escape close the popover (the real TSX adds Escape; the prototype uses mousedown outside `wrap`).
- **Footer link** 'Manage all roles in Settings →' present in both prototype and real component.

**How it works:**

1. Page renders three rows (Supporter / Discriminator / Judge) each with a `mchip-wrap` containing an `mchip` button in the 'unset' state (gold border, 'Choose model' label).
2. User clicks a chip. Popover (`.mpop`) mounts anchored 8px below the chip, right-aligned.
3. Popover header names the role. Provider strip renders; if any provider already has a key its dot glows green and that provider is pre-selected (falls back to first provider).
4. **(a)** Provider lacks a key → key form replaces the model list. User pastes key, presses Enter or Save. `saveKey()` marks `prov.hasKey=true` at the shared `PROVIDERS` array level and re-renders: the dot turns green, and the model list appears for all roles' popovers going forward. **(b)** Provider has a key → model rows render immediately (prototype uses inline `MODELS` data; real component calls `getModels(prov)` async). If provider has >6 models a filter input appears at the top.
5. User optionally types in the filter box; list re-renders in real-time against label+id substring.
6. User clicks a model row. `choose(provId, modelId)` fires.
7. If the role is Supporter: state for Discriminator and Judge is overwritten with the same provider+model unless they are individually overridden (`state[o].overridden === true`).
8. Popover closes; `updateAll()` repaints all three chips. Discriminator and Judge chips that were auto-filled show the 'auto' grey badge.
9. If the user later clicks Discriminator's chip and picks a different model, `overridden` is set to true for that role, removing the auto badge. Future Supporter selections no longer touch Discriminator.

**Implementation:** Pure vanilla JS / HTML / CSS — no framework, no bundler. All CSS variables mirror the real `model-chip.css` token set verbatim (`--bg`, `--violet`, `--gold`, `--green`, `--mono`, etc.). Provider and model data are hardcoded JS objects (`PROVIDERS` / `MODELS`) replacing the real API calls (`getProviders` / `getModels` / `postKey` / `putRoles`). Role definitions live in a `ROLES` array where the first entry carries `primary:true` — the auto-fill flag. State is a plain object keyed by role name holding `{provider, model, overridden}`. The popover is built by `innerHTML` string templating and re-rendered on every interaction (provider switch, filter keystroke, key save). The real TSX component replaces `innerHTML` with React state (`useState` hooks for open, activeProv, models, filter, keyInput, saving) and calls the API layer; it also adds Escape-key close, `aria-haspopup`/`aria-expanded` on the trigger, `role="dialog"` on the popover, and a Retry button on fetch errors. The auto-fill logic is equivalent in both: the prototype checks `state[o].overridden` directly; the real component uses `putRoles()` to persist to the server.

**Mirrors / reuses:** `web/components/ai/ModelChip.tsx` + `web/components/ai/model-chip.css`.

**Status:** Prototype, not wired to the real app.

## Design decisions locked

- **Parallel openings, then turn-taking glow:** Supporter and Discriminator deliver opening statements simultaneously, then debate in alternating turns where the active speaker gets a colored glow ring and the other shows a pulsing '… considering' badge.
- **Observer-controlled debate:** the human paces the tribunal — 'Continue debate' advances two turns at a time, 'Rule now' halts at any point and calls the Judge for a synthesis verdict.
- **Sparkle answer buttons + always a type-your-own field:** every intake question offers ✦ violet quick-pick options alongside a permanently visible dashed freeform input, mirroring Claude Code's custom-input pattern.
- **Dynamic inline charts in the intake:** picking an asset renders a seeded SVG mini price chart inline, giving the user a quick read on recent action before sizing the trade.
- **ModelChip popover + shared provider keys + auto-fill:** a compact per-role chip opens an inline popover for provider switch / key paste / model select; keys are shared per-provider across all roles, and the Supporter selection auto-fills Discriminator and Judge until they are manually overridden.
- **Step-1 intent gating:** no tribunal round can fire until a non-empty intent is entered — the Generate button stays disabled (enforced by a polling loop) until there's an intent to debate.

## Status / next

All four are **prototypes only** — interactive HTML mockups for design exploration, **NOT wired into the real Next.js app yet** (`web/`). That port happens on the user's go-signal **"GOJO"**.

Real-app counterparts the prototypes mirror:

- `prototype/judge-panel.html` and `prototype/judge-panel-debate.html` → **`web/components/studio/StepJudge.tsx`** (3-column tribunal layout, verdict bar, option card grid).
- `prototype/model-chip.html` → **`web/components/ai/ModelChip.tsx`** (+ `web/components/ai/model-chip.css`).
- `prototype/intent-intake.html` → the Step-1 intake/Trade Brief handoff that feeds the tribunal.
