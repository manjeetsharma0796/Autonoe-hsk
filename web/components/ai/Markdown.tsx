"use client";

/**
 * Focused, dependency-free markdown renderer for AI output.
 * Handles: ## / ### headers, **bold**, `code`, - / * bullets, paragraphs,
 * GFM tables, and fenced ```chart / ```heatmap / ```line / ```bar blocks
 * (rendered as inline SVG charts). Detects (High|Med|Low) severity tags inside
 * bold labels. Defensively strips the banned em/en dashes.
 */
import React from "react";
import { renderFenced } from "./charts";
import "./ai-answer.css";

function clean(s: string): string {
  return s
    .replace(/ ?[-–] ?/g, " - ")
    .replace(/\s-+>\s/g, " ➜ ")
    .replace(/\s→\s/g, " ➜ ");
}

const SEVERITY = /\((High|Medium|Med|Moderate|Low)\)/i;
function sevLevel(w: string): "high" | "med" | "low" {
  const x = w.toLowerCase();
  if (x.startsWith("h")) return "high";
  if (x.startsWith("l")) return "low";
  return "med";
}

function inline(text: string, kp: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      const b = m[1];
      const sev = b.match(SEVERITY);
      if (sev) {
        const label = b.replace(SEVERITY, "").replace(/[:\s]+$/, "").trim();
        out.push(
          <strong key={`${kp}b${i}`}>
            {label} <span className={`md-sev md-sev-${sevLevel(sev[1])}`}>{sev[1]}</span>
          </strong>,
        );
      } else {
        out.push(<strong key={`${kp}b${i}`}>{b}</strong>);
      }
    } else if (m[2] !== undefined) {
      out.push(
        <code key={`${kp}c${i}`} className="md-code">
          {m[2]}
        </code>,
      );
    }
    last = re.lastIndex;
    i++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const isTableRow = (s: string) => /^\s*\|.*\|\s*$/.test(s);
const isTableSep = (s: string) => /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(s) && s.includes("|");
const cells = (row: string) =>
  row.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  const lines = clean(text).split("\n");
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  let para: string[] = [];
  let k = 0;

  const flushBullets = () => {
    if (!bullets.length) return;
    const items = bullets.slice();
    blocks.push(
      <ul key={`ul${k++}`} className="md-ul">
        {items.map((b, i) => (
          <li key={i}>{inline(b, `l${k}_${i}_`)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };
  const flushPara = () => {
    if (!para.length) return;
    blocks.push(
      <p key={`p${k++}`} className="md-p">
        {inline(para.join(" "), `p${k}_`)}
      </p>,
    );
    para = [];
  };
  const flushAll = () => {
    flushBullets();
    flushPara();
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx];
    const t = raw.trim();

    // fenced block: ```lang ... ```
    if (/^```/.test(t)) {
      flushAll();
      const lang = t.replace(/^```/, "").trim().toLowerCase();
      const body: string[] = [];
      idx++;
      while (idx < lines.length && !/^```/.test(lines[idx].trim())) {
        body.push(lines[idx]);
        idx++;
      }
      const joined = body.join("\n");
      const node = renderFenced(lang, joined, `f${k++}`);
      if (node) blocks.push(node);
      else
        blocks.push(
          <pre key={`pre${k++}`} className="md-pre">
            <code>{joined}</code>
          </pre>,
        );
      continue;
    }

    // GFM table
    if (isTableRow(t) && idx + 1 < lines.length && isTableSep(lines[idx + 1])) {
      flushAll();
      const header = cells(t);
      idx += 2; // skip header + separator
      const rows: string[][] = [];
      while (idx < lines.length && isTableRow(lines[idx])) {
        rows.push(cells(lines[idx]));
        idx++;
      }
      idx--; // step back; loop will increment
      blocks.push(
        <div key={`tbl${k++}`} className="md-table-wrap">
          <table className="md-table">
            <thead>
              <tr>
                {header.map((h, i) => (
                  <th key={i} scope="col">
                    {inline(h, `th${k}_${i}_`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci}>{inline(c, `td${k}_${ri}_${ci}_`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (!t) {
      flushAll();
      continue;
    }
    const h = t.match(/^(#{1,4})\s+(.*)$/);
    const bullet = t.match(/^[-*]\s+(.*)$/);
    if (h) {
      flushAll();
      const level = Math.min(h[1].length, 4);
      blocks.push(
        React.createElement(
          `h${Math.min(level + 1, 4)}`,
          { key: `h${k++}`, className: `md-h md-h${level}` },
          inline(h[2], `h${k}_`),
        ),
      );
    } else if (bullet) {
      flushPara();
      bullets.push(bullet[1]);
    } else {
      flushBullets();
      para.push(t);
    }
  }
  flushAll();

  return <div className={`md ${className}`.trim()}>{blocks}</div>;
}
