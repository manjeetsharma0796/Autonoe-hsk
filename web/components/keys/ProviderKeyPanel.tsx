"use client";

/**
 * ProviderKeyPanel - the Mono compact pattern:
 *   - Horizontal row of provider chips with status dots
 *   - One full-width key input with inline Save / clear / get-key actions
 *   - Live model list (filterable) appears instantly after a key is saved
 *
 * Used both on /settings (full page) and inside KeyQuickPanel (overlay).
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type {
  AIRole,
  ModelChoice,
  ModelInfo,
  ProviderInfo,
  ProviderId,
  RoleModelMap,
} from "@autonoe/shared";
import { AI_ROLES } from "@autonoe/shared";
import { getProviders, getModels, postKey, putRoles } from "@/lib/api";

// Roles a user picks a model for from this panel. "all" fans out to every role.
const APPLY_TARGETS: { value: string; label: string }[] = [
  { value: "all", label: "All roles" },
  { value: "thesis", label: "Thesis" },
  { value: "assistant", label: "Assistant" },
  { value: "supporter", label: "Supporter" },
  { value: "discriminator", label: "Discriminator" },
  { value: "judge", label: "Judge" },
];

// ── Static fallback provider metadata ────────────────────────────────────────

const FALLBACK_PROVIDERS: ProviderInfo[] = [
  {
    id: "groq",
    label: "Groq",
    keysUrl: "https://console.groq.com/keys",
    note: "Free tier: 6,000 req/day on Llama 3 family",
    hasKey: false,
  },
  {
    id: "mistral",
    label: "Mistral",
    keysUrl: "https://console.mistral.ai/api-keys",
    note: "Free tier: 1 req/sec on Mistral 7B",
    hasKey: false,
  },
  {
    id: "nvidia",
    label: "NVIDIA",
    keysUrl: "https://build.nvidia.com",
    note: "Free tier: 1,000 credits on launch",
    hasKey: false,
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    keysUrl: "https://openrouter.ai/keys",
    note: "Aggregates 100+ models; free-tier routes available",
    hasKey: false,
  },
  {
    id: "gemini",
    label: "Gemini",
    keysUrl: "https://aistudio.google.com/apikey",
    note: "Free tier: 15 req/min on Gemini 1.5 Flash",
    hasKey: false,
  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type SaveStatus = "idle" | "saving" | "ok" | "error";

interface ModelsByProvider {
  [key: string]: ModelInfo[];
}

export interface ProviderKeyPanelProps {
  /** Called when a provider's models are (re)loaded after a key save. */
  onModelsLoaded?: (providerId: ProviderId, models: ModelInfo[]) => void;
  /** Compact mode: reduces padding/sizing for popover context. */
  compact?: boolean;
}

// ── Chip status dot ───────────────────────────────────────────────────────────

function StatusDot({ ready }: { ready: boolean }) {
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        flexShrink: 0,
        background: ready ? "var(--green)" : "var(--faint)",
        boxShadow: ready ? "0 0 6px var(--green)" : "none",
        display: "inline-block",
      }}
    />
  );
}

// ── Context badge for model list ──────────────────────────────────────────────

