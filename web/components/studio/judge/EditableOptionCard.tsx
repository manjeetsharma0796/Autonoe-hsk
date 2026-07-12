"use client";

import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import type { RefinedOption, Thesis } from "@autonoe/shared";
import { keccak256, stringToHex } from "viem";
import type { ExecuteResult } from "@autonoe/wallet";
import { buildCommitment, hashCommitment } from "@/lib/commitment";
import { useWallet } from "@/components/wallet/WalletProvider";
import { ExecuteModal } from "@/components/wallet/ExecuteModal";
import { ShareButton } from "@/components/share/ShareCard";
import { Button } from "@/components/ui/Button";
import { ArrowRightIcon } from "../icons";
import styles from "./EditableOptionCard.module.css";

export interface EditableOptionCardProps {
  opt: RefinedOption;
  thesis: Thesis | null;
  animate: boolean;
  judgeSummary?: string;
  selected?: boolean;
  onSelect?: () => void;
}

/**
 * Editable upgrade of RefinedCard. Direction is read-only (FK into
 * thesis.options); Size (mUSD) and Stop-loss are locally editable and
 * flow into Execute. Entry / Take-profit are read-only when derivable.
 */
export function EditableOptionCard({
  opt,
  thesis,
  animate,
  judgeSummary,
  selected = false,
  onSelect,
}: EditableOptionCardProps): JSX.Element {
  const wallet = useWallet();
  const barRef = useRef<HTMLDivElement>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Matching ThesisOption carries direction / asset / sizeMUSD.
  const matchingOpt = thesis?.options.find((o) => o.id === opt.optionRef);

  // ── Editable local state, seeded from the thesis option ────────────────────
  const [sizeMUSD, setSizeMUSD] = useState<number>(matchingOpt?.sizeMUSD ?? 0);
  const [stopLoss, setStopLoss] = useState<number>(() =>
    deriveStopLoss(matchingOpt?.risk ?? opt.risk),
  );

  // Re-seed if the underlying option changes identity.
  useEffect(() => {
    setSizeMUSD(matchingOpt?.sizeMUSD ?? 0);
    setStopLoss(deriveStopLoss(matchingOpt?.risk ?? opt.risk));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opt.optionRef]);

  // Read-only take-profit, derived from the predicted return.
  const takeProfit =
    opt.predictedOutputPct > 0 ? Math.abs(opt.predictedOutputPct) : null;

  // ── Confidence bar fill animation ──────────────────────────────────────────
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const pct = `${(opt.confidence * 100).toFixed(0)}%`;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!animate || reduce) {
      bar.style.transition = "none";
      bar.style.width = pct;
      return;
    }
    bar.style.width = "0%";
    const raf = requestAnimationFrame(() => {
      bar.style.width = pct;
    });
    return () => cancelAnimationFrame(raf);
  }, [animate, opt.confidence]);

  // ── Execute wiring (faithful to RefinedCard) ───────────────────────────────
  async function handleConfirm(passphrase: string | null): Promise<ExecuteResult> {
    if (!wallet.isUnlocked && passphrase) {
      await wallet.unlock(passphrase);
    }
    if (!thesis) throw new Error("No thesis available");
    if (!matchingOpt) throw new Error(`No matching thesis option for ref "${opt.optionRef}"`);

    // Commit-reveal: hash the canonical payload (incl. which models + the edited
    // size) on-chain so it can be revealed and verified later.
    const commitment = buildCommitment(thesis, {
      optionRef: opt.optionRef,
      asset: matchingOpt.asset,
      direction: matchingOpt.direction,
      sizeMUSD,
    });
    const thesisHash = hashCommitment(commitment);
    const verdictHash = keccak256(stringToHex(thesis.id + "|verdict"));

    return wallet.execute(
      {
        direction: matchingOpt.direction,
        asset: matchingOpt.asset,
        sizeMUSD, // EDITED size flows through
        optionRef: opt.optionRef,
        apiBase: "",
      },
      {
        thesisHash,
        verdictHash,
        meta: {
          thesisId: thesis.id,
          source: thesis.source,
          judged: true,
          modelsUsed: thesis.modelsUsed,
          commitment,
        },
      },
    );
  }

  const canExecute = !!matchingOpt && matchingOpt.direction !== "hold" && wallet.isCreated;
  const direction = matchingOpt?.direction;
  const retLabel = `${opt.predictedOutputPct >= 0 ? "+" : ""}${opt.predictedOutputPct.toFixed(1)}%`;

  // Direction badge glyph + class.
  const dirGlyph =
    direction === "long" ? "▲" : direction === "short" ? "▼" : direction === "hedge" ? "⇄" : "■";
  const dirClass =
    direction === "long"
      ? styles.long
      : direction === "short"
        ? styles.short
        : direction === "hedge"
          ? styles.hedge
          : styles.hold;

  return (
    <>
      <article
        className={`${styles.card} ${selected ? styles.selected : ""}`}
        aria-current={selected ? "true" : undefined}
      >
        {/* Header - direction badge + risk + select affordance */}
        <header className={styles.head}>
          <span className={`${styles.dir} ${dirClass}`}>
            <span className={styles.glyph} aria-hidden="true">
              {dirGlyph}
            </span>
            {(direction ?? "option").toUpperCase()}
            {matchingOpt && <span className={styles.asset}>{matchingOpt.asset}</span>}
          </span>
          <div className={styles.headRight}>
            <span className={`${styles.riskpill} ${styles[opt.risk]}`}>{opt.risk}</span>
            {onSelect && (
              <button
                type="button"
                className={`${styles.selBtn} ${selected ? styles.selBtnOn : ""}`}
                onClick={onSelect}
                aria-pressed={selected}
                aria-label={selected ? "Preferred option (selected)" : "Choose as preferred option"}
              >
                {selected ? "Preferred" : "Choose"}
              </button>
            )}
          </div>
        </header>

        <div className={styles.refLine}>{opt.optionRef}</div>

        {/* Predicted outcome - big stat */}
        <div className={styles.pct}>
          <span className={`${styles.pv} num`}>{retLabel}</span>
          <span className={styles.pl}>predicted outcome</span>
        </div>

        {/* Editable trade params */}
        <div className={styles.params}>
          <label className={styles.param}>
            <span className={styles.plab}>Size (mUSD)</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={1}
              value={Number.isFinite(sizeMUSD) ? sizeMUSD : ""}
              onChange={(e) => setSizeMUSD(parseFloat(e.target.value))}
              className={`${styles.input} num`}
              aria-label="Position size in mUSD"
            />
          </label>
          <label className={styles.param}>
            <span className={styles.plab}>Stop-loss %</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.1}
              value={Number.isFinite(stopLoss) ? stopLoss : ""}
              onChange={(e) => setStopLoss(parseFloat(e.target.value))}
              className={`${styles.input} ${styles.inputStop} num`}
              aria-label="Stop-loss percent"
            />
          </label>
        </div>

        {/* Read-only derived levels */}
        {takeProfit !== null && (
          <div className={styles.levels}>
            <div className={styles.level}>
              <span className={styles.llab}>Take-profit</span>
              <span className={`${styles.lval} num`}>+{takeProfit.toFixed(1)}%</span>
            </div>
            <div className={styles.level}>
              <span className={styles.llab}>Risk / reward</span>
              <span className={`${styles.lval} num`}>
                {stopLoss > 0 ? `${(takeProfit / stopLoss).toFixed(2)}×` : "-"}
              </span>
            </div>
          </div>
        )}

        {/* Caveats */}
        {opt.caveats.length > 0 && (
          <div className={styles.caveats}>
            <div className={styles.cl}>Caveats</div>
            <ul>
              {opt.caveats.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Confidence bar */}
        <div className={styles.conf}>
          <div className={styles.ch}>
            <span className={styles.ck}>Confidence</span>
            <span className={`${styles.cv} num`}>{opt.confidence.toFixed(2)}</span>
          </div>
          <div className={styles.track}>
            <div className={styles.bar} ref={barRef} />
          </div>
        </div>

        {/* Actions */}
        <div className={styles.acts}>
          <Button
            variant="gold"
            disabled={!canExecute}
            title={
              !wallet.isCreated
                ? "Create an agent wallet to execute"
                : !matchingOpt
                  ? "No matching thesis option found"
                  : matchingOpt.direction === "hold"
                    ? "Hold - no trade"
                    : "Execute this option"
            }
            onClick={() => setModalOpen(true)}
            style={{ flex: 1 }}
            iconLeft={<ArrowRightIcon />}
          >
            Execute
          </Button>
          {matchingOpt && (
            <ShareButton
              label="Share"
              data={{
                intent: thesis?.intent ?? opt.optionRef,
                direction: matchingOpt.direction,
                asset: matchingOpt.asset,
                sizeMUSD,
                predictedReturnLabel: retLabel,
                risk: opt.risk,
                verdict: judgeSummary
                  ? { summary: judgeSummary, confidence: opt.confidence }
                  : undefined,
              }}
            />
          )}
        </div>
      </article>

      {modalOpen && matchingOpt && (
        <ExecuteModal
          option={{
            id: opt.optionRef,
            direction: matchingOpt.direction,
            asset: matchingOpt.asset,
            sizeMUSD,
            predictedReturnLabel: retLabel,
            risk: opt.risk,
          }}
          onConfirm={handleConfirm}
          onClose={() => setModalOpen(false)}
          isUnlocked={wallet.isUnlocked}
        />
      )}
    </>
  );
}

/** Seed a sensible stop-loss % from the option's risk band. */
function deriveStopLoss(risk: RefinedOption["risk"]): number {
  switch (risk) {
    case "low":
      return 2;
    case "medium":
      return 5;
    case "high":
      return 10;
    default:
      return 5;
  }
}
