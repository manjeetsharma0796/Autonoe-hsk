"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { ChatMessage, Thesis, ThesisOption } from "@autonoe/shared";
import { streamSSE } from "@/lib/stream";
import { LiveThinking } from "@/components/ai/LiveThinking";
import { ModelChip } from "@/components/ai/ModelChip";
import { AiAnswer } from "@/components/ai/AiAnswer";
import { FollowUps } from "@/components/ai/FollowUps";
import { Button } from "@/components/ui/Button";

// ── inline icons ─────────────────────────────────────────────────────────────

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
    </svg>
  );
}
function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

// AI sender header - makes "this is the AI" obvious
function AiHead() {
  return (
    <div className="aimsg-head">
      <span className="aidot">
        <BoltIcon />
      </span>
      <span className="who">Autonoe</span>
      <span className="aitag">AI</span>
    </div>
  );
}

// ── curated follow-ups (static set, per surface) ──────────────────────────────

const THESIS_FOLLOWUPS = [
  "Tighten the risk frame and invalidation",
  "Make it a 1h scalp instead of a 4h swing",
  "Compare a long versus a hedge here",
  "Size this for 2% account risk",
];
const ASSISTANT_FOLLOWUPS = [
  "What is the live mUSD/WMNT depth right now?",
  "Summarize the risk on my agent wallet",
  "Which asset has the strongest 4h trend?",
  "Explain how the tribunal verdict works",
];

// ── helpers ───────────────────────────────────────────────────────────────────

function dirLabel(d: ThesisOption["direction"]): string {
  return d.charAt(0).toUpperCase() + d.slice(1);
}
function retRange(lo: number, hi: number): string {
  const f = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
  return `${f(lo)} to ${f(hi)}`;
}

// ── ThesisPane ────────────────────────────────────────────────────────────────

function ThesisPane() {
  const [intent, setIntent] = useState(
    "I think WMNT runs into the HashKey ecosystem momentum. Build a 4h swing thesis against mUSD.",
  );
  const [thesis, setThesis] = useState<Thesis | null>(null);
  const [thinking, setThinking] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function handleGenerate(intentArg?: string) {
    const useIntent = (intentArg ?? intent).trim();
    if (!useIntent) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    setThesis(null);
    setThinking("");

    try {
      await streamSSE(
        "/api/thesis/stream",
        {
          intent: useIntent,
          activeSources: ["subagent.onchain", "subagent.market", "subagent.indicators"],
        },
        {
          signal: ctrl.signal,
          onEvent(event, data) {
            if (event === "thinking") {
              const d = data as { delta?: string };
              if (d.delta) setThinking((prev) => prev + d.delta);
            } else if (event === "result") {
              setThesis(data as Thesis);
            } else if (event === "error") {
              const d = data as { error?: string };
              setError(d.error ?? "Unknown error");
            }
          },
        },
      );
    } catch (e) {
      if ((e as { name?: string }).name !== "AbortError") {
        setError(e instanceof Error ? e.message : "Unknown error");
      }
    } finally {
      setLoading(false);
    }
  }

  function pickFollowup(q: string) {
    setIntent(q);
    void handleGenerate(q);
  }

  const topOption = thesis?.options[0] ?? null;

  return (
    <div role="tabpanel">
      <div className="railhead">
        <div className="ic">
          <BoltIcon />
        </div>
        <div>
          <h4>Quick Thesis</h4>
          <p>One intent, one ranked option.</p>
        </div>
      </div>
      <div className="railbody">
        <div className="modelrow">
          <span className="intentlab" style={{ marginBottom: 0 }}>Model</span>
          <ModelChip role="thesis" />
        </div>
        <div className="intentlab" id="intent-label">Your intent</div>
        <textarea
          className="intent"
          rows={3}
          aria-labelledby="intent-label"
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
        />
        <div className="intentrow">
          <Button
            variant="violet"
            block
            loading={loading}
            onClick={() => void handleGenerate()}
            iconLeft={<BoltIcon />}
          >
            {loading ? "Generating…" : "Generate thesis"}
          </Button>
        </div>

        {error && (
          <div className="ai-error" role="alert">
            {error}
          </div>
        )}

        <LiveThinking text={thinking} streaming={loading} />

        {topOption && thesis && (
          <div className="thesis">
            <div className="th-top">
              <span className={`dir ${topOption.direction}`}>{dirLabel(topOption.direction)}</span>
              <span className="th-asset">{topOption.asset}</span>
              <span className="th-tag">{topOption.id}</span>
            </div>
            <div className="th-body">
              <div className="pills">
                <span className="pill size">
                  <span className="k">size</span> {topOption.sizeMUSD.toLocaleString()} mUSD
                </span>
                <span className="pill ret">
                  <span className="k">pred.</span>{" "}
                  {retRange(topOption.predictedReturnPct.low, topOption.predictedReturnPct.high)}
                </span>
                <span className="pill risk">
                  <span className="k">risk</span> {topOption.risk}
                </span>
              </div>
              <p className="th-desc">{topOption.rationale}</p>
            </div>
            <div className="th-foot">
              <Link href="/studio" className="ui-btn v-gold s-md block">
                Refine in Judge Panel →
              </Link>
            </div>
          </div>
        )}

        {thesis && !loading && (
          <FollowUps items={THESIS_FOLLOWUPS} onPick={pickFollowup} title="Refine this thesis" disabled={loading} />
        )}
      </div>
    </div>
  );
}

