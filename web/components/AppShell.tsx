"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { KeyQuickPanel } from "@/components/keys/KeyQuickPanel";
import { usePathname } from "next/navigation";
import { useAccount, useSendTransaction } from "wagmi";
import { parseEther } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { HSK_FAUCET_URL, DEFAULT_POLICY, type SpendingPolicy } from "@autonoe/wallet";
import { useWallet } from "@/components/wallet/WalletProvider";

/** Amount of native HSK sent to the agent wallet by the "Fund agent" action. */
const FUND_AGENT_HSK = "0.5";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/markets", label: "Markets" },
  { href: "/trade", label: "Trade" },
  { href: "/studio", label: "Studio" },
  { href: "/history", label: "History" },
  { href: "/settings", label: "Settings" },
] as const;

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Format a BigInt token balance for display. dec = decimal places of the token. */
function formatBalance(raw: bigint, dec: number, displayDec = 4): string {
  const divisor = BigInt(10 ** dec);
  const whole = raw / divisor;
  const frac = raw % divisor;
  const fracStr = frac.toString().padStart(dec, "0").slice(0, displayDec);
  return `${whole.toLocaleString()}.${fracStr}`;
}

// ── Wallet Drawer ─────────────────────────────────────────────────────────────

function WalletDrawer({ onClose }: { onClose: () => void }) {
  const wallet = useWallet();

  // ── Agent wallet section state ──
  const [createPassphrase, setCreatePassphrase] = useState("");
  const [createConfirm, setCreateConfirm] = useState("");
  const [unlockPassphrase, setUnlockPassphrase] = useState("");
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletWorking, setWalletWorking] = useState(false);

  // ── Export state ──
  const [showReveal, setShowReveal] = useState(false);
  const [revealPassphrase, setRevealPassphrase] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealError, setRevealError] = useState<string | null>(null);

  // ── Fund state ──
  const [fundWorking, setFundWorking] = useState(false);
  const [fundResult, setFundResult] = useState<{ txHash: string; explorerUrl: string } | null>(null);
  const [fundError, setFundError] = useState<string | null>(null);

  // ── Policy state ──
  const [editPolicy, setEditPolicy] = useState(false);
  const [policyMax, setPolicyMax] = useState(wallet.policy.maxTradeMUSD.toString());
  const [policyTokens, setPolicyTokens] = useState(wallet.policy.allowedTokens.join(", "));
  const [policyError, setPolicyError] = useState<string | null>(null);

  // External funding wallet (connected via RainbowKit ConnectButton).
  const { isConnected } = useAccount();
  // Send native HSK from the connected external wallet to the agent wallet.
  const { sendTransaction, isPending: fundAgentPending } = useSendTransaction();

  function handleFundAgent() {
    if (!wallet.address) return;
    sendTransaction({
      to: wallet.address as `0x${string}`,
      value: parseEther(FUND_AGENT_HSK),
    });
  }

  async function handleCreate() {
    if (!createPassphrase) { setWalletError("Enter a passphrase"); return; }
    if (createPassphrase !== createConfirm) { setWalletError("Passphrases do not match"); return; }
    setWalletError(null);
    setWalletWorking(true);
    try {
      await wallet.create(createPassphrase);
      setCreatePassphrase("");
      setCreateConfirm("");
    } catch (e) {
      setWalletError(e instanceof Error ? e.message : String(e));
    } finally {
      setWalletWorking(false);
    }
  }

  async function handleUnlock() {
    if (!unlockPassphrase) { setWalletError("Enter your passphrase"); return; }
    setWalletError(null);
    setWalletWorking(true);
    try {
      await wallet.unlock(unlockPassphrase);
      setUnlockPassphrase("");
    } catch (e) {
      setWalletError(e instanceof Error ? e.message : String(e));
    } finally {
      setWalletWorking(false);
    }
  }

  async function handleReveal() {
    setRevealError(null);
    setRevealedKey(null);
    try {
      const key = await wallet.revealKey(revealPassphrase);
      setRevealedKey(key);
      setRevealPassphrase("");
    } catch (e) {
      setRevealError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleFund() {
    setFundError(null);
    setFundResult(null);
    setFundWorking(true);
    try {
      const r = await wallet.fundMusd();
      setFundResult(r);
    } catch (e) {
      setFundError(e instanceof Error ? e.message : String(e));
    } finally {
      setFundWorking(false);
    }
  }

  async function handleSavePolicy() {
    const max = parseFloat(policyMax);
    if (!isFinite(max) || max <= 0) { setPolicyError("Max trade must be a positive number"); return; }
    const tokens = policyTokens.split(",").map((t) => t.trim()).filter(Boolean);
    if (tokens.length === 0) { setPolicyError("At least one token required"); return; }
    const p: SpendingPolicy = { maxTradeMUSD: max, allowedTokens: tokens };
    try {
      await wallet.savePolicy(p);
      setEditPolicy(false);
      setPolicyError(null);
    } catch (e) {
      setPolicyError(e instanceof Error ? e.message : String(e));
    }
  }

  function handleResetPolicy() {
    setPolicyMax(DEFAULT_POLICY.maxTradeMUSD.toString());
    setPolicyTokens(DEFAULT_POLICY.allowedTokens.join(", "));
  }

  const mntFaucetUrl = wallet.address
    ? `${HSK_FAUCET_URL}?address=${wallet.address}`
    : HSK_FAUCET_URL;

  const label = (t: string) => (
    <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: "var(--faint)", marginBottom: 6 }}>
      {t}
    </div>
  );

  const sectionTitle = (t: string) => (
    <div style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase" as const, color: "var(--gold2)", marginBottom: 14, marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--line2)" }}>
      {t}
    </div>
  );

  return (
    <>
      <div
        className="drawer-overlay"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="drawer"
        role="dialog"
        aria-label="Wallet"
        style={{ overflowY: "auto" }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="tag">Wallet</span>
          <button className="btn btn-ghost" onClick={onClose} type="button" style={{ padding: "6px 12px", fontSize: 12 }}>
            Close
          </button>
        </div>

        {/* Testnet disclaimer */}
        <div style={{
          marginTop: 16,
          background: "rgba(245,165,36,0.07)",
          border: "1px solid rgba(245,165,36,0.2)",
          borderRadius: 10,
          padding: "9px 12px",
        }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--gold2)" }}>
            Testnet · not financial advice · agent never auto-executes
          </span>
        </div>

        {/* ── Section 1: External funding wallet (RainbowKit) ── */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase" as const, color: "var(--muted)", marginBottom: 12 }}>
            Funding wallet
          </div>
          <p style={{ fontFamily: "var(--body)", fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
            Connect an external wallet to fund the agent wallet or sign external txs.
          </p>
          <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />

          {/* Fund agent: send native HSK from the connected wallet to the agent address. */}
          {isConnected && wallet.address && (
            <div style={{ marginTop: 14 }}>
              <button
                className="btn btn-gold"
                style={{ fontSize: 12 }}
                disabled={fundAgentPending}
                onClick={handleFundAgent}
                type="button"
              >
                {fundAgentPending ? "Sending…" : `Fund agent (${FUND_AGENT_HSK} HSK) →`}
              </button>
              <p style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--faint)", marginTop: 8, lineHeight: 1.5 }}>
                Sends {FUND_AGENT_HSK} HSK from the connected wallet to the agent address. Confirm in your wallet.
              </p>
            </div>
          )}
        </div>

        {/* ── Section 2: Agent wallet (autonomous acting wallet) ── */}
        {sectionTitle("Agent wallet (acting wallet)")}

        {/* Acting indicator - shown whenever we have an address */}
        {wallet.address && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 14,
            padding: "8px 12px",
            border: "1px solid rgba(63,224,166,0.25)",
            borderRadius: 10,
            background: "rgba(63,224,166,0.06)",
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: wallet.isUnlocked ? "var(--green)" : "var(--faint)", display: "inline-block", boxShadow: wallet.isUnlocked ? "0 0 8px var(--green)" : "none" }} />
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: wallet.isUnlocked ? "var(--green)" : "var(--faint)" }}>
              {wallet.isUnlocked ? "Unlocked · signing ready" : "Locked"}
            </span>
          </div>
        )}

        {/* No wallet yet */}
        {!wallet.isCreated && (
          <>
            <p style={{ fontFamily: "var(--body)", fontSize: 13, color: "var(--muted)", marginBottom: 14, lineHeight: 1.5 }}>
              Create a dedicated autonomous wallet. The private key is encrypted locally - it never leaves your browser.
            </p>
            {label("Passphrase")}
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Choose a passphrase"
              value={createPassphrase}
              onChange={(e) => setCreatePassphrase(e.target.value)}
              style={{ width: "100%", fontFamily: "var(--body)", fontSize: 13, color: "var(--ink)", padding: "11px 13px", borderRadius: 10, border: "1px solid var(--line)", background: "rgba(255,255,255,0.025)", outline: "none", marginBottom: 10 }}
            />
            {label("Confirm passphrase")}
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter passphrase"
              value={createConfirm}
              onChange={(e) => setCreateConfirm(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
              style={{ width: "100%", fontFamily: "var(--body)", fontSize: 13, color: "var(--ink)", padding: "11px 13px", borderRadius: 10, border: "1px solid var(--line)", background: "rgba(255,255,255,0.025)", outline: "none", marginBottom: 14 }}
            />
            {walletError && <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--red)", marginBottom: 10 }}>{walletError}</p>}
            <button
              className="btn btn-gold"
              style={{ width: "100%", justifyContent: "center" }}
              disabled={walletWorking}
              onClick={() => void handleCreate()}
              type="button"
            >
              {walletWorking ? "Creating…" : "Create agent wallet →"}
            </button>
          </>
        )}

        {/* Wallet exists but locked */}
        {wallet.isCreated && !wallet.isUnlocked && (
          <>
            {wallet.address && (
              <>
                {label("Agent address")}
                <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink)", wordBreak: "break-all", marginBottom: 14 }}>
                  {wallet.address}
                </p>
              </>
            )}
            {label("Passphrase")}
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Enter passphrase to unlock"
              value={unlockPassphrase}
              onChange={(e) => setUnlockPassphrase(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleUnlock(); }}
              style={{ width: "100%", fontFamily: "var(--body)", fontSize: 13, color: "var(--ink)", padding: "11px 13px", borderRadius: 10, border: "1px solid var(--line)", background: "rgba(255,255,255,0.025)", outline: "none", marginBottom: 14 }}
            />
            {walletError && <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--red)", marginBottom: 10 }}>{walletError}</p>}
            <button
              className="btn btn-gold"
              style={{ width: "100%", justifyContent: "center" }}
              disabled={walletWorking}
              onClick={() => void handleUnlock()}
              type="button"
            >
              {walletWorking ? "Unlocking…" : "Unlock →"}
            </button>
          </>
        )}

        {/* Wallet unlocked */}
        {wallet.isCreated && wallet.isUnlocked && wallet.address && (
          <>
            {label("Agent address")}
            <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink)", wordBreak: "break-all", marginBottom: 16 }}>
              {wallet.address}
            </p>

            {/* Balances */}
            {wallet.balances ? (
              <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
                {label("Balances")}
                {[
                  { sym: "HSK (gas)", val: formatBalance(wallet.balances.mnt, 18), col: "var(--gold2)" },
                  { sym: "mUSD", val: formatBalance(wallet.balances.mUSD, 6), col: "var(--green)" },
                  { sym: "WMNT", val: formatBalance(wallet.balances.wmnt, 18), col: "var(--violet2)" },
                ].map((b) => (
                  <div key={b.sym} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)" }}>{b.sym}</span>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: b.col }}>{b.val}</span>
                  </div>
                ))}
                <button
                  className="btn btn-ghost"
                  style={{ marginTop: 6, fontSize: 11, padding: "6px 12px" }}
                  onClick={() => void wallet.refreshBalances()}
                  type="button"
                >
                  Refresh
                </button>
              </div>
            ) : (
              <button
                className="btn btn-ghost"
                style={{ fontSize: 12, marginBottom: 16 }}
                onClick={() => void wallet.refreshBalances()}
                type="button"
              >
                Load balances
              </button>
            )}

            {/* Fund mUSD */}
            <div style={{ marginBottom: 16 }}>
              <button
                className="btn btn-gold"
                style={{ fontSize: 12 }}
                disabled={fundWorking}
                onClick={() => void handleFund()}
                type="button"
              >
                {fundWorking ? "Requesting…" : "Fund mUSD (faucet)"}
              </button>
              {fundResult && (
                <div style={{ marginTop: 8 }}>
                  <a
                    href={fundResult.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--green)" }}
                  >
                    mUSD funded · view tx
                  </a>
                </div>
              )}
              {fundError && <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--red)", marginTop: 6 }}>{fundError}</p>}
            </div>

            {/* HSK gas faucet */}
            <div style={{ marginBottom: 16 }}>
              {label("HSK gas faucet")}
              <a
                href={mntFaucetUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--gold2)", wordBreak: "break-all" }}
              >
                {mntFaucetUrl}
              </a>
            </div>

            {/* Lock */}
            <button
              className="btn btn-ghost"
              style={{ fontSize: 12, marginBottom: 16 }}
              onClick={wallet.lock}
              type="button"
            >
              Lock wallet
            </button>

            {/* Export */}
            <div style={{ borderTop: "1px solid var(--line2)", paddingTop: 16, marginTop: 8, marginBottom: 16 }}>
              {label("Export")}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: "7px 13px" }}
                  onClick={() => { setShowReveal(!showReveal); setRevealedKey(null); setRevealError(null); }}
                  type="button"
                >
                  {showReveal ? "Hide" : "Reveal private key"}
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: "7px 13px" }}
                  onClick={() => void wallet.downloadKeystore()}
                  type="button"
                >
                  Download keystore
                </button>
              </div>

              {showReveal && !revealedKey && (
                <div style={{ marginTop: 12 }}>
                  <input
                    type="password"
                    autoComplete="current-password"
                    placeholder="Confirm passphrase"
                    value={revealPassphrase}
                    onChange={(e) => setRevealPassphrase(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void handleReveal(); }}
                    style={{ width: "100%", fontFamily: "var(--body)", fontSize: 13, color: "var(--ink)", padding: "10px 13px", borderRadius: 10, border: "1px solid var(--line)", background: "rgba(255,255,255,0.025)", outline: "none", marginBottom: 10 }}
                  />
                  {revealError && <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--red)", marginBottom: 8 }}>{revealError}</p>}
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 11, padding: "7px 13px" }}
                    onClick={() => void handleReveal()}
                    type="button"
                  >
                    Confirm reveal
                  </button>
                </div>
              )}

              {revealedKey && (
                <div style={{ marginTop: 12, background: "rgba(255,107,107,0.06)", border: "1px solid rgba(255,107,107,0.2)", borderRadius: 10, padding: "12px 14px" }}>
                  <p style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--red)", letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 6 }}>
                    Private key - keep secret
                  </p>
                  <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink)", wordBreak: "break-all" }}>
                    {revealedKey}
                  </p>
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 11, marginTop: 10, padding: "6px 12px" }}
                    onClick={() => { setRevealedKey(null); setShowReveal(false); }}
                    type="button"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Section 3: Spending policy ── */}
        {wallet.isCreated && (
          <>
            {sectionTitle("Spending policy")}
            {!editPolicy ? (
              <>
                <div style={{ marginBottom: 10 }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)" }}>Max per trade: </span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--gold2)", fontWeight: 700 }}>
                    {wallet.policy.maxTradeMUSD.toLocaleString()} mUSD
                  </span>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)" }}>Allowed tokens: </span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink)" }}>
                    {wallet.policy.allowedTokens.join(", ")}
                  </span>
                </div>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 12, padding: "8px 14px" }}
                  onClick={() => {
                    setPolicyMax(wallet.policy.maxTradeMUSD.toString());
                    setPolicyTokens(wallet.policy.allowedTokens.join(", "));
                    setEditPolicy(true);
                    setPolicyError(null);
                  }}
                  type="button"
                >
                  Edit policy
                </button>
              </>
            ) : (
              <>
                {label("Max trade (mUSD)")}
                <input
                  type="number"
                  min="1"
                  value={policyMax}
                  onChange={(e) => setPolicyMax(e.target.value)}
                  style={{ width: "100%", fontFamily: "var(--body)", fontSize: 13, color: "var(--ink)", padding: "10px 13px", borderRadius: 10, border: "1px solid var(--line)", background: "rgba(255,255,255,0.025)", outline: "none", marginBottom: 12 }}
                />
                {label("Allowed tokens (comma-separated)")}
                <input
                  type="text"
                  value={policyTokens}
                  onChange={(e) => setPolicyTokens(e.target.value)}
                  placeholder="WMNT, BTC, ETH, SUI, SOL"
                  style={{ width: "100%", fontFamily: "var(--body)", fontSize: 13, color: "var(--ink)", padding: "10px 13px", borderRadius: 10, border: "1px solid var(--line)", background: "rgba(255,255,255,0.025)", outline: "none", marginBottom: 12 }}
                />
                {policyError && <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--red)", marginBottom: 8 }}>{policyError}</p>}
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn btn-gold" style={{ fontSize: 12 }} onClick={() => void handleSavePolicy()} type="button">
                    Save
                  </button>
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={handleResetPolicy} type="button">
                    Reset to default
                  </button>
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setEditPolicy(false)} type="button">
                    Cancel
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* Bottom disclaimer */}
        <div style={{
          marginTop: 28,
          paddingTop: 20,
          borderTop: "1px solid var(--line2)",
          fontFamily: "var(--mono)",
          fontSize: 10.5,
          color: "var(--faint)",
          lineHeight: 1.6,
        }}>
          Testnet only · not financial advice · keys stored encrypted in your browser · Autonoe never has access to your keys
        </div>
      </aside>
    </>
  );
}

