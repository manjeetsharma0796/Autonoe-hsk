"use client";

/**
 * Point-of-use model picker for a single AI role.
 *
 * Shows which model powers the role, lets you switch provider/model inline, and
 * if the chosen provider has no API key it lets you paste one right here (saved
 * server-side) instead of bouncing to Settings. Picks persist as the role's
 * default via PUT /api/roles.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type {
  AIRole,
  ModelInfo,
  ProviderId,
  ProviderInfo,
  RoleModelMap,
} from "@autonoe/shared";
import { getModels, getProviders, getRoles, postKey, putRoles } from "@/lib/api";
import "./model-chip.css";

function Caret() {
  return (
    <svg className="car" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

const ROLE_LABEL: Partial<Record<AIRole, string>> = {
  thesis: "Thesis",
  assistant: "Assistant",
  supporter: "Supporter",
  discriminator: "Discriminator",
  judge: "Judge",
};

export function ModelChip({ role = "thesis" as AIRole }: { role?: AIRole }) {
  const [roles, setRoles] = useState<RoleModelMap | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [activeProv, setActiveProv] = useState<ProviderId | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [keySaving, setKeySaving] = useState(false);
  const [keyErr, setKeyErr] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; maxHeight: number } | null>(null);

  // Position the portaled popover relative to the chip, flipping above when
  // there isn't room below. Fixed positioning escapes any overflow:hidden ancestor.
  const place = useCallback(() => {
    const el = anchorRef.current;
    if (!el || typeof window === "undefined") return;
    const r = el.getBoundingClientRect();
    const W = 300;
    const left = Math.max(8, Math.min(r.right - W, window.innerWidth - W - 8));
    const spaceBelow = window.innerHeight - r.bottom - 12;
    const spaceAbove = r.top - 12;
    if (spaceBelow >= 300 || spaceBelow >= spaceAbove) {
      setPos({ left, top: r.bottom + 8, maxHeight: Math.max(200, spaceBelow) });
    } else {
      setPos({ left, bottom: window.innerHeight - r.top + 8, maxHeight: Math.max(200, spaceAbove) });
    }
  }, []);

  const current = roles?.[role] ?? null;
  const providerOf = (id?: ProviderId) => providers.find((p) => p.id === id);
  const activeInfo = providerOf(activeProv ?? undefined);
  // amber "needs key" only once we actually know the provider lacks one
  const needsKey = !!current && providers.length > 0 && providerOf(current.provider)?.hasKey === false;

  const refreshProviders = useCallback(() => getProviders().then(setProviders).catch(() => {}), []);

  useEffect(() => {
    let alive = true;
    getRoles().then((r) => alive && setRoles(r)).catch(() => alive && setRoles(null));
    refreshProviders();
    return () => {
      alive = false;
    };
  }, [role, refreshProviders]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return; // popover is portaled outside wrapRef
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  const selectProvider = useCallback((prov: ProviderId, hasKey: boolean) => {
    setActiveProv(prov);
    setModels([]);
    setErr(null);
    setKeyInput("");
    setKeyErr(null);
    if (!hasKey) return; // show the inline key form instead
    setLoading(true);
    getModels(prov)
      .then((list) => setModels(Array.from(new Map(list.map((m) => [m.id, m])).values())))
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed to load models"))
      .finally(() => setLoading(false));
  }, []);

  function togglePopover() {
    const next = !open;
    setOpen(next);
    if (!next) return;
    place();
    // Re-sync this chip with the latest backend map so a change made in another
    // chip (e.g. the setup card) is reflected here instead of showing stale state.
    getRoles().then(setRoles).catch(() => {});
    refreshProviders().then(() => {
      getProviders()
        .then((ps) => {
          setProviders(ps);
          const start = current?.provider ?? ps.find((x) => x.hasKey)?.id ?? ps[0]?.id;
          const info = ps.find((x) => x.id === start);
          if (start) selectProvider(start, info?.hasKey ?? false);
        })
        .catch((e) => setErr(e instanceof Error ? e.message : "Backend unavailable"));
    });
  }

  async function saveKey() {
    if (!activeProv || !keyInput.trim()) return;
    setKeySaving(true);
    setKeyErr(null);
    try {
      await postKey({ provider: activeProv, apiKey: keyInput.trim() });
      setKeyInput("");
      await refreshProviders();
      selectProvider(activeProv, true); // now load its models
    } catch (e) {
      setKeyErr(e instanceof Error ? e.message : "Could not save key");
    } finally {
      setKeySaving(false);
    }
  }

  async function choose(modelId: string) {
    if (!activeProv) return;
    setSaving(true);
    try {
      // Save ONLY this role (partial). The backend merges it into the current
      // map, so we never clobber other roles with a stale local snapshot.
      const saved = await putRoles({ [role]: { provider: activeProv, model: modelId } });
      setRoles(saved);
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  const filtered = filter
    ? models.filter((m) => (m.label + m.id).toLowerCase().includes(filter.toLowerCase()))
    : models;
  const unset = !current;

  return (
    <div className="mchip-wrap" ref={wrapRef}>
      <button
        ref={anchorRef}
        type="button"
        className={`mchip ${unset ? "unset" : ""} ${needsKey ? "warn" : ""}`}
        onClick={togglePopover}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={unset ? "No model set" : `${current!.provider} · ${current!.model}${needsKey ? " (needs key)" : ""}`}
      >
        <span className="ic" />
        {unset ? (
          <span>Choose model</span>
        ) : (
          <>
            <span className="prov">{current!.provider} ·</span>
            <b>{current!.model}</b>
          </>
        )}
        {needsKey && <span className="warn-tag">needs key</span>}
        <Caret />
      </button>

      {open && pos && createPortal(
        <div
          className="mpop"
          ref={popRef}
          role="dialog"
          aria-label={`Model for ${role}`}
          style={{ left: pos.left, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}
        >
          <div className="mpop-head">
            Model · <span className="role">{ROLE_LABEL[role] ?? role}</span>
          </div>

          {providers.length > 0 ? (
            <>
              <div className="mpop-provs">
                {providers.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`mpop-prov ${activeProv === p.id ? "on" : ""}`}
                    onClick={() => selectProvider(p.id, p.hasKey)}
                  >
                    <span className={`d ${p.hasKey ? "live" : ""}`} />
                    {p.label}
                  </button>
                ))}
              </div>

              {activeInfo && !activeInfo.hasKey ? (
                // inline key paste
                <div className="mpop-key">
                  <div className="mpop-key-lab">{activeInfo.label} API key</div>
                  <div className="mpop-key-row">
                    <input
                      type="password"
                      className="mpop-key-input"
                      placeholder="paste key…"
                      name="apiKey"
                      autoComplete="off"
                      spellCheck={false}
                      aria-label={`${activeInfo.label} API key`}
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void saveKey();
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="mpop-key-save"
                      onClick={() => void saveKey()}
                      disabled={!keyInput.trim() || keySaving}
                    >
                      {keySaving ? "…" : "Save"}
                    </button>
                  </div>
                  <div className="mpop-key-foot">
                    <a href={activeInfo.keysUrl} target="_blank" rel="noopener noreferrer">
                      get a key →
                    </a>
                    <span>stored server-side, never in the browser</span>
                  </div>
                  {keyErr && <div className="mpop-key-err">{keyErr}</div>}
                </div>
              ) : loading ? (
                <div className="mpop-state">Loading models…</div>
              ) : err ? (
                <div className="mpop-state" style={{ color: "var(--red)" }}>
                  {err}{" "}
                  <button
                    type="button"
                    onClick={() => activeProv && activeInfo && selectProvider(activeProv, activeInfo.hasKey)}
                    style={{ color: "var(--violet2)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--mono)" }}
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <>
                  {models.length > 6 && (
                    <input
                      className="mpop-filter"
                      placeholder="filter models…"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    />
                  )}
                  <div className="mpop-list">
                    {filtered.map((m) => {
                      const on = current?.provider === activeProv && current?.model === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          className={`mpop-opt ${on ? "on" : ""}`}
                          onClick={() => void choose(m.id)}
                          disabled={saving}
                        >
                          {on ? "●" : "○"} {m.label || m.id}
                          {m.free ? <span className="free">FREE</span> : null}
                          {m.contextWindow ? <span className="ctx">{Math.round(m.contextWindow / 1000)}K</span> : null}
                        </button>
                      );
                    })}
                    {filtered.length === 0 && <div className="mpop-state">No models match.</div>}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="mpop-state">
              Connecting…{" "}
              <Link href="/settings" style={{ color: "var(--violet2)" }}>
                open Settings
              </Link>
            </div>
          )}

          <div className="mpop-foot">
            <Link href="/settings">Manage all roles in Settings →</Link>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