// ── AssistantPane ─────────────────────────────────────────────────────────────

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    role: "assistant",
    content:
      "I read the live mUSD book, your agent wallet, and the on-chain DecisionLog.\n\n" +
      "## What I can do\n" +
      "- **Market reads**: price, depth, funding and 4h structure for WMNT, BTC, ETH, SUI, SOL\n" +
      "- **Wallet checks**: balances, exposure and risk on your agent wallet\n" +
      "- **Thesis to verdict**: turn an idea into a tribunal verdict you can execute\n\n" +
      "Ask me anything, or pick a starter below.",
  },
];

function AssistantPane() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const streamedRef = useRef<string>("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  function scrollToBottom() {
    // only follow the stream if the user is already pinned to the bottom,
    // and jump instantly (smooth-per-token fights the reader)
    setTimeout(() => {
      const el = bottomRef.current?.parentElement;
      if (!el) return;
      const pinned = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      if (pinned) el.scrollTop = el.scrollHeight;
    }, 30);
  }

  async function run(convo: ChatMessage[]) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    setStreamingContent("");
    streamedRef.current = "";
    scrollToBottom();

    try {
      let finalMessage: ChatMessage | null = null;
      await streamSSE(
        "/api/assistant/stream",
        { messages: convo },
        {
          signal: ctrl.signal,
          onEvent(event, data) {
            if (event === "token") {
              const d = data as { delta?: string };
              if (d.delta) {
                streamedRef.current += d.delta;
                setStreamingContent(streamedRef.current);
                scrollToBottom();
              }
            } else if (event === "result") {
              finalMessage = data as ChatMessage;
            } else if (event === "error") {
              const d = data as { error?: string };
              setError(d.error ?? "Unknown error");
            }
          },
        },
      );
      setStreamingContent(null);
      const committed: ChatMessage | null =
        finalMessage ??
        (streamedRef.current ? { role: "assistant", content: streamedRef.current } : null);
      if (committed) setMessages((prev) => [...prev, committed]);
    } catch (e) {
      if ((e as { name?: string }).name !== "AbortError") {
        setError(e instanceof Error ? e.message : "Unknown error");
        setStreamingContent(null);
      }
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }

  async function handleSend(textArg?: string) {
    const text = (textArg ?? draft).trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user", content: text } as ChatMessage];
    setMessages(next);
    setDraft("");
    await run(next);
  }

  function regenerate() {
    if (loading) return;
    // drop the trailing assistant reply, re-run from the last user turn
    let cut = messages.length;
    while (cut > 0 && messages[cut - 1].role === "assistant") cut -= 1;
    const convo = messages.slice(0, cut);
    if (!convo.length) return;
    setMessages(convo);
    void run(convo);
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  const lastIdx = messages.length - 1;

  return (
    <div role="tabpanel">
      <div className="railhead">
        <div className="ic">
          <ChatIcon />
        </div>
        <div>
          <h4>Assistant</h4>
          <p>Ask about the market or your wallet.</p>
        </div>
      </div>
      <div className="railbody">
        <div className="modelrow">
          <span className="intentlab" style={{ marginBottom: 0 }}>Model</span>
          <ModelChip role="assistant" />
        </div>

        <div className="chat">
          {messages.map((m, i) =>
            m.role === "assistant" ? (
              <div key={i} className="aimsg">
                <AiHead />
                <AiAnswer
                  text={m.content}
                  onRegenerate={i === lastIdx && !loading ? regenerate : undefined}
                />
              </div>
            ) : (
              <div key={i} className="umsg">
                <div className="umsg-tag">You</div>
                <div className="umsg-text">{m.content}</div>
              </div>
            ),
          )}

          {loading && (
            <div className="aimsg">
              <AiHead />
              {streamingContent ? (
                <AiAnswer text={streamingContent} streaming />
              ) : (
                <span className="ai-thinking">Thinking</span>
              )}
            </div>
          )}

          {error && (
            <div className="ai-error" role="alert" style={{ marginTop: 4 }}>
              {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {!loading && (
          <FollowUps
            items={ASSISTANT_FOLLOWUPS}
            onPick={(q) => void handleSend(q)}
            disabled={loading}
          />
        )}

        <div className="composer">
          <textarea
            rows={1}
            placeholder="Message the assistant..."
            aria-label="Message the assistant"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKey}
          />
          <button
            type="button"
            className="send"
            aria-label="Send"
            onClick={() => void handleSend()}
            disabled={loading || !draft.trim()}
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AiRail ────────────────────────────────────────────────────────────────────

export function AiRail() {
  const [tab, setTab] = useState<"thesis" | "assistant">("thesis");

  return (
    <aside className="rail">
      <div className="panel">
        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "thesis"}
            className={`tab ${tab === "thesis" ? "on" : ""}`}
            onClick={() => setTab("thesis")}
          >
            <BoltIcon />
            Quick Thesis
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "assistant"}
            className={`tab ${tab === "assistant" ? "on" : ""}`}
            onClick={() => setTab("assistant")}
          >
            <ChatIcon />
            Assistant
          </button>
        </div>

        {tab === "thesis" ? <ThesisPane /> : <AssistantPane />}
      </div>
    </aside>
  );
}
