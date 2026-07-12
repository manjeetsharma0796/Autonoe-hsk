"use client";

/**
 * IntakeChat - Step 1, conversational intake.
 *
 * A Claude-style chat that scopes a trade one question at a time (goal, asset,
 * capital, risk, horizon, trade type, target, stop), each with sparkle/violet
 * answer buttons AND an always-present "type your own answer" field. The asset
 * turn renders a dynamic inline candle chart. The flow ends in an EDITABLE
 * Trade Brief; on confirm it builds an `intent` string + `activeSources` and
 * calls the SAME real thesis API + `onSendToJudge(thesis)` prop that StepThesis
 * used, so the rest of the Studio (StepJudge, Workspace routing) is untouched.
 *
 * Ported from prototype/intent-intake.html.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { AIRole, AssetSymbol, ChatMessage, IntakeFields, Thesis } from "@autonoe/shared";
import { ASSET_SYMBOLS } from "@autonoe/shared";
import { extractIntake, postThesisHuman } from "@/lib/api";
import { streamSSE } from "@/lib/stream";
import { AiAnswer } from "@/components/ai/AiAnswer";
import { ModelChip } from "@/components/ai/ModelChip";
import { TradingViewChart } from "@/components/ai/TradingViewChart";
import { ArrowRightIcon, PenIcon, WarnIcon } from "../icons";
import { type DataSourceKey } from "../data";

import styles from "./IntakeChat.module.css";

// ── inline icons (free-chat composer + AI sender) ───────────────────────────────

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}
function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
    </svg>
  );
}

// ── Question schema ────────────────────────────────────────────────────────────

interface AnswerOpt {
  v: string;
  label: string;
  sub?: string;
  warn?: boolean;
}

type QuestionId =
  | "goal"
  | "asset"
  | "capital"
  | "risk"
  | "horizon"
  | "type"
  | "target"
  | "stop";

interface Question {
  id: QuestionId;
  think?: string;
  /** Question text. May contain inline <code> markup, swapped in after the typewriter completes. */
  q: string;
  /** Renders the inline asset chart after the answer bubble. */
  chart?: boolean;
  opts: AnswerOpt[];
}

const QUESTIONS: Question[] = [
  {
    id: "goal",
    think: "Reading your goal",
    q: "Hey - what are you trying to do?",
    opts: [
      { v: "grow", label: "Grow my stack" },
      { v: "hedge", label: "Hedge a position" },
      { v: "scalp", label: "Quick scalp" },
      { v: "swing", label: "Swing trade" },
    ],
  },
  {
    id: "asset",
    think: "Picking the market",
    q: "Got it. Which asset are we looking at?",
    chart: true,
    opts: [
      { v: "WMNT", label: "WMNT" },
      { v: "BTC", label: "BTC" },
      { v: "ETH", label: "ETH" },
      { v: "SOL", label: "SOL" },
      { v: "SUI", label: "SUI" },
    ],
  },
  {
    id: "capital",
    think: "Sizing the position",
    q: "How much are you putting in? Pick one or type an amount.",
    opts: [
      { v: "$100", label: "$100" },
      { v: "$500", label: "$500" },
      { v: "$1,000", label: "$1,000" },
      { v: "$5,000", label: "$5,000" },
    ],
  },
  {
    id: "risk",
    q: "What's your risk appetite on this?",
    opts: [
      { v: "low", label: "Low", sub: "protect capital" },
      { v: "med", label: "Medium", sub: "balanced" },
      { v: "high", label: "High", sub: "go for it" },
    ],
  },
  {
    id: "horizon",
    q: "Over what time horizon?",
    opts: [
      { v: "intraday", label: "Intraday" },
      { v: "days", label: "A few days" },
      { v: "week", label: "~1 week" },
      { v: "month", label: "~1 month" },
    ],
  },
  {
    id: "type",
    q: "What kind of trade? You can use <code>spot</code>, <code>convert</code>, or simulated <code>leverage</code>.",
    opts: [
      { v: "spot", label: "Spot buy / sell" },
      { v: "convert", label: "Convert" },
      { v: "leverage", label: "Leverage", sub: "simulated · risky", warn: true },
    ],
  },
  {
    id: "target",
    q: "What's your target on this trade?",
    opts: [
      { v: "+$15", label: "+$15" },
      { v: "+5%", label: "+5%" },
      { v: "+10%", label: "+10%" },
      { v: "+25%", label: "+25%" },
    ],
  },
  {
    id: "stop",
    think: "Locking down risk",
    q: "Last one - how do you want to handle downside?",
    opts: [
      { v: "tight", label: "Tight stop", sub: "cut fast" },
      { v: "wide", label: "Wide stop", sub: "room to breathe" },
      { v: "none", label: "No stop", sub: "⚠ risky", warn: true },
    ],
  },
];

type Answers = Partial<Record<QuestionId, string>>;
type Labels = Partial<Record<QuestionId, string>>;

const ALL_SOURCES: { key: DataSourceKey; label: string }[] = [
  { key: "onchain", label: "On-chain" },
  { key: "market", label: "Market" },
  { key: "indicators", label: "Indicators" },
  { key: "news", label: "News" },
];

/** Same mapping StepThesis uses to turn data-source toggles into AIRoles. */
const SOURCE_TO_ROLE: Record<DataSourceKey, AIRole> = {
  onchain: "subagent.onchain",
  market: "subagent.market",
  indicators: "subagent.indicators",
  news: "subagent.news",
};

// ── helpers ────────────────────────────────────────────────────────────────────

const stripHtml = (h: string) => h.replace(/<[^>]+>/g, "");

/** Auto-suggest data sources from the answers (mirrors the prototype). */
function suggestedSources(a: Answers): Record<DataSourceKey, boolean> {
  return {
    market: true,
    indicators: true,
    onchain: a.type !== "leverage",
    // horizon is free-text now (e.g. "5 days", "1 month"), so match loosely
    news: /month/i.test(String(a.horizon ?? "")) || a.goal === "hedge",
  };
}

