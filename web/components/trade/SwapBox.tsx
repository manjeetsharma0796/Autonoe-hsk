"use client";

import { useMemo, useState } from "react";
import { keccak256, stringToHex, formatUnits } from "viem";
import type { ExecuteResult } from "@autonoe/wallet";
import { SLIPPAGES, formatTo, type Pair } from "./data";
import { Button } from "@/components/ui/Button";
import { useWallet } from "@/components/wallet/WalletProvider";
import { ExecuteModal } from "@/components/wallet/ExecuteModal";

/** Assets with an oracle-priced synthetic market (everything else is advice-only). */
const SYNTHETIC = ["BTC", "ETH", "SUI", "SOL"];

function FlipIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 4v13M7 17l-3-3M7 17l3-3M17 20V7M17 7l-3 3M17 7l3 3" />
    </svg>
  );
}

function Caret() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path
        d="M12 8h.01M11 12h1v4h1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/,/g, "")) || 0;
}

export function SwapBox({ pair }: { pair: Pair }) {
  const wallet = useWallet();
  const [fromRaw, setFromRaw] = useState("1,000");
  const [slip, setSlip] = useState("0.5%");
  const [modalOpen, setModalOpen] = useState(false);

  const fromNum = useMemo(() => parseAmount(fromRaw), [fromRaw]);
  const toOut = useMemo(() => fromNum * pair.rate, [fromNum, pair.rate]);
  const toStr = useMemo(() => formatTo(fromNum, pair.rate), [fromNum, pair.rate]);

  const slipNum = useMemo(() => parseFloat(slip) / 100, [slip]);
  const minReceived = useMemo(
    () =>
      (toOut * (1 - slipNum)).toLocaleString(undefined, {
        maximumFractionDigits: pair.rate < 0.01 ? 6 : 2,
      }),
    [toOut, slipNum, pair.rate]
  );
  const rateStr = useMemo(
    () =>
      pair.rate.toLocaleString(undefined, {
        maximumFractionDigits: pair.rate < 0.01 ? 8 : 4,
      }),
    [pair.rate]
  );

  const isWmnt = pair.sym === "WMNT";
  const isSynthetic = SYNTHETIC.includes(pair.sym);
  const executable = isWmnt || isSynthetic;
  const routeLabel = isWmnt
    ? "Mantle AMM"
    : isSynthetic
      ? "SyntheticExchange"
      : "advice-only";

  // Real mUSD balance from the agent wallet (the swap spends mUSD).
  const mUSDBalance = wallet.balances
    ? `${Number(formatUnits(wallet.balances.mUSD, 6)).toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })} mUSD`
    : "—";

  async function handleConfirm(
    passphrase: string | null,
  ): Promise<ExecuteResult> {
    if (!wallet.isUnlocked && passphrase) {
      await wallet.unlock(passphrase);
    }
    // Unique id so each direct trade is its own verifiable record.
    const id = `trade-${pair.sym}-${Date.now()}`;
    const thesisHash = keccak256(stringToHex(id));
    const zeroHash = `0x${"0".repeat(64)}` as `0x${string}`;
    return wallet.execute(
      {
        direction: "long",
        asset: pair.sym,
        sizeMUSD: fromNum,
        optionRef: id,
        apiBase: "",
      },
      {
        thesisHash,
        verdictHash: zeroHash,
        meta: { thesisId: id, source: "human", judged: false },
      },
    );
  }

  return (
    <section className="panel">
      <div className="phead">
        <span className="lab">Swap · Execute</span>
      </div>
      <div className="pbody">
        <div className="swapfield">
          <div className="sf-top">
            <span>From</span>
            <span className="bal">Balance: {mUSDBalance}</span>
          </div>
          <div className="sf-main">
            <input
              className="sf-amt"
              type="text"
              inputMode="decimal"
              value={fromRaw}
              onChange={(e) => setFromRaw(e.target.value)}
              aria-label="From amount"
            />
            <div className="sf-asset">
              <span className="b">$</span>
              <span className="a">mUSD</span>
            </div>
          </div>
        </div>

        <div className="swapmid">
          <button type="button" aria-label="Flip direction">
            <FlipIcon />
          </button>
        </div>

        <div className="swapfield">
          <div className="sf-top">
            <span>To (estimated)</span>
          </div>
          <div className="sf-main">
            <input
              className="sf-amt"
              type="text"
              value={toStr}
              readOnly
              aria-label="To amount"
            />
            <div className="sf-asset">
              <span className="b">{pair.badge}</span>
              <span className="a">{pair.sym}</span>
              <Caret />
            </div>
          </div>
        </div>

        <div className="summary">
          <div className="srow">
            <span>Rate</span>
            <span className="v">
              1 mUSD = {rateStr} {pair.sym}
            </span>
          </div>
          <div className="srow">
            <span>Min. received</span>
            <span className="v">
              {minReceived} {pair.sym}
            </span>
          </div>
          <div className="srow">
            <span>Route</span>
            <span className="v violet">
              mUSD → {pair.sym} · {routeLabel}
            </span>
          </div>
          <div className="slip">
            <span className="lab">Slippage tolerance</span>
            <div className="slipchips">
              {SLIPPAGES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`chip ${s === slip ? "on" : ""}`}
                  onClick={() => setSlip(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="note">
          <InfoIcon />
          <span>
            {executable ? (
              <>
                {isWmnt
                  ? "Real mUSD → WMNT swap on the Mantle AMM."
                  : "Opens an oracle-priced synthetic position on Mantle."}{" "}
                The agent wallet reverts if you receive less than the minimum.
                Testnet only - not financial advice.
              </>
            ) : (
              <>
                {pair.sym} is advice-only — only WMNT and the synthetic markets
                (BTC, ETH, SUI, SOL) are executable on-chain. Testnet only - not
                financial advice.
              </>
            )}
          </span>
        </div>

        {executable ? (
          <Button
            variant="gold"
            size="lg"
            block
            style={{ marginTop: 16 }}
            disabled={!wallet.isCreated || fromNum <= 0}
            title={
              !wallet.isCreated
                ? "Create an agent wallet to execute"
                : fromNum <= 0
                  ? "Enter an amount"
                  : "Execute on Mantle Sepolia"
            }
            onClick={() => setModalOpen(true)}
          >
            Execute {isWmnt ? "swap" : "position"} →
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="lg"
            block
            disabled
            style={{ marginTop: 16 }}
            title="Only WMNT and the synthetic markets (BTC, ETH, SUI, SOL) are executable on-chain"
          >
            Advice-only · not executable on-chain
          </Button>
        )}
      </div>

      {modalOpen && executable && (
        <ExecuteModal
          option={{
            id: `trade-${pair.sym}`,
            direction: "long",
            asset: pair.sym,
            sizeMUSD: fromNum,
            predictedReturnLabel: "—",
            risk: "medium",
          }}
          onConfirm={handleConfirm}
          onClose={() => setModalOpen(false)}
          isUnlocked={wallet.isUnlocked}
        />
      )}
    </section>
  );
}
