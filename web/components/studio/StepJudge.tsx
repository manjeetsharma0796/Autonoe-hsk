"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DebateResult, DebateTurn, Thesis } from "@autonoe/shared";
import styles from "./studio.module.css";
import roundStyles from "./judge/round.module.css";
import { WarnIcon } from "./icons";
import { streamSSE } from "@/lib/stream";
import { ModelChip } from "@/components/ai/ModelChip";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import {
  ContestedStrip,
  EditableOptionCard,
  OutcomesChart,
  RoundHeader,
  StreamCaret,
  TribunalPanelShell,
  buildSeries,
  extractContested,
  useTypewriter,
} from "@/components/studio/judge";
import type { PanelAccent, PanelState, TribunalStatus } from "@/components/studio/judge";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Phase within a single tribunal round:
 *   loading   - SSE in flight, no data yet
 *   opening   - parallel sup+dis opening typewriters running
 *   debating  - alternating rebuttals play one at a time (active panel glows)
 *   ruling    - judge typewriter running
 *   done      - all typewriters complete, verdict + chart revealed
 */
type RoundPhase = "loading" | "opening" | "debating" | "ruling" | "done";

interface DebateRound {
  id: number;
  result: DebateResult | null;
  error: string | null;
  phase: RoundPhase;
  /** Which panel is currently animating. */
  active: "sup" | "dis" | "both" | "jud" | null;
  selectedRef: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AGENTS = [
  {
    key: "sup",
    role: "Supporter",
    heading: "Argues for the thesis",
    trace: "supporter" as const,
    status: "Building the strongest case for the thesis",
    accent: "green" as PanelAccent,
  },
  {
    key: "dis",
    role: "Discriminator",
    heading: "Argues against the thesis",
    trace: "discriminator" as const,
    status: "Stress-testing the thesis for weaknesses",
    accent: "red" as PanelAccent,
  },
  {
    key: "jud",
    role: "Judge",
    heading: "Delivers the verdict",
    trace: "judge" as const,
    status: "Weighing both sides and scoring confidence",
    accent: "amber" as PanelAccent,
  },
] as const;

const ACCENT_VAR: Record<PanelAccent, string> = {
  green: "var(--green)",
  red: "var(--red)",
  amber: "var(--gold)",
};

const ROLE_TO_KEY: Record<"supporter" | "discriminator", "sup" | "dis"> = {
  supporter: "sup",
  discriminator: "dis",
};

function seedFromId(id: string): number {
  let s = 0;
  for (let i = 0; i < id.length; i++) s = (s + id.charCodeAt(i)) % 2147483647;
  return s;
}

// ── contested-number highlighting + reply icon ────────────────────────────────

/** Wrap any contested token occurrence in an inline <mark>. */
function highlightContested(text: string, tokens: string[]): React.ReactNode {
  const toks = tokens.filter(Boolean);
  if (toks.length === 0) return text;
  const esc = [...toks]
    .sort((a, b) => b.length - a.length) // longer first so "78.8" wins over "8"
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${esc.join("|")})`, "g");
  const set = new Set(toks);
  return text.split(re).map((part, i) =>
    set.has(part) ? (
      <mark key={i} className={roundStyles.hot}>
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function ReplyIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="9 10 4 15 9 20" />
      <path d="M20 4v7a4 4 0 0 1-4 4H4" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4Z" />
    </svg>
  );
}

/** Filled square - "stop / abort the in-flight request". */
function StopIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="5" y="5" width="14" height="14" rx="2.5" />
    </svg>
  );
}

/** Balance-scale glyph for the Judge's verdict line. */
function VerdictIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v18" />
      <path d="M5 7h14" />
      <path d="m5 7-3 6a3 3 0 0 0 6 0z" />
      <path d="m19 7-3 6a3 3 0 0 0 6 0z" />
      <path d="M8 21h8" />
    </svg>
  );
}

/** "+12.3%" / "-4.0%" - signed, one decimal. */
function fmtSignedPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

// ── PanelArgument - typewriter, then contested highlight on completion ────────

function PanelArgument({
  text,
  tokens,
  accentVar,
  animate,
  onDone,
}: {
  text: string;
  tokens: string[];
  accentVar: string;
  animate: boolean;
  onDone?: () => void;
}) {
  const { shown, done } = useTypewriter(text, { enabled: animate, wordMs: 22 });

  const notifiedRef = useRef(false);
  useEffect(() => {
    if (done && !notifiedRef.current) {
      notifiedRef.current = true;
      onDone?.();
    }
  }, [done, onDone]);

  return (
    <div className={roundStyles.argText}>
      {done ? highlightContested(text, tokens) : shown}
      {!done && <StreamCaret color={accentVar} />}
    </div>
  );
}

// ── AskAgent - per-panel follow-up: interrogate one agent in its own voice ─────

interface AskAgentProps {
  agentKey: "sup" | "dis" | "jud";
  role: string;
  accentVar: string;
  thesis: Thesis;
  result: DebateResult;
}

function AskAgent({ agentKey, role, accentVar, thesis, result }: AskAgentProps) {
  const [draft, setDraft] = useState("");
  const [exchanges, setExchanges] = useState<{ q: string; a: string }[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [streamed, setStreamed] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Force the panel to scroll to the bottom (the new question + incoming reply).
  // The passive AutoScroll only sticks when the user is already near the bottom,
  // so on an explicit submit we scroll regardless. setTimeout (not rAF) so it
  // still fires when the tab is briefly hidden.
  const scrollPanelToBottom = useCallback(() => {
    setTimeout(() => {
      const sc = formRef.current?.closest('[data-scroll="panel"]') as HTMLElement | null;
      if (sc) sc.scrollTop = sc.scrollHeight;
    }, 0);
  }, []);

  // Panel key -> the debate role the backend's /api/debate/ask expects.
  const debateRole =
    agentKey === "sup" ? "supporter" : agentKey === "dis" ? "discriminator" : "judge";

  const ask = useCallback(async () => {
    const q = draft.trim();
    if (!q || busy) return;
    setDraft("");
    setBusy(true);
    setPending(q);
    setStreamed("");
    scrollPanelToBottom();

    const ctrl = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ctrl;

    let acc = "";
    let finalContent = "";
    try {
      // Dedicated in-character endpoint: this panel replies in its own voice on
      // its own model, grounded in the debate (and may pull fresh live data) -
      // not the generic assistant's "## briefing / send it to the tribunal".
      await streamSSE(
        "/api/debate/ask",
        {
          role: debateRole,
          question: q,
          intent: thesis.intent,
          supporterArgument: result.supporterArgument,
          discriminatorArgument: result.discriminatorArgument,
          judgeSummary: result.judgeSummary,
        },
        {
          signal: ctrl.signal,
          onEvent(event, data) {
            if (event === "token") {
              const d = data as { delta?: string };
              if (d.delta) {
                acc += d.delta;
                setStreamed(acc);
              }
            } else if (event === "result") {
              const d = data as { content?: string };
              if (typeof d.content === "string") finalContent = d.content;
            } else if (event === "error") {
              const d = data as { error?: string };
              acc = acc || `(${d.error ?? "the model could not reply"})`;
            }
          },
        },
      );
      const answer = (finalContent || acc).trim() || "(no reply)";
      setExchanges((prev) => [...prev, { q, a: answer }]);
    } catch (e) {
      const aborted = (e as { name?: string }).name === "AbortError";
      if (!aborted) {
        setExchanges((prev) => [...prev, { q, a: acc || "Could not reach the model." }]);
      } else if (acc.trim()) {
        // user stopped mid-stream - keep whatever did come through
        setExchanges((prev) => [...prev, { q, a: `${acc.trim()} …(stopped)` }]);
      }
    } finally {
      setPending(null);
      setStreamed("");
      setBusy(false);
    }
  }, [draft, busy, debateRole, thesis.intent, result, scrollPanelToBottom]);

  return (
    <>
      {(exchanges.length > 0 || pending !== null) && (
        <div className={roundStyles.thread} style={{ marginTop: 14 }}>
          {exchanges.map((ex, i) => (
            <div key={i} className={roundStyles.msg}>
              <div className={roundStyles.askUser}>{ex.q}</div>
              <div className={roundStyles.msgBox} style={{ marginTop: 8 }}>
                <div className={roundStyles.argText}>{ex.a}</div>
              </div>
            </div>
          ))}
          {pending !== null && (
            <div className={roundStyles.msg}>
              <div className={roundStyles.askUser}>{pending}</div>
              <div className={roundStyles.msgBox} style={{ marginTop: 8 }}>
                <div className={roundStyles.argText}>
                  {streamed}
                  <StreamCaret color={accentVar} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <form
        ref={formRef}
        className={roundStyles.ask}
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
      >
        <input
          className={roundStyles.askInput}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Ask the ${role}…`}
          disabled={busy}
          aria-label={`Ask the ${role} a follow-up question`}
        />
        <button
          type={busy ? "button" : "submit"}
          className={roundStyles.askSend}
          onClick={busy ? () => abortRef.current?.abort() : undefined}
          disabled={!busy && draft.trim().length === 0}
          aria-label={busy ? `Stop the ${role}` : `Send your question to the ${role}`}
          title={busy ? "Stop" : "Send"}
        >
          {busy ? <StopIcon /> : <SendIcon />}
        </button>
      </form>
    </>
  );
}