/** Normalize the asset answer onto a valid AssetSymbol; fall back to WMNT. */
function toAssetSymbol(raw: string | undefined): AssetSymbol {
  const up = (raw ?? "").trim().toUpperCase();
  return (ASSET_SYMBOLS as readonly string[]).includes(up) ? (up as AssetSymbol) : "WMNT";
}

/** Returns true if the message is asking for a price chart (not just a price). */
function chartRequested(text: string): boolean {
  return /\b(chart|candle|candlestick|tradingview|graph|plot|show.*(price|market)|price.*(chart|graph|view)|live chart)\b/i.test(text);
}

/** Full-name aliases so users can type "solana", "bitcoin", etc. */
const ASSET_NAME_MAP: Record<string, AssetSymbol> = {
  bitcoin: "BTC",
  btc: "BTC",
  ethereum: "ETH",
  eth: "ETH",
  solana: "SOL",
  sol: "SOL",
  sui: "SUI",
  mantle: "WMNT",
  hashkey: "WMNT",
  wmnt: "WMNT",
  mnt: "WMNT",
};

/**
 * If a free-chat message clearly names a known asset (by ticker OR common name),
 * return its ticker so we can drop a live Bybit sparkline under the reply.
 * Returns null when no single asset is referenced.
 */
function assetMentioned(text: string): AssetSymbol | null {
  const lower = text.toLowerCase();
  const up = text.toUpperCase();

  // Check full-name aliases first (e.g. "solana", "bitcoin")
  const nameHits = new Set<AssetSymbol>();
  for (const [name, sym] of Object.entries(ASSET_NAME_MAP)) {
    if (new RegExp(`\\b${name}\\b`, "i").test(lower)) nameHits.add(sym);
  }
  if (nameHits.size === 1) return [...nameHits][0];

  // Fall back to exact ticker symbol match
  const tickerHits = (ASSET_SYMBOLS as readonly string[]).filter((sym) =>
    new RegExp(`\\b${sym}\\b`).test(up),
  );
  if (tickerHits.length === 1) return tickerHits[0] as AssetSymbol;

  return null;
}

/** Build the natural-language intent sentence from the (possibly edited) answers. */
function buildIntent(answers: Answers, labels: Labels): string {
  const goalWord =
    {
      grow: "grow my position in",
      hedge: "hedge",
      scalp: "scalp",
      swing: "swing trade",
    }[answers.goal ?? ""] ?? `${labels.goal ?? answers.goal ?? "trade"} on`;

  const asset = labels.asset ?? answers.asset ?? "the market";
  const capital = labels.capital ?? answers.capital ?? "an unspecified amount";
  const risk = labels.risk ?? answers.risk ?? "medium";
  const type = labels.type ?? answers.type ?? "spot";
  const horizon = labels.horizon ?? answers.horizon ?? "a few days";
  const target = labels.target ?? answers.target ?? "a reasonable gain";
  const stop = labels.stop ?? answers.stop ?? "a sensible stop";

  return `I want to ${goalWord} ${asset} with ${capital}, a ${risk}-risk ${type} trade over ${horizon}, targeting ${target} with a ${stop}.`;
}

/** Escape the intent for safe innerHTML rendering in the amber statement box. */
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── streaming text turn ─────────────────────────────────────────────────────────

/** Reveals `text` word-by-word with an amber caret, then swaps in `html` (if any) and calls onDone. */
function StreamText({
  text,
  html,
  speed = 22,
  onDone,
}: {
  text: string;
  html?: string;
  speed?: number;
  onDone?: () => void;
}) {
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const words = text.split(" ");

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setCount(words.length);
      setDone(true);
      doneRef.current?.();
      return;
    }
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= words.length) {
        clearInterval(id);
        setDone(true);
        doneRef.current?.();
      }
    }, speed);
    return () => clearInterval(id);
    // text is fixed per turn; run the typewriter exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (done && html) {
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return (
    <span>
      {words.slice(0, count).join(" ")}
      {!done && <span className={styles.caret} aria-hidden="true" />}
    </span>
  );
}

// ── chat turn model ─────────────────────────────────────────────────────────────

type Turn =
  | { kind: "q"; qi: number }
  | { kind: "u"; text: string }
  | { kind: "chart"; asset: string; fromQi: number }
  | { kind: "brief" }
  /**
   * Free-chat assistant reply. `prompt` is the full conversation snapshot sent to
   * /api/assistant/stream; `asset` (if set) drops a live Bybit sparkline under the
   * streamed reply; `tvSymbol` (if set) embeds a TradingView chart.
   */
  | { kind: "ai-reply"; prompt: ChatMessage[]; asset: AssetSymbol | null; tvSymbol?: AssetSymbol | null };

// ── props (identical to StepThesisProps) ────────────────────────────────────────

export interface IntakeChatProps {
  /** Called with the finished Thesis when the user sends the brief to the Judge Panel. */
  onSendToJudge: (thesis: Thesis) => void;
}

// ── component ────────────────────────────────────────────────────────────────────

/** Look up the option label for a canonical value within a question (e.g.
 *  goal "grow" -> "Grow my stack"); falls back to the value itself for the
 *  free-text fields (asset/capital/target) or any unknown value. */
function labelFor(id: QuestionId, value: string): string {
  const opt = QUESTIONS.find((q) => q.id === id)?.opts.find((o) => o.v === value);
  return opt?.label ?? value;
}

/** Map the LLM's canonical IntakeFields onto the internal {value,label} shape
 *  the flow records. Drops blank fields; pretties enum values via their option
 *  label. Mirrors what parseFields produces so the two merge cleanly. */
function fieldsToParsed(
  f: IntakeFields,
): Partial<Record<QuestionId, { value: string; label: string }>> {
  const out: Partial<Record<QuestionId, { value: string; label: string }>> = {};
  (Object.keys(f) as (keyof IntakeFields)[]).forEach((k) => {
    const raw = f[k];
    if (typeof raw !== "string") return;
    const value = raw.trim();
    if (!value) return;
    out[k as QuestionId] = { value, label: labelFor(k as QuestionId, value) };
  });
  return out;
}

