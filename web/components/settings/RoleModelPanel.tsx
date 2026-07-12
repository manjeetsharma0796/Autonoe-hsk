"use client";

/**
 * Role -> model assignment, rebuilt on the ModelChip. Each role gets the same
 * point-of-use picker used across the app: live models, inline key paste, and
 * instant per-role persistence. No more disconnected dropdowns or all-or-nothing
 * Save.
 */
import type { AIRole } from "@autonoe/shared";
import { ModelChip } from "@/components/ai/ModelChip";
import "./role-assign.css";

const GROUPS: { title: string; roles: { role: AIRole; label: string; desc: string }[] }[] = [
  {
    title: "Core",
    roles: [
      { role: "thesis", label: "Thesis", desc: "Drafts the risk-tiered thesis" },
      { role: "assistant", label: "Assistant", desc: "The Trade-page chat copilot" },
    ],
  },
  {
    title: "Tribunal",
    roles: [
      { role: "supporter", label: "Supporter", desc: "Argues for the thesis" },
      { role: "discriminator", label: "Discriminator", desc: "Argues against the thesis" },
      { role: "judge", label: "Judge", desc: "Weighs both sides, delivers the verdict" },
    ],
  },
  {
    title: "Data subagents",
    roles: [
      { role: "subagent.onchain", label: "On-chain", desc: "Wallet + DEX evidence from HashKey Chain" },
      { role: "subagent.market", label: "Market", desc: "Price, depth, funding rates" },
      { role: "subagent.news", label: "News", desc: "Headline sentiment" },
      { role: "subagent.indicators", label: "Indicators", desc: "RSI, MACD, macro signals" },
    ],
  },
];

export function RoleModelPanel() {
  return (
    <>
      <div className="roleassign">
        {GROUPS.map((g) => (
          <div className="ra-group" key={g.title}>
            <div className="ra-gtitle">{g.title}</div>
            {g.roles.map((r) => (
              <div className="ra-row" key={r.role}>
                <div className="ra-meta">
                  <div className="ra-role">{r.label}</div>
                  <div className="ra-desc">{r.desc}</div>
                </div>
                <ModelChip role={r.role} />
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="ra-note">
        Each change saves instantly and applies to every run. Missing a key? Add it right
        on the chip.
      </p>
    </>
  );
}