// ── AutoScroll - a bounded scroll area that sticks to the newest content ──────
// Keeps the latest streamed turn / reply in view, but only while the user is
// already near the bottom (so scrolling up to re-read an earlier turn isn't
// yanked back down).

function AutoScroll({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroll = scrollRef.current;
    const inner = innerRef.current;
    if (!scroll || !inner || typeof ResizeObserver === "undefined") return;
    const stick = () => {
      const gap = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight;
      if (gap < 120) scroll.scrollTop = scroll.scrollHeight;
    };
    const ro = new ResizeObserver(stick);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={scrollRef} className={className} data-scroll="panel">
      <div ref={innerRef} className={styles.twScrollInner}>
        {children}
      </div>
    </div>
  );
}

// ── SingleRound - one tribunal evaluation, played turn by turn ─────────────────

interface SingleRoundProps {
  round: DebateRound;
  roundNumber: number;
  thesis: Thesis;
  /** True when the user is on Step 2 (drives animations). */
  active: boolean;
  onPhaseChange: (id: number, phase: RoundPhase, active: DebateRound["active"]) => void;
  onSelectRef: (id: number, ref: string | null) => void;
}

function SingleRound({
  round,
  roundNumber,
  thesis,
  active,
  onPhaseChange,
  onSelectRef,
}: SingleRoundProps) {
  const { result, error, phase, selectedRef } = round;

  // Derived turn structure: parallel openings, then the ordered rebuttals.
  // Falls back to the legacy single-argument shape if `turns` is absent.
  const openings = useMemo<DebateTurn[]>(() => {
    const fromTurns = (result?.turns ?? []).filter((t) => t.kind === "opening");
    if (fromTurns.length) return fromTurns;
    if (result) {
      return [
        { role: "supporter", kind: "opening", text: result.supporterArgument },
        { role: "discriminator", kind: "opening", text: result.discriminatorArgument },
      ];
    }
    return [];
  }, [result]);

  const rebuttals = useMemo<DebateTurn[]>(
    () => (result?.turns ?? []).filter((t) => t.kind === "rebuttal"),
    [result],
  );

  // Which rebuttal is currently animating during the "debating" phase.
  const [rebuttalIdx, setRebuttalIdx] = useState(0);

  // Opening-completion tracking (both must finish before the debate starts).
  const supOpenDoneRef = useRef(false);
  const disOpenDoneRef = useRef(false);

  const startDebate = useCallback(() => {
    if (round.phase !== "opening") return;
    if (rebuttals.length === 0) {
      onPhaseChange(round.id, "ruling", "jud");
    } else {
      setRebuttalIdx(0);
      onPhaseChange(round.id, "debating", ROLE_TO_KEY[rebuttals[0].role]);
    }
  }, [round.id, round.phase, rebuttals, onPhaseChange]);

  const handleSupOpenDone = useCallback(() => {
    supOpenDoneRef.current = true;
    if (disOpenDoneRef.current) startDebate();
  }, [startDebate]);
  const handleDisOpenDone = useCallback(() => {
    disOpenDoneRef.current = true;
    if (supOpenDoneRef.current) startDebate();
  }, [startDebate]);

  // A rebuttal finished → advance to the next one, or move on to the ruling.
  const handleRebuttalDone = useCallback(() => {
    if (round.phase !== "debating") return;
    const next = rebuttalIdx + 1;
    if (next >= rebuttals.length) {
      onPhaseChange(round.id, "ruling", "jud");
    } else {
      setRebuttalIdx(next);
      onPhaseChange(round.id, "debating", ROLE_TO_KEY[rebuttals[next].role]);
    }
  }, [round.id, round.phase, rebuttalIdx, rebuttals, onPhaseChange]);

  const handleJudgeDone = useCallback(() => {
    if (round.phase === "ruling") onPhaseChange(round.id, "done", null);
  }, [round.id, round.phase, onPhaseChange]);

  // How many rebuttals are revealed (the current one is included while debating).
  const revealedRebuttals =
    phase === "debating"
      ? rebuttalIdx + 1
      : phase === "ruling" || phase === "done"
        ? rebuttals.length
        : 0;

  // Per-panel glow state.
  function panelState(key: "sup" | "dis" | "jud"): PanelState {
    if (!result) return phase === "loading" ? (key === "jud" ? "waiting" : "speaking") : "idle";
    if (phase === "done") return "done";
    if (phase === "opening") return key === "jud" ? "waiting" : "speaking";
    if (phase === "debating") {
      const activeKey = rebuttals[rebuttalIdx] ? ROLE_TO_KEY[rebuttals[rebuttalIdx].role] : null;
      return key === activeKey ? "speaking" : "waiting";
    }
    if (phase === "ruling") return key === "jud" ? "speaking" : "done";
    return "done";
  }

  const tribunalStatus: TribunalStatus = (() => {
    if (!result) return phase === "loading" ? "opening" : "idle";
    if (phase === "opening" || phase === "debating") return "debating";
    if (phase === "ruling") return "ruling";
    if (phase === "done") return "done";
    return "idle";
  })();

  const contested = useMemo(
    () => (result ? extractContested(result.supporterArgument, result.discriminatorArgument) : []),
    [result],
  );

  const series = useMemo(() => {
    if (!result || result.refinedOptions.length === 0) return null;
    return buildSeries(
      seedFromId(thesis.id + String(roundNumber)),
      result.refinedOptions.map((o) => o.optionRef),
      result.refinedOptions.map((o) => o.predictedOutputPct),
    );
  }, [result, thesis.id, roundNumber]);

  const bestOption = result
    ? [...result.refinedOptions].sort((a, b) => b.confidence - a.confidence)[0]
    : null;

  // The stacked message list for one adversary column.
  function messagesFor(key: "sup" | "dis") {
    const role = key === "sup" ? "supporter" : "discriminator";
    const out: {
      text: string;
      replyTo?: string;
      animate: boolean;
      onDone?: () => void;
      turnKey: string;
    }[] = [];

    const opening = openings.find((t) => t.role === role);
    if (opening) {
      out.push({
        text: opening.text,
        animate: active && phase === "opening",
        onDone: key === "sup" ? handleSupOpenDone : handleDisOpenDone,
        turnKey: `${key}-open`,
      });
    }
    rebuttals.forEach((t, gi) => {
      if (t.role !== role || gi >= revealedRebuttals) return;
      const isCurrent = phase === "debating" && gi === rebuttalIdx;
      out.push({
        text: t.text,
        replyTo: t.repliesTo,
        animate: active && isCurrent,
        onDone: isCurrent ? handleRebuttalDone : undefined,
        turnKey: `${key}-reb-${gi}`,
      });
    });
    return out;
  }

  return (
    <div className={roundStyles.round}>
      <div className={roundStyles.header}>
        <RoundHeader round={roundNumber} intent={thesis.intent} status={tribunalStatus} />
      </div>

      {error && (
        <div className={`${styles.notice}`} style={{ marginTop: 16 }}>
          <WarnIcon />
          {error}
        </div>
      )}

      {/* Three agent panels */}
      <div className={roundStyles.panels}>
        {AGENTS.map((a) => {
          const ps = panelState(a.key);
          const isAdversary = a.key === "sup" || a.key === "dis";
          const showJudge = a.key === "jud" && (phase === "ruling" || phase === "done");

          return (
            <TribunalPanelShell key={a.key} accent={a.accent} state={ps}>
              <div className={`${styles.tw} ${styles[a.key]}`}>
                <div className={styles.twHead}>
                  <span className={styles.twIc}>
                    <i />
                  </span>
                  <div className={styles.twMeta}>
                    <div className={styles.twRole}>{a.role}</div>
                    <div className={styles.twHeading}>{a.heading}</div>
                  </div>
                  {phase === "loading" && (
                    <span className={styles.twWait}>
                      <Spinner size={16} />
                    </span>
                  )}
                </div>

                <AutoScroll className={styles.twBody}>
                  {!result ? (
                    phase === "loading" ? (
                      <div className={styles.twStatus}>
                        <Spinner size={15} />
                        <span>{a.status}…</span>
                      </div>
                    ) : (
                      <div className={styles.twStatus}>
                        <span>Choose this panel&apos;s model above, then run the tribunal.</span>
                      </div>
                    )
                  ) : isAdversary ? (
                    <>
                      <div className={roundStyles.thread}>
                        {messagesFor(a.key).map((m) => (
                          <div key={m.turnKey} className={roundStyles.msg}>
                            {m.replyTo && (
                              <div className={roundStyles.replyTo}>
                                <ReplyIcon />
                                replying to {m.replyTo}
                              </div>
                            )}
                            <div className={roundStyles.msgBox}>
                              <PanelArgument
                                text={m.text}
                                tokens={contested}
                                accentVar={ACCENT_VAR[a.accent]}
                                animate={m.animate}
                                onDone={m.onDone}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      {phase === "done" && (
                        <AskAgent
                          agentKey={a.key}
                          role={a.role}
                          accentVar={ACCENT_VAR[a.accent]}
                          thesis={thesis}
                          result={result}
                        />
                      )}
                    </>
                  ) : showJudge ? (
                    <>
                      <div className={roundStyles.thread}>
                        <div className={roundStyles.msg}>
                          <div className={roundStyles.msgBox}>
                            <PanelArgument
                              text={result.judgeSummary}
                              tokens={contested}
                              accentVar={ACCENT_VAR[a.accent]}
                              animate={active && phase === "ruling"}
                              onDone={handleJudgeDone}
                            />
                          </div>
                        </div>
                      </div>
                      {phase === "done" && bestOption && (
                        <div className={roundStyles.verdictLine}>
                          <VerdictIcon />
                          Verdict: {bestOption.optionRef} · {fmtSignedPct(bestOption.predictedOutputPct)} ·{" "}
                          {Math.round(bestOption.confidence * 100)}% confidence
                        </div>
                      )}
                      {phase === "done" && (
                        <AskAgent
                          agentKey="jud"
                          role="Judge"
                          accentVar={ACCENT_VAR[a.accent]}
                          thesis={thesis}
                          result={result}
                        />
                      )}
                    </>
                  ) : (
                    <div className={styles.twStatus}>
                      <span className={roundStyles.waitingDot} />
                      <span>… awaiting the debate</span>
                    </div>
                  )}
                </AutoScroll>
              </div>
            </TribunalPanelShell>
          );
        })}
      </div>

      {/* Contested strip */}
      {result && contested.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <ContestedStrip tokens={contested} />
        </div>
      )}

      {/* Outcomes chart */}
      {result && phase === "done" && series && (
        <div style={{ marginTop: 22 }}>
          <OutcomesChart
            baseline={series.baseline}
            options={series.options}
            bars={series.bars}
            symbolLabel={thesis.suggestedPair}
          />
        </div>
      )}

      {/* Refined option cards */}
      {result && phase === "done" && result.refinedOptions.length > 0 && (
        <>
          <div className={`${styles.opthead}`} style={{ marginTop: 40 }}>
            <h3>Refined options</h3>
            <span className={styles.cnt}>
              Re-scored by the panel · predicted % · risk · caveats · confidence
            </span>
          </div>
          <div className={styles.refgrid}>
            {result.refinedOptions.map((opt) => (
              <EditableOptionCard
                key={opt.optionRef}
                opt={opt}
                thesis={thesis}
                animate={active}
                judgeSummary={result.judgeSummary}
                selected={selectedRef === opt.optionRef}
                onSelect={() =>
                  onSelectRef(round.id, selectedRef === opt.optionRef ? null : opt.optionRef)
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── TribunalSetup - pre-run config: per-role models + how many exchanges ──────

function TribunalSetup({
  iterations,
  onIterations,
  onRun,
  isFirst,
  disabled,
}: {
  iterations: number;
  onIterations: (n: number) => void;
  onRun: () => void;
  isFirst: boolean;
  disabled?: boolean;
}) {
  const totalTurns = 2 + iterations * 2;
  return (
    <div className={roundStyles.setup}>
      <div className={roundStyles.setupHead}>
        <div className={roundStyles.setupKicker}>
          {isFirst ? "Configure the tribunal" : "Re-evaluate · new round"}
        </div>
        <div className={roundStyles.setupTitle}>
          Choose each panel&apos;s model and how hard they argue, then run.
        </div>
      </div>

      <div className={roundStyles.setupRoles}>
        {AGENTS.map((a) => (
          <div key={a.key} className={roundStyles.setupRole}>
            <div className={roundStyles.setupRoleHead}>
              <span
                className={roundStyles.setupDot}
                style={{ background: ACCENT_VAR[a.accent] }}
              />
              <span className={roundStyles.setupRoleName}>{a.role}</span>
            </div>
            <ModelChip role={a.trace} />
          </div>
        ))}
      </div>

      <div className={roundStyles.setupIter}>
        <div className={roundStyles.setupIterLab}>
          <span>Exchanges per side</span>
          <span className={roundStyles.setupIterVal}>{iterations}</span>
        </div>
        <input
          type="range"
          min={2}
          max={6}
          step={1}
          value={iterations}
          onChange={(e) => onIterations(Number(e.target.value))}
          className={roundStyles.setupRange}
          aria-label="Exchanges per side"
          style={{ "--pct": `${((iterations - 2) / 4) * 100}%` } as React.CSSProperties}
        />
        <div className={roundStyles.setupIterHint}>
          Supporter and Discriminator rebut each other {iterations}× — about{" "}
          {totalTurns} turns before the Judge rules. More is deeper but slower.
        </div>
      </div>

      <div className={roundStyles.setupActions}>
        <Button variant="gold" onClick={onRun} disabled={disabled}>
          {isFirst ? "Run the tribunal" : "Run this round"}
        </Button>
        <span className={roundStyles.setupNote}>
          {iterations} exchanges each · 3 models · streamed live
        </span>
      </div>
    </div>
  );
}

// ── StepJudge ─────────────────────────────────────────────────────────────────

export interface StepJudgeProps {
  active: boolean;
  thesis: Thesis | null;
}

export function StepJudge({ active, thesis }: StepJudgeProps) {
  const [rounds, setRounds] = useState<DebateRound[]>([]);
  // Pre-run setup: how many Supporter<->Discriminator exchanges, and whether the
  // setup card (model pickers + iteration slider) is showing.
  const [iterations, setIterations] = useState(4);
  const [showSetup, setShowSetup] = useState(false);
  const nextIdRef = useRef(1);
  const abortRefs = useRef<Map<number, AbortController>>(new Map());
  const roundsEndRef = useRef<HTMLDivElement | null>(null);

  // ── Run a new debate round ─────────────────────────────────────────────────

  const runDebate = useCallback((rounds: number) => {
    if (!thesis) return;

    const id = nextIdRef.current++;
    const ac = new AbortController();
    abortRefs.current.get(id)?.abort();
    abortRefs.current.set(id, ac);

    setRounds((prev) => [
      ...prev,
      { id, result: null, error: null, phase: "loading", active: "both", selectedRef: null },
    ]);

    requestAnimationFrame(() => {
      roundsEndRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    streamSSE(
      "/api/debate/stream",
      { thesis, rounds },
      {
        signal: ac.signal,
        onEvent(event, data) {
          if (event === "result") {
            // Result arrived - move to "opening" so sup+dis openings type out.
            setRounds((prev) =>
              prev.map((r) =>
                r.id === id
                  ? { ...r, result: data as DebateResult, phase: "opening", active: "both" }
                  : r,
              ),
            );
          } else if (event === "error") {
            const d = data as { error?: string };
            setRounds((prev) =>
              prev.map((r) =>
                r.id === id
                  ? { ...r, error: d.error ?? "Unknown streaming error", phase: "done" }
                  : r,
              ),
            );
          }
        },
      },
    ).catch((e) => {
      if ((e as Error).name !== "AbortError") {
        setRounds((prev) =>
          prev.map((r) =>
            r.id === id
              ? { ...r, error: e instanceof Error ? e.message : "Unknown error", phase: "done" }
              : r,
          ),
        );
      }
    });
  }, [thesis]);

  // ── On a new thesis, show the setup card (pick models + iterations, then run) ─
  // One effect keyed on thesis.id handles BOTH first arrival and replacement.
  const prevThesisId = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!thesis || thesis.id === prevThesisId.current) return;
    const isReplacement = prevThesisId.current !== undefined;
    prevThesisId.current = thesis.id;
    if (isReplacement) {
      // a different thesis replaced the old one - drop the prior rounds first
      abortRefs.current.forEach((ac) => ac.abort());
      abortRefs.current.clear();
      setRounds([]);
      nextIdRef.current = 1;
    }
    setShowSetup(true);
  }, [thesis]);

  // Run the tribunal with the chosen iteration count, then hide the setup card.
  const startFromSetup = useCallback(() => {
    setShowSetup(false);
    runDebate(iterations);
  }, [runDebate, iterations]);

  // Stop / abort an in-flight run (e.g. the AI is stalling): cancel the streams,
  // drop the unfinished round(s), keep finished ones, and reopen the setup card.
  const stopDebate = useCallback(() => {
    abortRefs.current.forEach((ac) => ac.abort());
    abortRefs.current.clear();
    setRounds((prev) => prev.filter((r) => r.phase === "done"));
    setShowSetup(true);
  }, []);

  // ── Phase change callback from child rounds ────────────────────────────────

  const handlePhaseChange = useCallback(
    (id: number, phase: RoundPhase, activePanel: DebateRound["active"]) => {
      setRounds((prev) =>
        prev.map((r) => (r.id === id ? { ...r, phase, active: activePanel } : r)),
      );
    },
    [],
  );

  const handleSelectRef = useCallback((id: number, ref: string | null) => {
    setRounds((prev) => prev.map((r) => (r.id === id ? { ...r, selectedRef: ref } : r)));
  }, []);

  const anyRunning = rounds.some(
    (r) => r.phase === "loading" || r.phase === "opening" || r.phase === "debating" || r.phase === "ruling",
  );

  return (
    <section className="wrap" id="step-2">
      {!thesis && (
        <div className={`${styles.notice}`} style={{ marginTop: 20 }}>
          <WarnIcon />
          Go back to Step one and generate or write a thesis first.
        </div>
      )}

      {thesis && (
        <>
          {rounds.map((round, idx) => (
            <SingleRound
              key={round.id}
              round={round}
              roundNumber={idx + 1}
              thesis={thesis}
              active={active}
              onPhaseChange={handlePhaseChange}
              onSelectRef={handleSelectRef}
            />
          ))}

          <div ref={roundsEndRef} />

          {showSetup ? (
            <TribunalSetup
              iterations={iterations}
              onIterations={setIterations}
              onRun={startFromSetup}
              isFirst={rounds.length === 0}
              disabled={anyRunning}
            />
          ) : anyRunning ? (
            <div className={styles.runrow} style={{ marginTop: 24 }}>
              <Button variant="danger" onClick={stopDebate}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <StopIcon /> Stop
                </span>
              </Button>
              <span className={styles.hint}>
                Running the tribunal… click Stop if the AI stalls, then run again.
              </span>
            </div>
          ) : (
            <div className={styles.runrow} style={{ marginTop: 24 }}>
              <Button variant="gold" onClick={() => setShowSetup(true)}>
                ⟳ Re-evaluate
              </Button>
              <span className={styles.hint}>
                Re-evaluate reopens the setup - pick models + exchanges, then run a fresh round.
              </span>
            </div>
          )}
        </>
      )}

      <div className={`${styles.notice}`} style={{ marginTop: 30 }}>
        <WarnIcon />
        Testnet · not financial advice. Executing routes to /trade where your agent wallet signs
        the swap on HashKey Chain - manual confirm.
      </div>
    </section>
  );
}