/** Heuristically pull any already-stated scoping fields out of free text, so we
 *  never re-ask something the user already told us. Conservative on purpose -
 *  only records a field when it is reasonably unambiguous. */
function parseFields(text: string): Partial<Record<QuestionId, { value: string; label: string }>> {
  const t = text.toLowerCase();
  const out: Partial<Record<QuestionId, { value: string; label: string }>> = {};

  const up = text.toUpperCase();
  const asset = (ASSET_SYMBOLS as readonly string[]).find((s) => new RegExp(`\\b${s}\\b`).test(up));
  if (asset) out.asset = { value: asset, label: asset };

  if (/\bhedge\b/.test(t)) out.goal = { value: "hedge", label: "Hedge a position" };
  else if (/\bscalp\b/.test(t)) out.goal = { value: "scalp", label: "Quick scalp" };
  else if (/\bswing\b/.test(t)) out.goal = { value: "swing", label: "Swing trade" };
  else if (/\b(grow|accumulate|stack|long[- ]?term)\b/.test(t))
    out.goal = { value: "grow", label: "Grow my stack" };

  const cap =
    text.match(/\$\s?([\d,]+(?:\.\d+)?)\s?(k|m)?/i) ||
    text.match(/\b([\d,]+(?:\.\d+)?)\s?(k|m)\b/i) ||
    text.match(/\b([\d,]+)\s?(usd|dollars|bucks)\b/i);
  if (cap) {
    let num = parseFloat(cap[1].replace(/,/g, ""));
    const unit = (cap[2] || "").toLowerCase();
    if (unit === "k") num *= 1e3;
    else if (unit === "m") num *= 1e6;
    if (num >= 10) {
      const label = "$" + num.toLocaleString();
      out.capital = { value: label, label };
    }
  }

  if (/\b(high risk|aggressive|degen|yolo|risky)\b/.test(t)) out.risk = { value: "high", label: "High" };
  else if (/\b(low risk|conservative|safe|cautious|protect)\b/.test(t)) out.risk = { value: "low", label: "Low" };
  else if (/\b(medium|moderate|balanced)\b/.test(t)) out.risk = { value: "med", label: "Medium" };

  // capture an explicit duration ("5 days", "2 weeks", "3 months") verbatim
  // before falling back to coarse buckets, so the user's wording is preserved.
  const durM = t.match(/\b(\d+)\s?(day|week|month)s?\b/);
  if (/\b(intraday|day[- ]?trade|today)\b/.test(t)) out.horizon = { value: "intraday", label: "Intraday" };
  else if (durM) {
    const phrase = `${durM[1]} ${durM[2]}${durM[1] === "1" ? "" : "s"}`;
    out.horizon = { value: phrase, label: phrase };
  } else if (/\b(monthly|month)\b/.test(t)) out.horizon = { value: "month", label: "~1 month" };
  else if (/\b(week|weekly)\b/.test(t)) out.horizon = { value: "week", label: "~1 week" };
  else if (/\b(few days|couple days|several days|days)\b/.test(t)) out.horizon = { value: "days", label: "A few days" };

  if (/\b(\d+x|leverage|leveraged|perp|perpetual|margin)\b/.test(t)) out.type = { value: "leverage", label: "Leverage" };
  else if (/\b(convert|swap)\b/.test(t)) out.type = { value: "convert", label: "Convert" };
  else if (/\bspot\b/.test(t)) out.type = { value: "spot", label: "Spot buy / sell" };

  const pct = text.match(/\+?\s?(\d{1,3})\s?%/);
  if (pct) {
    const l = `+${pct[1]}%`;
    out.target = { value: l, label: l };
  }

  if (/\b(no stop|without (a )?stop)\b/.test(t)) out.stop = { value: "none", label: "No stop" };
  else if (/\b(wide stop|loose stop)\b/.test(t)) out.stop = { value: "wide", label: "Wide stop" };
  else if (/\b(tight stop|stop[- ]?loss|hard stop)\b/.test(t)) out.stop = { value: "tight", label: "Tight stop" };

  return out;
}

/** Index of the first question with no recorded answer (or QUESTIONS.length). */
function firstUnanswered(ans: Answers): number {
  for (let i = 0; i < QUESTIONS.length; i++) {
    if (ans[QUESTIONS[i].id] === undefined) return i;
  }
  return QUESTIONS.length;
}

