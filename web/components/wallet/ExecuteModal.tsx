'use client';

import { useState, type ReactNode } from 'react';
import type { ExecuteResult } from '@autonoe/wallet';
import { txUrl } from '@autonoe/chain';

export interface ExecuteModalOption {
  id: string;
  direction: 'long' | 'short' | 'hedge' | 'hold';
  asset: string;
  sizeMUSD: number;
  predictedReturnLabel: string; // e.g. "+2.5% to +8.0%" or "+4.2%"
  risk: 'low' | 'medium' | 'high';
}

interface Props {
  option: ExecuteModalOption;
  /**
   * Called when the user confirms. Receives `passphrase` (non-null only when
   * wallet was locked and user entered it here). Must resolve with ExecuteResult
   * or reject with an Error.
   */
  onConfirm: (passphrase: string | null) => Promise<ExecuteResult>;
  onClose: () => void;
  /** Whether the wallet is currently unlocked (no passphrase prompt needed). */
  isUnlocked: boolean;
}

const directionColour: Record<string, string> = {
  long: 'var(--green)',
  short: 'var(--red)',
  hedge: 'var(--violet2)',
  hold: 'var(--muted)',
};

const riskColour: Record<string, string> = {
  low: 'var(--green)',
  medium: 'var(--gold2)',
  high: 'var(--red)',
};

type Phase = 'confirm' | 'pending' | 'done' | 'error';