function CtxBadge({ ctx }: { ctx: number | null }) {
  if (!ctx) return null;
  const label =
    ctx >= 1_000_000
      ? `${(ctx / 1_000_000).toFixed(0)}M`
      : ctx >= 1_000
      ? `${(ctx / 1_000).toFixed(0)}k`
      : String(ctx);
  return (
    <span
      style={{
        fontFamily: "var(--mono)",
        fontSize: 10,
        color: "var(--faint)",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid var(--line2)",
        borderRadius: 4,
        padding: "1px 5px",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ProviderKeyPanel({ onModelsLoaded, compact }: ProviderKeyPanelProps) {
  const [providers, setProviders] = useState<ProviderInfo[]>(FALLBACK_PROVIDERS);
  const [loadingProviders, setLoadingProviders] = useState(true);

  const [selected, setSelected] = useState<ProviderId>("groq");
  const [keyInput, setKeyInput] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState("");

  const [modelsByProvider, setModelsByProvider] = useState<ModelsByProvider>({});
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  // Which role(s) a clicked model is applied to, + transient "applied" feedback.
  const [applyTarget, setApplyTarget] = useState<string>("all");
  const [applied, setApplied] = useState<{ model: string; ok: boolean } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Assign the clicked model to the selected role(s) via PUT /api/roles (partial
  // merge, so other roles are untouched). "all" fans out to every role.
  const applyModel = useCallback(
    async (modelId: string) => {
      const choice: ModelChoice = { provider: selected, model: modelId };
      const targets: AIRole[] =
        applyTarget === "all" ? [...AI_ROLES] : [applyTarget as AIRole];
      const partial: Partial<RoleModelMap> = {};
      targets.forEach((r) => {
        partial[r] = choice;
      });
      setApplied({ model: modelId, ok: true });
      try {
        await putRoles(partial);
        setTimeout(() => setApplied((a) => (a?.model === modelId ? null : a)), 1800);
      } catch {
        setApplied({ model: modelId, ok: false });
      }
    },
    [selected, applyTarget],
  );

  // Load providers on mount
  useEffect(() => {
    setLoadingProviders(true);
    getProviders()
      .then((list) => setProviders(list))
      .catch(() => {
        // keep fallback
      })
      .finally(() => setLoadingProviders(false));
  }, []);

  // When a provider with a key is selected and we haven't loaded its models yet, auto-fetch
  const fetchModels = useCallback(
    async (pid: ProviderId) => {
      if (modelsByProvider[pid]) return; // already loaded
      const prov = providers.find((p) => p.id === pid);
      if (!prov?.hasKey) return;
      setLoadingModels(true);
      setModelError("");
      try {
        const list = await getModels(pid);
        setModelsByProvider((prev) => ({ ...prev, [pid]: list }));
        onModelsLoaded?.(pid, list);
      } catch (e) {
        setModelError(e instanceof Error ? e.message : "Failed to load models");
      } finally {
        setLoadingModels(false);
      }
    },
    [modelsByProvider, providers, onModelsLoaded]
  );

  useEffect(() => {
    void fetchModels(selected);
  }, [selected, fetchModels]);

  async function handleSave() {
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    setSaveStatus("saving");
    setSaveError("");
    try {
      await postKey({ provider: selected, apiKey: trimmed });
      // Refresh provider list so the chip shows READY
      const refreshed = await getProviders().catch(() => null);
      if (refreshed) setProviders(refreshed);
      // Load models immediately
      setLoadingModels(true);
      setModelError("");
      const models = await getModels(selected);
      setModelsByProvider((prev) => ({ ...prev, [selected]: models }));
      onModelsLoaded?.(selected, models);
      setSaveStatus("ok");
      setKeyInput("");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Unknown error");
      setSaveStatus("error");
    } finally {
      setLoadingModels(false);
    }
  }

  function handleClear() {
    setKeyInput("");
    setSaveStatus("idle");
    setSaveError("");
    inputRef.current?.focus();
  }

  const currentProvider = providers.find((p) => p.id === selected) ?? providers[0];
  const models = modelsByProvider[selected] ?? [];
  const filteredModels = modelFilter
    ? models.filter(
        (m) =>
          m.id.toLowerCase().includes(modelFilter.toLowerCase()) ||
          (m.label ?? "").toLowerCase().includes(modelFilter.toLowerCase())
      )
    : models;

  const vpad = compact ? 16 : 24;
  const hpad = compact ? 18 : 26;

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: compact ? 14 : 18,
        padding: `${vpad}px ${hpad}px`,
        display: "flex",
        flexDirection: "column",
        gap: compact ? 14 : 18,
      }}
    >
      {/* ── Provider chips ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {loadingProviders && !providers.length ? (
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--faint)" }}>
            Loading providers…
          </span>
        ) : (
          providers.map((p) => {
            const active = p.id === selected;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelected(p.id);
                  setSaveStatus("idle");
                  setSaveError("");
                  setModelFilter("");
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  padding: "5px 12px",
                  borderRadius: 999,
                  border: active
                    ? "1px solid var(--gold)"
                    : "1px solid var(--line)",
                  background: active
                    ? "rgba(245,165,36,0.1)"
                    : "rgba(255,255,255,0.03)",
                  color: active ? "var(--gold2)" : "var(--muted)",
                  cursor: "pointer",
                  transition: "all 0.18s ease",
                  outline: "none",
                }}
                aria-pressed={active}
              >
                <StatusDot ready={p.hasKey} />
                {p.label}
                {p.hasKey && (
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 9,
                      letterSpacing: "0.18em",
                      color: "var(--green)",
                    }}
                  >
                    READY
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* ── Key input row ───────────────────────────────────────────────── */}
      <div>
        <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
          <input
            ref={inputRef}
            type="password"
            autoComplete="off"
            placeholder={
              currentProvider?.hasKey
                ? "Paste new key to replace…"
                : `Paste ${currentProvider?.label ?? selected} API key…`
            }
            value={keyInput}
            onChange={(e) => {
              setKeyInput(e.target.value);
              if (saveStatus !== "idle") setSaveStatus("idle");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSave();
            }}
            style={{
              flex: 1,
              background: "var(--bg2)",
              border: `1px solid ${saveStatus === "error" ? "var(--red)" : saveStatus === "ok" ? "var(--green)" : "var(--line)"}`,
              borderRadius: 10,
              padding: "10px 14px",
              color: "var(--ink)",
              fontFamily: "var(--mono)",
              fontSize: 12,
              outline: "none",
              minWidth: 0,
              transition: "border-color 0.2s ease",
            }}
            aria-label={`API key for ${currentProvider?.label ?? selected}`}
          />
          {/* Save */}
          <button
            className="btn btn-gold"
            type="button"
            disabled={saveStatus === "saving" || !keyInput.trim()}
            onClick={() => void handleSave()}
            style={{
              minWidth: 58,
              padding: "0 16px",
              fontSize: 12,
              opacity: !keyInput.trim() ? 0.5 : 1,
              flexShrink: 0,
            }}
          >
            {saveStatus === "saving" ? "…" : "Save"}
          </button>
          {/* Clear */}
          {keyInput && (
            <button
              className="btn btn-ghost"
              type="button"
              onClick={handleClear}
              style={{ padding: "0 12px", fontSize: 12, flexShrink: 0 }}
              aria-label="Clear key input"
            >
              clear
            </button>
          )}
          {/* Get key deep link */}
          {currentProvider?.keysUrl && (
            <a
              href={currentProvider.keysUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "0 12px",
                borderRadius: 10,
                border: "1px solid var(--line)",
                background: "rgba(255,255,255,0.02)",
                fontFamily: "var(--mono)",
                fontSize: 11,
                color: "var(--gold)",
                whiteSpace: "nowrap",
                flexShrink: 0,
                textDecoration: "none",
                transition: "border-color 0.18s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--gold)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--line)";
              }}
            >
              get key →
            </a>
          )}
        </div>

        {/* Feedback / reassurance line */}
        <div style={{ marginTop: 6, minHeight: 18, display: "flex", alignItems: "center" }}>
          {saveStatus === "ok" && (
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--green)" }}>
              Key saved - models loaded.
            </span>
          )}
          {saveStatus === "error" && (
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--red)" }}>
              {saveError}
            </span>
          )}
          {saveStatus === "idle" && (
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--faint)" }}>
              Key stored server-side, never exposed to the browser.
            </span>
          )}
        </div>

        {/* Provider note */}
        {currentProvider?.note && (
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              color: "var(--faint)",
              marginTop: 3,
            }}
          >
            {currentProvider.note}
          </div>
        )}
      </div>

      {/* ── Live model list ─────────────────────────────────────────────── */}
      {(currentProvider?.hasKey || saveStatus === "ok") && (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--gold)",
              }}
            >
              Models · click to use
            </span>
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "var(--mono)",
                fontSize: 10,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--faint)",
              }}
            >
              apply to
              <select
                value={applyTarget}
                onChange={(e) => setApplyTarget(e.target.value)}
                style={{
                  background: "var(--bg2)",
                  border: "1px solid var(--line)",
                  borderRadius: 7,
                  color: "var(--ink)",
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  padding: "4px 8px",
                  outline: "none",
                  cursor: "pointer",
                }}
                aria-label="Apply the selected model to which role"
              >
                {APPLY_TARGETS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loadingModels && (
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--faint)" }}>
              Loading models…
            </div>
          )}

          {modelError && !loadingModels && (
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--red)" }}>
              {modelError}
            </div>
          )}

          {!loadingModels && !modelError && models.length > 0 && (
            <>
              {/* Filter box */}
              <input
                type="text"
                placeholder="filter models…"
                value={modelFilter}
                onChange={(e) => setModelFilter(e.target.value)}
                style={{
                  width: "100%",
                  background: "var(--bg2)",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  padding: "7px 12px",
                  color: "var(--ink)",
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  outline: "none",
                  marginBottom: 8,
                }}
                aria-label="Filter models"
              />

              {/* Model list */}
              <div
                style={{
                  maxHeight: compact ? 180 : 240,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                {filteredModels.length === 0 ? (
                  <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--faint)", padding: "6px 0" }}>
                    No models match.
                  </div>
                ) : (
                  filteredModels.map((m) => {
                    const isApplied = applied?.model === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => void applyModel(m.id)}
                        title={`Use ${m.id} for ${applyTarget === "all" ? "all roles" : applyTarget}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          width: "100%",
                          textAlign: "left",
                          padding: "6px 10px",
                          borderRadius: 7,
                          cursor: "pointer",
                          background: isApplied ? "rgba(63,224,166,0.08)" : "var(--bg2)",
                          border: `1px solid ${isApplied ? "var(--green)" : "var(--line2)"}`,
                          transition: "border-color 0.15s ease, background 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          if (!isApplied)
                            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--gold)";
                        }}
                        onMouseLeave={(e) => {
                          if (!isApplied)
                            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line2)";
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "var(--mono)",
                            fontSize: 11,
                            color: "var(--ink)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            minWidth: 0,
                          }}
                        >
                          {m.label || m.id}
                        </span>
                        <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
                          {isApplied && (
                            <span
                              style={{
                                fontFamily: "var(--mono)",
                                fontSize: 9,
                                letterSpacing: "0.1em",
                                color: applied?.ok ? "var(--green)" : "var(--red)",
                              }}
                            >
                              {applied?.ok ? "✓ SET" : "FAILED"}
                            </span>
                          )}
                          {m.free && (
                            <span
                              style={{
                                fontFamily: "var(--mono)",
                                fontSize: 9,
                                color: "var(--green)",
                                background: "rgba(63,224,166,0.08)",
                                border: "1px solid rgba(63,224,166,0.2)",
                                borderRadius: 4,
                                padding: "1px 5px",
                              }}
                            >
                              FREE
                            </span>
                          )}
                          <CtxBadge ctx={m.contextWindow} />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  color: "var(--faint)",
                  marginTop: 6,
                }}
              >
                {filteredModels.length} model{filteredModels.length !== 1 ? "s" : ""}
                {modelFilter ? ` matching "${modelFilter}"` : ""}
              </div>
            </>
          )}

          {!loadingModels && !modelError && models.length === 0 && (
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--faint)" }}>
              No models returned - try a different key.
            </div>
          )}
        </div>
      )}

      {/* First-run hint when no key is saved yet */}
      {!currentProvider?.hasKey && saveStatus !== "ok" && (
        <div
          style={{
            background: "rgba(245,165,36,0.04)",
            border: "1px solid rgba(245,165,36,0.12)",
            borderRadius: 10,
            padding: "10px 14px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              color: "var(--gold2)",
              letterSpacing: "0.12em",
            }}
          >
            NEEDS KEY - paste your {currentProvider?.label ?? selected} key above and press Save (or Enter).
          </span>
        </div>
      )}
    </div>
  );
}