// ── AppShell ──────────────────────────────────────────────────────────────────

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // ── Key/model quick-panel state (additive; isolated from wallet drawer) ──
  const [keyPanelOpen, setKeyPanelOpen] = useState(false);

  const wallet = useWallet();

  // Scroll-condense the floating nav, matching the mockup.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Agent-wallet button reflects the self-custodial agent wallet only; the
  // external funding wallet has its own RainbowKit ConnectButton beside it.
  const agentBtnLabel = wallet.isUnlocked && wallet.address
    ? shortAddress(wallet.address)
    : "Agent wallet →";

  return (
    <>
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
        }}
      >
        <div className="wrap">
          <nav className={scrolled ? "nav scrolled" : "nav"}>
            <Link href="/" className="brand">
              <span className="dot" /> AUTONOE
            </Link>

            <div className="navlinks">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={pathname === link.href ? "active" : undefined}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Key/model quick-panel trigger - additive, isolated from wallet drawer */}
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => setKeyPanelOpen((v) => !v)}
              aria-label="Open API keys & models panel"
              title="API Keys & Models"
              style={{ padding: "9px 14px", fontSize: 12 }}
            >
              Models
            </button>

            {/* External funding wallet — RainbowKit ConnectButton (compact). */}
            <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />

            {/* Self-custodial agent wallet — create/unlock/fund/policy drawer. */}
            <button
              className="btn btn-gold"
              onClick={() => setDrawerOpen(true)}
              type="button"
            >
              {agentBtnLabel}
            </button>
          </nav>
        </div>
      </header>

      {children}

      {drawerOpen && <WalletDrawer onClose={() => setDrawerOpen(false)} />}

      {/* Key/model quick-panel overlay - additive, isolated from wallet drawer */}
      {keyPanelOpen && <KeyQuickPanel onClose={() => setKeyPanelOpen(false)} />}
    </>
  );
}