export function ExecuteModal({ option, onConfirm, onClose, isUnlocked }: Props) {
  const [passphrase, setPassphrase] = useState('');
  const [phase, setPhase] = useState<Phase>('confirm');
  const [result, setResult] = useState<ExecuteResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleConfirm() {
    const pw = isUnlocked ? null : passphrase.trim();
    if (!isUnlocked && !pw) return;
    setPhase('pending');
    try {
      const res = await onConfirm(pw);
      setResult(res);
      setPhase('done');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  }

  const row = (label: string, value: ReactNode, colour?: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: 'var(--faint)' }}>
        {label}
      </span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, color: colour ?? 'var(--ink)' }}>
        {value}
      </span>
    </div>
  );

  return (
    <>
      {/* Overlay */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
        onClick={phase === 'confirm' || phase === 'error' ? onClose : undefined}
        aria-hidden
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal
        aria-label="Confirm trade execution"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 201,
          width: 'min(440px, 94vw)',
          background: 'linear-gradient(180deg, var(--panel), var(--bg2))',
          border: '1px solid var(--line)',
          borderRadius: 20,
          padding: '30px 28px',
          boxShadow: 'var(--shadow)',
          overflowY: 'auto',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.26em', textTransform: 'uppercase' as const, color: 'var(--gold2)' }}>
            Confirm trade
          </span>
          {(phase === 'confirm' || phase === 'error') && (
            <button
              className="btn btn-ghost"
              style={{ padding: '6px 12px', fontSize: 12 }}
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
          )}
        </div>

        {/* ── Confirm phase ── */}
        {phase === 'confirm' && (
          <>
            <div style={{ border: '1px solid var(--line)', borderRadius: 14, padding: '18px 16px', marginBottom: 20 }}>
              {row('Direction', option.direction.toUpperCase(), directionColour[option.direction])}
              {row('Asset', option.asset)}
              {row('Size', `${option.sizeMUSD.toLocaleString()} mUSD`)}
              {row('Predicted return', option.predictedReturnLabel, 'var(--green)')}
              {row('Risk', option.risk.toUpperCase(), riskColour[option.risk])}
            </div>

            {!isUnlocked && (
              <div style={{ marginBottom: 18 }}>
                <label
                  htmlFor="exec-passphrase"
                  style={{
                    display: 'block',
                    fontFamily: 'var(--mono)',
                    fontSize: 11,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase' as const,
                    color: 'var(--faint)',
                    marginBottom: 8,
                  }}
                >
                  Wallet passphrase
                </label>
                <input
                  id="exec-passphrase"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter passphrase to unlock and sign"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleConfirm(); }}
                  style={{
                    width: '100%',
                    fontFamily: 'var(--body)',
                    fontSize: 14,
                    color: 'var(--ink)',
                    padding: '12px 14px',
                    borderRadius: 11,
                    border: '1px solid var(--line)',
                    background: 'rgba(255,255,255,0.025)',
                    outline: 'none',
                  }}
                />
              </div>
            )}

            <div style={{
              background: 'rgba(245,165,36,0.07)',
              border: '1px solid rgba(245,165,36,0.2)',
              borderRadius: 10,
              padding: '10px 12px',
              marginBottom: 18,
            }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--gold2)' }}>
                Testnet · not financial advice · trade cannot be undone after signing
              </span>
            </div>

            <button
              className="btn btn-gold"
              style={{ width: '100%', justifyContent: 'center' }}
              type="button"
              onClick={() => void handleConfirm()}
              disabled={!isUnlocked && !passphrase.trim()}
            >
              Confirm &amp; Execute
            </button>
          </>
        )}

        {/* ── Pending phase ── */}
        {phase === 'pending' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--gold2)', marginBottom: 10 }}>
              Submitting trade…
            </div>
            <div style={{ fontFamily: 'var(--body)', fontSize: 14, color: 'var(--muted)' }}>
              Signing and broadcasting to HashKey Chain. Do not close this window.
            </div>
          </div>
        )}

        {/* ── Error phase ── */}
        {phase === 'error' && (
          <>
            <div style={{
              background: 'rgba(255,107,107,0.07)',
              border: '1px solid rgba(255,107,107,0.25)',
              borderRadius: 12,
              padding: '14px 16px',
              marginBottom: 18,
            }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: 'var(--red)', marginBottom: 6 }}>
                Trade failed
              </div>
              <p style={{ fontFamily: 'var(--body)', fontSize: 14, color: 'var(--muted)', lineHeight: 1.5 }}>
                {errorMsg}
              </p>
            </div>
            <button
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'center' }}
              type="button"
              onClick={onClose}
            >
              Close
            </button>
          </>
        )}

        {/* ── Done phase ── */}
        {phase === 'done' && result && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%', background: 'var(--green)',
                display: 'inline-block', boxShadow: '0 0 10px var(--green)',
              }} />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--green)', fontWeight: 700 }}>
                Trade executed successfully
              </span>
            </div>

            <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: 'var(--faint)', marginBottom: 8 }}>
                Trade tx
              </div>
              <a
                href={txUrl(result.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--gold2)', wordBreak: 'break-all' }}
              >
                {result.txHash}
              </a>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--faint)', marginTop: 6 }}>
                {result.kind === 'amm' ? 'AMM swap' : 'Synthetic position'} · {result.amountInMUSD} mUSD in
              </div>
            </div>

            {result.decision && (
              <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: 'var(--faint)', marginBottom: 8 }}>
                  Decision log
                </div>
                <a
                  href={txUrl(result.decision.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--violet2)', wordBreak: 'break-all' }}
                >
                  {result.decision.txHash}
                </a>
              </div>
            )}

            {/* Non-blocking logError warning - trade already committed */}
            {result.logError && (
              <div style={{
                background: 'rgba(245,165,36,0.07)',
                border: '1px solid rgba(245,165,36,0.25)',
                borderRadius: 10,
                padding: '10px 14px',
                marginBottom: 16,
              }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: 'var(--gold2)', marginBottom: 4 }}>
                  Warning
                </div>
                <p style={{ fontFamily: 'var(--body)', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                  Trade succeeded but on-chain logging failed - do NOT retry.
                </p>
                <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--faint)', marginTop: 4 }}>
                  {result.logError}
                </p>
              </div>
            )}

            <button
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'center' }}
              type="button"
              onClick={onClose}
            >
              Close
            </button>
          </>
        )}
      </div>
    </>
  );
}