export function IntakeChat({ onSendToJudge }: IntakeChatProps) {
  const [turns, setTurns] = useState<Turn[]>([{ kind: "q", qi: 0 }]);
  const [answers, setAnswers] = useState<Answers>({});
  const [labels, setLabels] = useState<Labels>({});

  // editable brief state
  const [briefSources, setBriefSources] = useState<Record<DataSourceKey, boolean> | null>(null);
  const [briefFields, setBriefFields] = useState<Labels>({});

  // submission state
  const [submitting, setSubmitting] = useState(false);
  const [thinking, setThinking] = useState("");
  const [error, setError] = useState<string | null>(null);

  // free-chat composer (ask-anything, streamed via /api/assistant/stream)
  const [draft, setDraft] = useState("");

  // Stable session ID for the server-side InMemoryChatMessageHistory.
  // Generated once per component mount; cleared on "start over".
  const sessionIdRef = useRef<string>(crypto.randomUUID());

  // true while the LLM intake extractor is reading a free-text answer.
  const [reading, setReading] = useState(false);

  // Intake mode: "guided" = the scoped-trade wizard; "chat" = a normal
  // conversation (no field capture, no auto-brief, no tribunal push).
  const [mode, setMode] = useState<"guided" | "chat">("guided");
  const [chatTurns, setChatTurns] = useState<
    Array<{ kind: "cu"; text: string } | { kind: "cai"; message: string; tvSymbol?: AssetSymbol | null; suggestions?: string[] }>
  >([]);

  const endRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Mirrors `answers` so handlers/chart-onDone can read the latest synchronously.
  const answersRef = useRef<Answers>({});

  // Anchor the NEWEST user message just under the nav and let the assistant's
  // reply stream into the viewport below it (ChatGPT-style). Scrolling to
  // document.scrollHeight overshot: `.wrap` has a `min-height: 100vh` flex
  // filler below the short chat, so "document bottom" parked the reply off the
  // top of the screen behind the nav. Anchoring is inherently viewport-relative
  // - it scrolls exactly as far as the device height needs, no more. setTimeout,
  // not rAF, so it still fires if the tab is briefly hidden; runs post-commit.
  const scrollDown = useCallback(() => {
    setTimeout(() => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const users = chatRef.current?.querySelectorAll<HTMLElement>('[data-role="user"]');
      const last = users && users.length ? users[users.length - 1] : null;
      if (last) {
        last.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      } else {
        // No user turn yet (e.g. the first scripted question) - reveal the tail.
        endRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "end" });
      }
    }, 0);
  }, []);

  // Called on every streamed token. Only follows the growing reply when the
  // reader is already near the bottom - never yanks them back up if they
  // scrolled away to re-read, and never targets the min-height filler.
  const followStream = useCallback(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const doc = document.documentElement;
    const distanceToBottom = doc.scrollHeight - window.scrollY - window.innerHeight;
    if (distanceToBottom < 160) {
      endRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "end" });
    }
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const total = QUESTIONS.length;
  const hasBrief = turns.some((t) => t.kind === "brief");
  const answeredCount = QUESTIONS.filter((q) => answers[q.id] !== undefined).length;
  const progressText = hasBrief ? "brief ready" : `${answeredCount} / ${total}`;

  // Queue the next UNANSWERED question (or the brief) - skips anything the user
  // already told us. Reads the latest answers from the ref so it's correct even
  // right after a synchronous merge or from a chart's onDone.
  const advance = useCallback(() => {
    const nextQi = firstUnanswered(answersRef.current);
    setTurns((prev) => {
      if (prev.some((t) => t.kind === "brief")) return prev;
      if (nextQi >= total) return [...prev, { kind: "brief" }];
      if (prev.some((t) => t.kind === "q" && t.qi === nextQi)) return prev;
      return [...prev, { kind: "q", qi: nextQi }];
    });
    scrollDown();
  }, [scrollDown, total]);

  // ── answer a question via a sparkle button (single field) ──
  const choose = useCallback(
    (qi: number, value: string, label: string) => {
      const id = QUESTIONS[qi].id;
      if (answersRef.current[id] !== undefined) return; // already answered
      const merged = { ...answersRef.current, [id]: value };
      answersRef.current = merged;
      setAnswers(merged);
      setLabels((l) => ({ ...l, [id]: label }));

      const q = QUESTIONS[qi];
      setTurns((prev) => {
        const next: Turn[] = [...prev, { kind: "u", text: label }];
        if (q.chart) next.push({ kind: "chart", asset: label, fromQi: qi });
        return next;
      });
      scrollDown();

      // Non-chart questions advance immediately; chart questions advance from
      // ChartTurn's onDone so the chart has time to render.
      if (!q.chart) advance();
    },
    [scrollDown, advance],
  );

  // ── answer via free text: understand the WHOLE message with the LLM extractor
  //    (regex parseFields as a fast fallback), record every field the user
  //    stated, then jump to the next still-needed question ──
  const answerWithText = useCallback(
    async (qi: number, text: string) => {
      // (a) Show the user's bubble immediately and clear the composer.
      setTurns((prev) => [...prev, { kind: "u", text }]);
      setDraft("");
      scrollDown();

      // (b) Fast local parse up front; (c) ask the LLM in parallel. If the
      //     network call fails we still have the local result, so it never breaks.
      const local = parseFields(text);
      let llm: Partial<Record<QuestionId, { value: string; label: string }>> = {};
      setReading(true);
      try {
        llm = fieldsToParsed(await extractIntake(text));
      } catch {
        // Ignore - fall back to the local parse only.
      } finally {
        setReading(false);
      }

      // LLM result wins; the local parse only fills fields the LLM missed.
      const parsed: Partial<Record<QuestionId, { value: string; label: string }>> = {
        ...local,
        ...llm,
      };
      // Plain answer (nothing recognized either way) → treat the raw text as
      // the pending field so the question is still answered.
      if (Object.keys(parsed).length === 0) parsed[QUESTIONS[qi].id] = { value: text, label: text };

      // (c) Merge into answers, only filling fields still unanswered.
      const merged: Answers = { ...answersRef.current };
      const newly: QuestionId[] = [];
      (Object.keys(parsed) as QuestionId[]).forEach((id) => {
        if (merged[id] === undefined) {
          merged[id] = parsed[id]!.value;
          newly.push(id);
        }
      });
      answersRef.current = merged;
      setAnswers(merged);
      setLabels((l) => {
        const nl = { ...l };
        newly.forEach((id) => {
          nl[id] = parsed[id]!.label;
        });
        return nl;
      });

      // (d) If the asset got newly set, drop the inline asset chart (same as today).
      const assetSet = newly.includes("asset");
      const assetQi = QUESTIONS.findIndex((q) => q.id === "asset");
      if (assetSet) {
        setTurns((prev) => [
          ...prev,
          { kind: "chart", asset: toAssetSymbol(parsed.asset!.value), fromQi: assetQi },
        ]);
      }
      scrollDown();

      // (e) Advance to the next unanswered question. When the chart was added it
      //     advances itself from ChartTurn's onDone, so we skip the call here.
      if (!assetSet) advance();
    },
    [scrollDown, advance],
  );

  // Initialize the editable brief once it first appears.
  useEffect(() => {
    if (!hasBrief || briefSources) return;
    setBriefSources(suggestedSources(answers));
    setBriefFields({
      asset: toAssetSymbol(answers.asset ?? labels.asset),
      capital: labels.capital ?? answers.capital ?? "",
      risk: labels.risk ?? answers.risk ?? "",
      horizon: labels.horizon ?? answers.horizon ?? "",
      type: labels.type ?? answers.type ?? "",
      target: labels.target ?? answers.target ?? "",
    });
  }, [hasBrief, briefSources, answers, labels]);

  const toggleSource = (key: DataSourceKey) =>
    setBriefSources((s) => (s ? { ...s, [key]: !s[key] } : s));

  const setField = (key: QuestionId, val: string) =>
    setBriefFields((f) => ({ ...f, [key]: val }));

  // Merge the (edited) brief fields over the raw labels before composing intent.
  const effectiveIntent = useCallback(() => {
    const mergedLabels: Labels = { ...labels, ...briefFields };
    const mergedAnswers: Answers = {
      ...answers,
      type: (briefFields.type ?? answers.type) as string,
      asset: toAssetSymbol(briefFields.asset ?? answers.asset),
    };
    return buildIntent(mergedAnswers, mergedLabels);
  }, [labels, briefFields, answers]);

  const computeActiveSources = useCallback((): AIRole[] => {
    const src = briefSources ?? suggestedSources(answers);
    return (Object.keys(SOURCE_TO_ROLE) as DataSourceKey[])
      .filter((k) => src[k])
      .map((k) => SOURCE_TO_ROLE[k]);
  }, [briefSources, answers]);

  // ── confirm → real AI thesis stream → onSendToJudge ──
  const runTribunal = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const intent = effectiveIntent();
    const sources = computeActiveSources();

    setSubmitting(true);
    setError(null);
    setThinking("");

    try {
      await streamSSE(
        "/api/thesis/stream",
        { intent, activeSources: sources },
        {
          signal: ac.signal,
          onEvent(event, data) {
            if (event === "thinking") {
              const d = data as { delta?: string };
              if (d.delta) setThinking((t) => t + d.delta);
            } else if (event === "result") {
              onSendToJudge(data as Thesis);
            } else if (event === "error") {
              const d = data as { error?: string };
              setError(d.error ?? "Unknown streaming error");
            }
          },
        },
      );
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError(e instanceof Error ? e.message : "Unknown error");
      }
    } finally {
      setSubmitting(false);
    }
  }, [effectiveIntent, computeActiveSources, onSendToJudge]);

  // Stop the in-flight thesis generation (e.g. the AI is stalling).
  const stopTribunal = useCallback(() => {
    abortRef.current?.abort();
    setSubmitting(false);
    setThinking("");
  }, []);

  // ── "write your own" escape → human thesis path → onSendToJudge ──
  const writeOwn = useCallback(async () => {
    const intent = effectiveIntent();
    setSubmitting(true);
    setError(null);
    setThinking("");
    try {
      const thesis = await postThesisHuman({
        intent,
        body: intent,
        suggestedPair: toAssetSymbol(briefFields.asset ?? answers.asset),
      });
      onSendToJudge(thesis);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }, [effectiveIntent, briefFields, answers, onSendToJudge]);

  const restart = useCallback(() => {
    abortRef.current?.abort();
    setTurns([{ kind: "q", qi: 0 }]);
    setAnswers({});
    setLabels({});
    answersRef.current = {};
    setBriefSources(null);
    setBriefFields({});
    setSubmitting(false);
    setThinking("");
    setError(null);
    setDraft("");
    setChatTurns([]);
    // Drop the old session so history doesn't leak into a new conversation.
    void fetch(`/api/chat/session/${sessionIdRef.current}`, { method: "DELETE" }).catch(() => {});
    sessionIdRef.current = crypto.randomUUID();
  }, []);

  // ── free-chat: append a user bubble + a self-streaming assistant reply ──
  // This is a real chatbot turn (streamed via /api/assistant/stream, rendered
  // through AiAnswer). It is entirely separate from the scripted question flow:
  // it never records an answer and never advances the question pointer.
  const sendFreeChat = useCallback(
    (raw?: string) => {
      const text = (raw ?? draft).trim();
      if (!text) return;

      // Brief, grounded context so replies reference the trade being scoped.
      const scoped = Object.entries(labels)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      const primer: ChatMessage = {
        role: "user",
        content: scoped
          ? `Context - the trade I am scoping so far: ${scoped}. Answer my next question with that in mind, but do not restate it.`
          : "Context - I am scoping a new trade in the intake step.",
      };
      const prompt: ChatMessage[] = [primer, { role: "user", content: text }];

      const mentionedAsset = assetMentioned(text);
      const wantsChart = chartRequested(text);
      setTurns((prev) => [
        ...prev,
        { kind: "u", text },
        {
          kind: "ai-reply",
          prompt,
          asset: wantsChart ? null : mentionedAsset,
          tvSymbol: wantsChart ? mentionedAsset : null,
        },
      ]);
      setDraft("");
      scrollDown();
    },
    [draft, labels, scrollDown],
  );

  // ── render ──
  // One composer, two jobs: answer the pending scripted question OR free-chat.
  // A trailing "?" (or a leading question word) routes to the assistant;
  // anything else is treated as a typed answer to the current question.
  let pendingQi: number | null = null;
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (t.kind === "brief") break;
    if (t.kind === "q") {
      pendingQi = t.qi;
      break;
    }
  }
  const sendComposer = () => {
    const text = draft.trim();
    if (!text) return;
    const looksLikeQuestion =
      /\?\s*$/.test(text) ||
      /^(what|how|why|when|where|which|who|is|are|do|does|can|could|should|would|price|show|tell|explain|compare)\b/i.test(
        text,
      );
    if (pendingQi !== null && !looksLikeQuestion) {
      void answerWithText(pendingQi, text);
    } else {
      sendFreeChat(text);
    }
  };

  // Chat mode: a normal conversation - append the user message + a streamed
  // assistant reply (conversational endpoint). No field capture, no question
  // advance, no brief. Sends the running history so it is multi-turn.
  const sendChat = (customText?: string) => {
    const text = (customText ?? draft).trim();
    if (!text) return;
    const wantsChart = chartRequested(text);
    const mentionedAsset = assetMentioned(text);
    setChatTurns((prev) => [
      ...prev,
      { kind: "cu", text },
      { kind: "cai", message: text, tvSymbol: wantsChart ? mentionedAsset : null },
    ]);
    if (!customText) setDraft("");
    scrollDown();
  };

  const setSuggestions = useCallback((turnIndex: number, suggestions: string[]) => {
    setChatTurns((prev) =>
      prev.map((t, i) => (i === turnIndex ? { ...t, suggestions } : t)),
    );
  }, []);

  const handleSend = () => (mode === "chat" ? sendChat() : sendComposer());

  return (
    <section className={styles.wrap} id="step-1" aria-label="Scope your trade">
      <div className={styles.head}>
        <div className={styles.stepTitle}>New trade</div>
        <div className={styles.progress} aria-live="polite">
          {mode === "guided" ? progressText : "chat"}
        </div>
      </div>

      {/* Guided wizard vs free Chat */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "2px 0 16px", flexWrap: "wrap" }}>
        <div
          role="group"
          aria-label="Intake mode"
          style={{
            display: "inline-flex",
            border: "1px solid var(--line)",
            borderRadius: 999,
            padding: 3,
            background: "var(--bg2)",
            gap: 2,
          }}
        >
          {(["guided", "chat"] as const).map((m) => {
            const on = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={on}
                style={{
                  padding: "5px 16px",
                  borderRadius: 999,
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "var(--mono)",
                  fontSize: 12,
                  letterSpacing: "0.04em",
                  background: on ? "var(--gold)" : "transparent",
                  color: on ? "#1b1305" : "var(--muted)",
                  fontWeight: on ? 700 : 500,
                  transition: "all 0.15s ease",
                }}
              >
                {m === "guided" ? "Guided" : "Chat"}
              </button>
            );
          })}
        </div>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--faint)" }}>
          {mode === "guided"
            ? "scope a trade, step by step"
            : "just chat - no trade scoping"}
        </span>
        {mode === "chat" && (
          <button
            type="button"
            onClick={() => setMode("guided")}
            style={{
              marginLeft: "auto",
              fontFamily: "var(--mono)",
              fontSize: 12,
              color: "var(--gold)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 6px",
            }}
          >
            Scope a trade →
          </button>
        )}
      </div>

      <div className={styles.modelbar}>
        <span className={styles.modellab}>Assistant</span>
        <ModelChip role="assistant" />
        <span className={styles.modelhint}>answers your free-chat</span>
      </div>

      <div className={styles.chat} ref={chatRef}>
        {mode === "chat" && (
          <>
            {chatTurns.length === 0 && (
              <div className={styles.aturn}>
                <div className={styles.think}>
                  <span className={styles.chev}>▸</span>
                  Chat mode
                </div>
                <div style={{ color: "var(--muted)", lineHeight: 1.6 }}>
                  Ask me anything - prices, what is moving, how Autonoe works. I won&apos;t push
                  you to scope a trade. Switch to Guided (or hit &quot;Scope a trade&quot;) when
                  you&apos;re ready.
                </div>
              </div>
            )}
            {chatTurns.map((t, i) => {
              if (t.kind === "cu") {
                return (
                  <div className={styles.uturn} key={i} data-role="user">
                    <div className={styles.ubub}>{t.text}</div>
                  </div>
                );
              }
              // Count how many AI turns came before this one to determine
              // whether to show the full badge or just the icon.
              const aiIndex = chatTurns.slice(0, i).filter((x) => x.kind === "cai").length;
              return (
                <AiReplyTurn
                  key={i}
                  sessionId={sessionIdRef.current}
                  message={t.message}
                  asset={null}
                  tvSymbol={t.tvSymbol}
                  onStream={followStream}
                  endpoint="/api/chat/stream"
                  compact={aiIndex > 0}
                  onSuggestions={(s) => setSuggestions(i, s)}
                  suggestions={t.suggestions}
                  onSuggestionClick={(s) => sendChat(s)}
                />
              );
            })}
          </>
        )}
        {mode === "guided" &&
          turns.map((turn, i) => {
            if (turn.kind === "u") {
            return (
              <div className={styles.uturn} key={i} data-role="user">
                <div className={styles.ubub}>{turn.text}</div>
              </div>
            );
          }
          if (turn.kind === "chart") {
            return <ChartTurn key={i} asset={turn.asset} onDone={() => advance()} />;
          }
          if (turn.kind === "ai-reply") {
            return (
              <AiReplyTurn key={i} prompt={turn.prompt} asset={turn.asset} tvSymbol={turn.tvSymbol} onStream={followStream} />
            );
          }
          if (turn.kind === "brief") {
            return (
              <BriefCard
                key={i}
                answers={answers}
                fields={briefFields}
                sources={briefSources ?? suggestedSources(answers)}
                intent={effectiveIntent()}
                submitting={submitting}
                thinking={thinking}
                error={error}
                onToggleSource={toggleSource}
                onField={setField}
                onRun={runTribunal}
                onStop={stopTribunal}
                onWriteOwn={writeOwn}
                onRestart={restart}
              />
            );
          }
          // Options stay live for the question still awaiting an answer, i.e. the
          // newest question turn with no later question or brief after it. Free-chat
          // turns (u / ai-reply) appended in between do NOT retire the question, so
          // the sparkle buttons keep working even after an interleaved chat reply.
          const answered = turns
            .slice(i + 1)
            .some((t) => t.kind === "q" || t.kind === "brief");
          return (
            <QuestionTurn
              key={i}
              q={QUESTIONS[turn.qi]}
              qi={turn.qi}
              showOptions={!answered}
              onChoose={choose}
            />
          );
        })}
        {mode === "guided" && reading && (
          <div className={styles.aturn} aria-live="polite">
            <div className={styles.think}>
              <span className={styles.chev}>▸</span>
              Reading your answer
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* persistent free-chat composer - ask anything; streams an assistant reply.
          Independent of the scripted questions and the brief hand-off. The dock
          is sticky (in flow) so it pins to the viewport bottom while scrolling
          yet never overlaps the footer below it. */}
      <div className={styles.composerDock}>
      <div className={styles.composer}>
        <textarea
          className={styles.composerInput}
          rows={1}
          placeholder={
            mode === "chat"
              ? "Message Autonoe - ask anything (e.g. “what's BTC doing?”)"
              : "Type your answer - or ask anything (e.g. “what's BTC doing?”)"
          }
          aria-label={mode === "chat" ? "Message Autonoe" : "Type your answer or ask the assistant anything"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <button
          type="button"
          className={styles.composerSend}
          aria-label="Send message"
          onClick={handleSend}
          disabled={!draft.trim()}
        >
          <SendIcon />
        </button>
      </div>
      <div className={styles.composerHint}>
        {mode === "chat"
          ? "Normal conversation · nothing is captured as a trade · switch to Guided to scope one"
          : "Tap a chip to answer · or type your answer here · end with “?” to ask the assistant anything"}
      </div>
      </div>
    </section>
  );
}

