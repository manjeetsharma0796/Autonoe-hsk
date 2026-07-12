"use client";

import { useState, useCallback, useRef, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ShareCardData {
  /** The user's original thesis intent. */
  intent: string;
  /** e.g. "long" | "short" | "hedge" | "hold" */
  direction: string;
  /** e.g. "WMNT" */
  asset: string;
  /** e.g. 600 */
  sizeMUSD: number;
  /** e.g. "+6.4% to +11.0%" */
  predictedReturnLabel: string;
  /** e.g. "low" | "medium" | "high" */
  risk: string;
  /** Optional - present for judge verdicts */
  verdict?: {
    /** One-line judge summary */
    summary: string;
    /** 0..1 */
    confidence: number;
  };
}

// ── Palette (hard-coded, no CSS var dependency in SVG) ───────────────────────

const C = {
  bg: "#0B0E14",
  panel: "#0F1626",
  line: "rgba(255,255,255,0.08)",
  ink: "#F4F7FB",
  muted: "#8C9AB3",
  faint: "#5B6981",
  gold: "#F5A524",
  gold2: "#FFCC66",
  green: "#3FE0A6",
  red: "#FF6B6B",
  violet: "#8B5CF6",
  violet2: "#B79CFF",
} as const;

const W = 1200;
const H = 630;

// ── SVG helpers ───────────────────────────────────────────────────────────────

function clamp(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

function dirColor(dir: string): string {
  if (dir === "long") return C.green;
  if (dir === "short") return C.red;
  if (dir === "hedge") return C.violet2;
  return C.muted;
}

function riskColor(risk: string): string {
  if (risk === "low") return C.green;
  if (risk === "high") return C.red;
  return C.gold;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Wrap text into lines of at most `maxChars` characters. */
function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > maxChars) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) lines.push(current.trim());
  return lines;
}

// ── SVG builder ───────────────────────────────────────────────────────────────

