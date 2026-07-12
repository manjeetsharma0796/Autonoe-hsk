"use client";

import { ProviderKeyPanel } from "@/components/keys/ProviderKeyPanel";
import { RoleModelPanel } from "@/components/settings/RoleModelPanel";
import { DataSourcePanel } from "@/components/settings/DataSourcePanel";

// ── Settings page ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <main className="wrap" style={{ paddingTop: 140, minHeight: "100vh", paddingBottom: 96 }}>
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <span className="tag">Configuration</span>
      <h1 className="h2">Settings</h1>
      <p className="sub">
        Manage provider API keys, assign models to each AI role, and configure
        which data sources are active in thesis generation.
      </p>

      {/* ── Section 01: Provider API Keys (Mono compact pattern) ─────────── */}
      <section style={{ marginTop: 56 }}>
        <SectionHeader
          label="01"
          title="Provider API Keys"
          sub="Save a key to instantly see that provider's live model list. Keys are stored server-side and never exposed to the browser."
        />
        <div style={{ marginTop: 24, maxWidth: 780 }}>
          <ProviderKeyPanel onModelsLoaded={() => {}} />
        </div>
      </section>

      <Divider />

      {/* ── Section 02: Role → model assignment ──────────────────────────── */}
      <section>
        <SectionHeader
          label="02"
          title="Role Model Assignments"
          sub="Give each AI role its own provider and model. Changes save instantly and apply to every run - and you can paste a missing key right on the chip."
        />
        <div style={{ marginTop: 24, maxWidth: 780 }}>
          <RoleModelPanel />
        </div>
      </section>

      <Divider />

      {/* ── Section 03: Data sources ──────────────────────────────────────── */}
      <section>
        <SectionHeader
          label="03"
          title="Data Sources"
          sub="Toggle subagents on or off. Disabled subagents are excluded from thesis generation - useful for faster runs or when a provider is unavailable."
        />
        <div style={{ marginTop: 24 }}>
          <DataSourcePanel />
        </div>
      </section>
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({
  label,
  title,
  sub,
}: {
  label: string;
  title: string;
  sub: string;
}) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 11,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: "var(--gold)",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--disp)",
          fontWeight: 700,
          fontSize: 22,
          color: "var(--ink)",
          marginBottom: 8,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </div>
      <p style={{ fontSize: 14, color: "var(--muted)", maxWidth: 600 }}>{sub}</p>
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        margin: "52px 0",
        height: 1,
        background: "var(--line)",
      }}
    />
  );
}