// ── question turn ────────────────────────────────────────────────────────────────

function QuestionTurn({
  q,
  qi,
  showOptions,
  onChoose,
}: {
  q: Question;
  qi: number;
  showOptions: boolean;
  onChoose: (qi: number, value: string, label: string) => void;
}) {
  const [textDone, setTextDone] = useState(false);

  return (
    <div className={styles.aturn}>
      {q.think && (
        <div className={styles.think}>
          <span className={styles.chev}>▸</span>
          {q.think}
        </div>
      )}
      <div className={styles.atext}>
        <StreamText text={stripHtml(q.q)} html={q.q} onDone={() => setTextDone(true)} />
      </div>

      {textDone && showOptions && (
        <div className={styles.options}>
          {q.opts.map((o) => (
            <button
              key={o.v}
              type="button"
              className={`${styles.optrow}${o.warn ? ` ${styles.warn}` : ""}`}
              onClick={() => onChoose(qi, o.v, o.label)}
            >
              <span className={styles.spark}>✦</span>
              <span>{o.label}</span>
              {o.sub && <span className={styles.osub}>{o.sub}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── chart turn (assistant text + inline candle chart) ────────────────────────────

function ChartTurn({ asset, onDone }: { asset: string; onDone: () => void }) {
  const [textDone, setTextDone] = useState(false);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!textDone || firedRef.current) return;
    firedRef.current = true;
    const id = setTimeout(onDone, 650);
    return () => clearTimeout(id);
  }, [textDone, onDone]);

  return (
    <div className={styles.aturn}>
      <div className={styles.think}>
        <span className={styles.chev}>▸</span>
        Pulling {asset} from Bybit
      </div>
      <div className={styles.atext}>
        <StreamText
          text={`Quick read on ${asset} before we size it - here is the recent action:`}
          onDone={() => setTextDone(true)}
        />
      </div>
      {textDone && <TradingViewChart spec={{ symbol: asset, exchange: "BYBIT", interval: "60" }} />}
    </div>
  );
}

// ── free-chat AI reply turn (streamed assistant, rich rendering) ─────────────────

/**
 * Self-contained streamed assistant reply, modeled on the Trade AiRail's
 * AssistantPane: POSTs the conversation to /api/assistant/stream, accumulates
 * `token` deltas, then commits the `result`. Renders through <AiAnswer> so any
 * fenced chart / heatmap blocks and GFM tables the model emits become inline
 * SVG/tables - with a blinking caret while streaming. If the user's message
 * named a single known asset, a live Bybit sparkline (InlineChart) is shown too.
 */
function AiReplyTurn({
  prompt,
  sessionId,
  message,
  asset,
  tvSymbol,
  onStream,
  endpoint = "/api/assistant/stream",
  onDone,
  compact = false,
  onSuggestions,
  suggestions,
  onSuggestionClick,
}: {
  /** Full message array — used by guided-mode free-chat (/api/assistant/stream). */
  prompt?: ChatMessage[];
  /** Session ID for server-side history — used by chat mode (/api/chat/stream). */
  sessionId?: string;
  /** Single new user message — used together with sessionId. */
  message?: string;
  asset: AssetSymbol | null;
  tvSymbol?: AssetSymbol | null;
  onStream: () => void;
  endpoint?: string;
  onDone?: (text: string) => void;
  compact?: boolean;
  onSuggestions?: (s: string[]) => void;
  suggestions?: string[];
  onSuggestionClick?: (text: string) => void;
}) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const accRef = useRef("");
  const acRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Start (or restart, under React StrictMode's double-mount) the stream.
    // The cleanup aborts the prior attempt, so we reset and re-stream cleanly.
    const ac = new AbortController();
    acRef.current = ac;
    accRef.current = "";
    setContent("");
    setError(null);
    setLoading(true);

    (async () => {
      try {
        // Chat mode uses sessionId+message (server holds history).
        // Guided free-chat uses the full prompt array (stateless).
        const body = sessionId && message
          ? { sessionId, message }
          : { messages: prompt };

        let finalMessage: ChatMessage | null = null;
        await streamSSE(
          endpoint,
          body,
          {
            signal: ac.signal,
            onEvent(event, data) {
              if (event === "token") {
                const d = data as { delta?: string };
                if (d.delta) {
                  accRef.current += d.delta;
                  setContent(accRef.current);
                  onStream();
                }
              } else if (event === "result") {
                finalMessage = data as ChatMessage;
              } else if (event === "suggestions") {
                const d = data as { suggestions?: string[] };
                if (Array.isArray(d.suggestions)) onSuggestions?.(d.suggestions);
              } else if (event === "error") {
                const d = data as { error?: string };
                setError(d.error ?? "Unknown streaming error");
              }
            },
          },
        );
        if (finalMessage) setContent((finalMessage as ChatMessage).content);
      } catch (e) {
        if ((e as { name?: string }).name !== "AbortError") {
          setError(e instanceof Error ? e.message : "Unknown error");
        }
      } finally {
        setLoading(false);
        onStream();
        // report the completed reply so chat mode can keep conversation history
        if (accRef.current) onDone?.(accRef.current);
      }
    })();

    return () => ac.abort();
    // prompt/onStream are stable for this turn; run the stream exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.aturn}>
      <div className={styles.aihead}>
        <span className={styles.aidot}>
          <BoltIcon />
        </span>
        {!compact && <span className={styles.aiwho}>Autonoe</span>}
        {!compact && <span className={styles.aitag}>AI</span>}
        {loading && (
          <button
            type="button"
            onClick={() => acRef.current?.abort()}
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 10px",
              borderRadius: 8,
              border: "1px solid var(--line)",
              background: "rgba(255,255,255,0.02)",
              color: "var(--muted)",
              fontFamily: "var(--mono)",
              fontSize: 11,
              cursor: "pointer",
            }}
            aria-label="Stop the reply"
          >
            <span
              style={{
                width: 8,
                height: 8,
                background: "currentColor",
                borderRadius: 2,
                display: "inline-block",
              }}
            />
            Stop
          </button>
        )}
      </div>

      {content ? (
        <AiAnswer text={content} streaming={loading} />
      ) : loading ? (
        <div className={styles.aipending}>Thinking</div>
      ) : null}

      {error && (
        <div className={styles.notice} role="alert">
          <WarnIcon />
          {error}
        </div>
      )}

      {/* TradingView interactive chart when the user explicitly asked for one */}
      {tvSymbol && !error && <TradingViewChart spec={{ symbol: tvSymbol, exchange: "BYBIT", interval: "60" }} />}
      {/* live Bybit sparkline for quick price lookups */}
      {asset && !loading && !error && <TradingViewChart spec={{ symbol: asset, exchange: "BYBIT", interval: "60" }} />}

      {/* Follow-up suggestion chips */}
      {!loading && !error && suggestions && suggestions.length > 0 && (
        <div className={styles.suggestions}>
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className={styles.suggChip}
              onClick={() => onSuggestionClick?.(s)}
            >
              <span className={styles.suggArrow}>↳</span>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── editable trade brief ─────────────────────────────────────────────────────────

function BriefCard({
  answers,
  fields,
  sources,
  intent,
  submitting,
  thinking,
  error,
  onToggleSource,
  onField,
  onRun,
  onStop,
  onWriteOwn,
  onRestart,
}: {
  answers: Answers;
  fields: Labels;
  sources: Record<DataSourceKey, boolean>;
  intent: string;
  submitting: boolean;
  thinking: string;
  error: string | null;
  onToggleSource: (key: DataSourceKey) => void;
  onField: (key: QuestionId, val: string) => void;
  onRun: () => void;
  onStop: () => void;
  onWriteOwn: () => void;
  onRestart: () => void;
}) {
  const [briefTextDone, setBriefTextDone] = useState(false);
  const isLeverage = (fields.type ?? answers.type) === "leverage";

  return (
    <>
      <div className={styles.aturn}>
        <div className={styles.think}>
          <span className={styles.chev}>▸</span>
          Assembling your brief
        </div>
        <div className={styles.atext}>
          <StreamText
            text="Got it - here's your brief. Tweak anything, then send it to the tribunal."
            onDone={() => setBriefTextDone(true)}
          />
        </div>
      </div>

      {briefTextDone && (
        <div className={styles.brief}>
          <h3 className={styles.briefH}>Trade brief</h3>
          <div className={styles.briefSub}>Auto-built from your answers · editable</div>

          <p
            className={styles.statement}
            dangerouslySetInnerHTML={{ __html: escapeHtml(intent) }}
          />

          <div className={styles.bgrid}>
            <BriefField label="Asset" value={fields.asset ?? ""} tone="amber" onChange={(v) => onField("asset", v)} />
            <BriefField label="Capital" value={fields.capital ?? ""} onChange={(v) => onField("capital", v)} />
            <BriefField label="Risk" value={fields.risk ?? ""} onChange={(v) => onField("risk", v)} />
            <BriefField label="Horizon" value={fields.horizon ?? ""} onChange={(v) => onField("horizon", v)} />
            <BriefField
              label="Trade type"
              value={fields.type ?? ""}
              tone={isLeverage ? "red" : undefined}
              onChange={(v) => onField("type", v)}
            />
            <BriefField label="Target" value={fields.target ?? ""} tone="green" onChange={(v) => onField("target", v)} />
          </div>

          <div className={styles.sources}>
            <span className={styles.bk}>Data sources the agents will use (auto-suggested)</span>
            <div className={styles.pillrow} role="group" aria-label="Data sources">
              {ALL_SOURCES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={`${styles.ds}${sources[s.key] ? ` ${styles.on}` : ""}`}
                  aria-pressed={sources[s.key]}
                  onClick={() => onToggleSource(s.key)}
                >
                  <span className={styles.dot} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <button type="button" className={styles.run} onClick={onRun} disabled={submitting}>
            {submitting ? (
              <>
                <svg className={styles.spin} viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="20 8" />
                </svg>
                Running the tribunal…
              </>
            ) : (
              <>
                Run the tribunal
                <ArrowRightIcon />
              </>
            )}
          </button>

          {submitting && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onStop}
              style={{
                marginTop: 10,
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                fontSize: 13,
              }}
              aria-label="Stop generating the thesis"
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  background: "currentColor",
                  borderRadius: 2,
                  display: "inline-block",
                }}
              />
              Stop generating
            </button>
          )}

          {submitting && thinking && <div className={styles.streamline}>{thinking}</div>}

          {error && (
            <div className={styles.notice} role="alert">
              <WarnIcon />
              {error}
            </div>
          )}

          <div className={styles.restartRow}>
            <button type="button" className={styles.restart} onClick={onWriteOwn} disabled={submitting}>
              <PenIcon style={{ width: 11, height: 11, verticalAlign: "-1px", marginRight: 4 }} />
              send as a written case instead
            </button>
            <span style={{ color: "var(--faint)", margin: "0 8px" }}>·</span>
            <button type="button" className={styles.restart} onClick={onRestart} disabled={submitting}>
              start over
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function BriefField({
  label,
  value,
  tone,
  onChange,
}: {
  label: string;
  value: string;
  tone?: "amber" | "green" | "red";
  onChange: (v: string) => void;
}) {
  const toneClass = tone ? ` ${styles[tone]}` : "";
  return (
    <div className={styles.bf}>
      <div className={styles.bk}>{label}</div>
      <input
        className={`${styles.bv}${toneClass} ${styles.bvedit}`}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