export function buildShareSvg(data: ShareCardData): string {
  const { intent, direction, asset, sizeMUSD, predictedReturnLabel, risk, verdict } = data;
  const isVerdict = !!verdict;
  const dc = dirColor(direction);
  const rc = riskColor(risk);
  const dirLabel = direction.charAt(0).toUpperCase() + direction.slice(1);

  // intent word-wrap: ~72 chars per line, max 2 lines
  const intentLines = wrapText(clamp(intent, 150), 70).slice(0, 2);

  // verdict summary word-wrap: ~80 chars per line, max 2 lines
  const verdictLines = verdict
    ? wrapText(clamp(verdict.summary, 160), 78).slice(0, 2)
    : [];

  // Accent strip color at the top - gold for thesis, violet for verdict
  const accentColor = isVerdict ? C.violet : C.gold;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0F1626"/>
      <stop offset="100%" stop-color="#080B12"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${C.gold}"/>
      <stop offset="100%" stop-color="${C.gold2}"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${accentColor}"/>
      <stop offset="100%" stop-color="${isVerdict ? C.violet2 : C.gold2}"/>
    </linearGradient>
    <clipPath id="roundClip">
      <rect width="${W}" height="${H}" rx="0" ry="0"/>
    </clipPath>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#bgGrad)"/>

  <!-- Subtle radial glow - top-left gold -->
  <radialGradient id="glow1" cx="10%" cy="0%" r="55%">
    <stop offset="0%" stop-color="${C.gold}" stop-opacity="0.12"/>
    <stop offset="100%" stop-color="${C.gold}" stop-opacity="0"/>
  </radialGradient>
  <rect width="${W}" height="${H}" fill="url(#glow1)"/>

  <!-- Subtle radial glow - bottom-right violet -->
  <radialGradient id="glow2" cx="90%" cy="100%" r="55%">
    <stop offset="0%" stop-color="${C.violet}" stop-opacity="0.10"/>
    <stop offset="100%" stop-color="${C.violet}" stop-opacity="0"/>
  </radialGradient>
  <rect width="${W}" height="${H}" fill="url(#glow2)"/>

  <!-- Top accent bar -->
  <rect x="0" y="0" width="${W}" height="5" fill="url(#accentGrad)"/>

  <!-- Card border inset -->
  <rect x="1" y="5" width="${W - 2}" height="${H - 6}" rx="0" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>

  <!-- AUTONOE wordmark -->
  <text x="64" y="72" font-family="'Courier New', Courier, monospace" font-size="13" font-weight="700"
        letter-spacing="0.32em" text-transform="uppercase" fill="${C.gold2}" opacity="0.9">AUTONOE</text>

  <!-- Wordmark separator dot -->
  <circle cx="200" cy="66" r="3.5" fill="${C.gold}" opacity="0.7"/>

  <!-- Card type label (thesis / verdict) -->
  <text x="218" y="72" font-family="'Courier New', Courier, monospace" font-size="11" letter-spacing="0.22em"
        fill="${C.muted}" opacity="0.75">${escapeXml(isVerdict ? "JUDGE VERDICT" : "THESIS OPTION")}</text>

  <!-- Horizontal rule below header -->
  <line x1="64" y1="90" x2="${W - 64}" y2="90" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>

  <!-- Direction pill background -->
  <rect x="64" y="120" width="120" height="36" rx="8" fill="${dc}" fill-opacity="0.12"
        stroke="${dc}" stroke-opacity="0.35" stroke-width="1"/>
  <!-- Direction label -->
  <text x="124" y="143" font-family="'Courier New', Courier, monospace" font-size="13" font-weight="700"
        letter-spacing="0.18em" fill="${dc}" text-anchor="middle">${escapeXml(dirLabel.toUpperCase())}</text>

  <!-- Asset -->
  <text x="210" y="145" font-family="'Courier New', Courier, monospace" font-size="38" font-weight="700"
        fill="${C.ink}">${escapeXml(asset)}</text>

  <!-- Risk pill -->
  <rect x="${W - 64 - 120}" y="120" width="120" height="36" rx="8" fill="${rc}" fill-opacity="0.10"
        stroke="${rc}" stroke-opacity="0.35" stroke-width="1"/>
  <text x="${W - 64 - 60}" y="143" font-family="'Courier New', Courier, monospace" font-size="11" font-weight="700"
        letter-spacing="0.18em" fill="${rc}" text-anchor="middle">${escapeXml(risk.toUpperCase())} RISK</text>

  <!-- Divider below asset row -->
  <line x1="64" y1="178" x2="${W - 64}" y2="178" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>

  <!-- ── Stats row ─────────────────────────────────────────────────────── -->

  <!-- Size block -->
  <text x="64" y="218" font-family="'Courier New', Courier, monospace" font-size="10" letter-spacing="0.22em"
        fill="${C.faint}">SIZE</text>
  <text x="64" y="248" font-family="'Courier New', Courier, monospace" font-size="22" font-weight="700"
        fill="${C.gold2}">${escapeXml(sizeMUSD.toLocaleString())} mUSD</text>

  <!-- Vertical separator 1 -->
  <line x1="310" y1="200" x2="310" y2="265" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>

  <!-- Predicted return block -->
  <text x="340" y="218" font-family="'Courier New', Courier, monospace" font-size="10" letter-spacing="0.22em"
        fill="${C.faint}">PREDICTED RETURN</text>
  <text x="340" y="248" font-family="'Courier New', Courier, monospace" font-size="22" font-weight="700"
        fill="${C.green}">${escapeXml(predictedReturnLabel)}</text>

  ${verdict ? `
  <!-- Vertical separator 2 -->
  <line x1="720" y1="200" x2="720" y2="265" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>

  <!-- Confidence block -->
  <text x="750" y="218" font-family="'Courier New', Courier, monospace" font-size="10" letter-spacing="0.22em"
        fill="${C.faint}">CONFIDENCE</text>
  <text x="750" y="248" font-family="'Courier New', Courier, monospace" font-size="22" font-weight="700"
        fill="${C.violet2}">${(verdict.confidence * 100).toFixed(0)}%</text>

  <!-- Confidence bar track -->
  <rect x="750" y="258" width="340" height="6" rx="3" fill="rgba(255,255,255,0.06)"/>
  <!-- Confidence bar fill -->
  <rect x="750" y="258" width="${Math.round(340 * verdict.confidence)}" height="6" rx="3"
        fill="${C.violet}"/>
  ` : ""}

  <!-- Divider below stats -->
  <line x1="64" y1="290" x2="${W - 64}" y2="290" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>

  <!-- ── Intent section ────────────────────────────────────────────────── -->
  <text x="64" y="326" font-family="'Courier New', Courier, monospace" font-size="10" letter-spacing="0.22em"
        fill="${C.faint}">INTENT</text>
  ${intentLines.map((line, i) => `
  <text x="64" y="${354 + i * 30}" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="300"
        fill="${C.muted}">${escapeXml(line)}</text>`).join("")}

  ${isVerdict && verdictLines.length > 0 ? `
  <!-- Divider before verdict summary -->
  <line x1="64" y1="${354 + intentLines.length * 30 + 14}" x2="${W - 64}" y2="${354 + intentLines.length * 30 + 14}"
        stroke="rgba(255,255,255,0.06)" stroke-width="1"/>

  <!-- Judge summary label -->
  <text x="64" y="${354 + intentLines.length * 30 + 46}" font-family="'Courier New', Courier, monospace"
        font-size="10" letter-spacing="0.22em" fill="${C.violet2}">JUDGE SUMMARY</text>
  ${verdictLines.map((line, i) => `
  <text x="64" y="${354 + intentLines.length * 30 + 74 + i * 28}"
        font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="300"
        fill="${C.ink}">${escapeXml(line)}</text>`).join("")}
  ` : ""}

  <!-- ── Footer ────────────────────────────────────────────────────────── -->
  <line x1="0" y1="${H - 58}" x2="${W}" y2="${H - 58}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>

  <!-- Left: network tag -->
  <text x="64" y="${H - 28}" font-family="'Courier New', Courier, monospace" font-size="10.5" letter-spacing="0.18em"
        fill="${C.faint}">HASHKEY CHAIN · NOT FINANCIAL ADVICE</text>

  <!-- Right: autonoe.xyz placeholder -->
  <text x="${W - 64}" y="${H - 28}" font-family="'Courier New', Courier, monospace" font-size="10.5"
        letter-spacing="0.12em" fill="${C.gold}" text-anchor="end" opacity="0.7">autonoe.xyz</text>
</svg>`;

  return svg;
}

// ── PNG export via canvas ─────────────────────────────────────────────────────

/**
 * SVG → PNG download without any library.
 * 1. Base64-encode the SVG.
 * 2. Draw it to a canvas via HTMLImageElement.
 * 3. canvas.toBlob → trigger <a download>.
 */
export function downloadSvgAsPng(svg: string, filename = "autonoe-thesis.png"): Promise<void> {
  return new Promise((resolve, reject) => {
    // btoa can't handle multi-byte chars; encodeURIComponent+unescape handles that safely.
    const encoded = btoa(unescape(encodeURIComponent(svg)));
    const dataUrl = `data:image/svg+xml;base64,${encoded}`;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get 2D context"));
        return;
      }
      ctx.drawImage(img, 0, 0, W, H);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("canvas.toBlob returned null"));
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        // Revoke after a short delay to let the download start.
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        resolve();
      }, "image/png");
    };
    img.onerror = () => reject(new Error("Failed to load SVG as image"));
    img.src = dataUrl;
  });
}

// ── Text summary builder ──────────────────────────────────────────────────────

export function buildTextSummary(data: ShareCardData): string {
  const { intent, direction, asset, sizeMUSD, predictedReturnLabel, risk, verdict } = data;
  const dirLabel = direction.charAt(0).toUpperCase() + direction.slice(1);
  let text =
    `AUTONOE - ${verdict ? "Judge Verdict" : "Thesis Option"}\n` +
    `${"─".repeat(48)}\n` +
    `Intent:   ${intent}\n` +
    `Trade:    ${dirLabel} ${asset}\n` +
    `Size:     ${sizeMUSD.toLocaleString()} mUSD\n` +
    `Return:   ${predictedReturnLabel}\n` +
    `Risk:     ${risk.charAt(0).toUpperCase() + risk.slice(1)}\n`;

  if (verdict) {
    text +=
      `${"─".repeat(48)}\n` +
      `Verdict:  ${verdict.summary}\n` +
      `Conf.:    ${(verdict.confidence * 100).toFixed(0)}%\n`;
  }

  text +=
    `${"─".repeat(48)}\n` +
    `HashKey Chain · Not financial advice`;

  return text;
}

// ── Popover component ─────────────────────────────────────────────────────────

interface SharePopoverProps {
  data: ShareCardData;
  onClose: () => void;
}

function SharePopover({ data, onClose }: SharePopoverProps) {
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Close on backdrop click
  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const svg = buildShareSvg(data);
      await downloadSvgAsPng(svg);
    } catch {
      // Non-fatal - silently fail; user can try again
    } finally {
      setDownloading(false);
    }
  }

  async function handleCopy() {
    try {
      const text = buildTextSummary(data);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied - no-op
    }
  }

  const svg = buildShareSvg(data);
  const encoded = typeof btoa !== "undefined"
    ? btoa(unescape(encodeURIComponent(svg)))
    : "";
  const previewUrl = encoded ? `data:image/svg+xml;base64,${encoded}` : "";

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        background: "rgba(8,11,18,0.82)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(6px)",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Share card"
    >
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: 20,
          padding: "28px 28px 24px",
          width: "min(660px, 92vw)",
          position: "relative",
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "none",
            border: "none",
            color: "var(--faint)",
            cursor: "pointer",
            fontSize: 20,
            lineHeight: 1,
            padding: "4px 8px",
          }}
        >
          ×
        </button>

        {/* Title */}
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: "var(--gold2)",
            marginBottom: 16,
          }}
        >
          Share as card
        </div>

        {/* SVG preview */}
        {previewUrl && (
          <div
            style={{
              borderRadius: 12,
              overflow: "hidden",
              border: "1px solid var(--line)",
              marginBottom: 18,
              background: "#0B0E14",
              lineHeight: 0,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Share card preview"
              style={{ width: "100%", display: "block" }}
            />
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-gold"
            onClick={handleDownload}
            disabled={downloading}
            style={{ flex: 1, justifyContent: "center", minWidth: 160 }}
          >
            {downloading ? "Exporting…" : "Download PNG"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleCopy}
            style={{ flex: 1, justifyContent: "center", minWidth: 160 }}
          >
            {copied ? "Copied!" : "Copy summary"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ShareButton (public API) ──────────────────────────────────────────────────

export interface ShareButtonProps {
  data: ShareCardData;
  /** Extra CSS classes applied to the trigger button. */
  className?: string;
  /** Button label. Defaults to "Share". */
  label?: string;
}

export function ShareButton({ data, className = "", label = "Share" }: ShareButtonProps) {
  const [open, setOpen] = useState(false);

  const handleClose = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        className={`btn btn-ghost ${className}`}
        onClick={() => setOpen(true)}
        aria-label={`Share ${data.asset} ${data.direction} card`}
      >
        <ShareIcon />
        {label}
      </button>

      {open && <SharePopover data={data} onClose={handleClose} />}
    </>
  );
}

// ── Minimal share icon (inline SVG, no external dep) ─────────────────────────

function ShareIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="13" cy="3" r="1.5" />
      <circle cx="3" cy="8" r="1.5" />
      <circle cx="13" cy="13" r="1.5" />
      <line x1="4.5" y1="7" x2="11.5" y2="4" />
      <line x1="4.5" y1="9" x2="11.5" y2="12" />
    </svg>
  );
}
