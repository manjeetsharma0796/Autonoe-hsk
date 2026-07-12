'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  createAgentWallet,
  unlock as walletUnlock,
  isCreated as walletIsCreated,
  exportPrivateKey,
  exportKeystoreJSON,
  getAgentBalances,
  fundMUSD,
  getPolicy,
  setPolicy,
  executeOption,
  DEFAULT_POLICY,
  type SpendingPolicy,
  type AgentBalances,
  type ExecuteOptionInput,
  type ExecuteResult,
} from '@autonoe/wallet';
import { browserWalletStore } from '@/lib/walletStore';
import { recordTrade } from '@/lib/api';
import type { Commitment } from '@/lib/commitment';
import type { RoleModelMap } from '@autonoe/shared';

// ── Context types ─────────────────────────────────────────────────────────────

export interface ExecuteContext {
  /** keccak256 hash of the thesis identifier. */
  thesisHash: `0x${string}`;
  /** keccak256 hash for the verdict, or zero-hash for direct execution. */
  verdictHash: `0x${string}`;
  /**
   * Optional off-chain metadata. When present, a successful execution is
   * recorded so it appears on the History / leaderboard pages with model
   * attribution and a tx explorer link.
   */
  meta?: {
    thesisId: string;
    source: 'ai' | 'human';
    judged: boolean;
    modelsUsed?: Partial<RoleModelMap>;
    /** Commit-reveal payload hashed into thesisHash, stored for later verification. */
    commitment?: Commitment;
  };
}

export interface WalletContextValue {
  // State
  address: string | null;
  isCreated: boolean;
  isUnlocked: boolean;
  balances: AgentBalances | null;
  policy: SpendingPolicy;

  // Wallet lifecycle
  create: (passphrase: string) => Promise<void>;
  unlock: (passphrase: string) => Promise<void>;
  lock: () => void;

  // Balances
  refreshBalances: () => Promise<void>;

  // Policy
  savePolicy: (p: SpendingPolicy) => Promise<void>;

  // Export
  revealKey: (passphrase: string) => Promise<string>;
  downloadKeystore: () => Promise<void>;

  // Funding
  fundMusd: () => Promise<{ txHash: `0x${string}`; explorerUrl: string }>;

  // Execute
  execute: (
    opt: Omit<ExecuteOptionInput, 'privateKey' | 'policy' | 'thesisHash' | 'verdictHash'>,
    ctx: ExecuteContext,
  ) => Promise<ExecuteResult>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const WalletContext = createContext<WalletContextValue | null>(null);

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside <WalletProvider>');
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [balances, setBalances] = useState<AgentBalances | null>(null);
  const [policy, setLocalPolicy] = useState<SpendingPolicy>(DEFAULT_POLICY);

  // The private key lives only in this ref - never in state (avoids React
  // DevTools exposure) and never written to localStorage.
  const privateKeyRef = useRef<`0x${string}` | null>(null);

  // ── Init: check whether a wallet already exists and load policy ──────────────
  useEffect(() => {
    (async () => {
      if (typeof window === 'undefined') return;
      try {
        const [walletExists, storedPolicy] = await Promise.all([
          walletIsCreated(browserWalletStore),
          getPolicy(browserWalletStore),
        ]);
        setCreated(walletExists);
        setLocalPolicy(storedPolicy);

        // Restore address (public) from keystore without decrypting.
        if (walletExists) {
          const { loadKeystore } = await import('@autonoe/wallet');
          const ks = await loadKeystore(browserWalletStore);
          if (ks) setAddress(ks.address);
        }
      } catch {
        // Non-fatal - wallet may simply not exist yet.
      }
    })();
  }, []);

  // ── Balance refresh ──────────────────────────────────────────────────────────
  const refreshBalances = useCallback(async () => {
    if (!address) return;
    try {
      const b = await getAgentBalances(address as `0x${string}`);
      setBalances(b);
    } catch {
      // Best-effort - RPC may be unavailable.
    }
  }, [address]);

  // Auto-refresh when address becomes available or wallet is unlocked.
  useEffect(() => {
    if (address) {
      void refreshBalances();
    }
  }, [address, refreshBalances]);

  // ── Create ───────────────────────────────────────────────────────────────────
  const create = useCallback(async (passphrase: string) => {
    const result = await createAgentWallet(passphrase, browserWalletStore);
    setAddress(result.address);
    setCreated(true);
    // Immediately unlock so the user can proceed without typing passphrase again.
    const unlocked = await walletUnlock(passphrase, browserWalletStore);
    privateKeyRef.current = unlocked.privateKey;
    setIsUnlocked(true);
    void refreshBalances();
  }, [refreshBalances]);

  // ── Unlock ───────────────────────────────────────────────────────────────────
  const unlock = useCallback(async (passphrase: string) => {
    const result = await walletUnlock(passphrase, browserWalletStore);
    privateKeyRef.current = result.privateKey;
    setAddress(result.address);
    setIsUnlocked(true);
    void refreshBalances();
  }, [refreshBalances]);

  // ── Lock ─────────────────────────────────────────────────────────────────────
  const lock = useCallback(() => {
    privateKeyRef.current = null;
    setIsUnlocked(false);
    setBalances(null);
  }, []);

  // ── Policy ───────────────────────────────────────────────────────────────────
  const savePolicy = useCallback(async (p: SpendingPolicy) => {
    await setPolicy(browserWalletStore, p);
    setLocalPolicy(p);
  }, []);

  // ── Export ───────────────────────────────────────────────────────────────────
  const revealKey = useCallback(async (passphrase: string): Promise<string> => {
    return exportPrivateKey(passphrase, browserWalletStore);
  }, []);

  const downloadKeystore = useCallback(async () => {
    const json = await exportKeystoreJSON(browserWalletStore);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'autonoe-agent-keystore.json';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // ── Fund mUSD ────────────────────────────────────────────────────────────────
  const fundMusd = useCallback(async () => {
    if (!privateKeyRef.current) throw new Error('Wallet is locked - unlock first');
    const result = await fundMUSD(privateKeyRef.current);
    void refreshBalances();
    return result;
  }, [refreshBalances]);

  // ── Execute ──────────────────────────────────────────────────────────────────
  const execute = useCallback(
    async (
      opt: Omit<ExecuteOptionInput, 'privateKey' | 'policy' | 'thesisHash' | 'verdictHash'>,
      ctx: ExecuteContext,
    ): Promise<ExecuteResult> => {
      if (!privateKeyRef.current) throw new Error('Wallet is locked - unlock first');
      const result = await executeOption({
        ...opt,
        thesisHash: ctx.thesisHash,
        verdictHash: ctx.verdictHash,
        privateKey: privateKeyRef.current,
        policy,
      });
      void refreshBalances();

      // Persist off-chain metadata so the execution appears on History /
      // leaderboard. Best-effort: the trade is already committed on-chain, so a
      // logging failure must never surface as a trade error.
      if (ctx.meta) {
        void recordTrade({
          thesisId: ctx.meta.thesisId,
          thesisHash: ctx.thesisHash,
          source: ctx.meta.source,
          judged: ctx.meta.judged,
          chosenOptionRef: opt.optionRef,
          modelsUsed: ctx.meta.modelsUsed ?? {},
          asset: opt.asset,
          txHash: result.decision?.txHash ?? result.txHash,
          commitment: ctx.meta.commitment ?? null,
          createdAt: new Date().toISOString(),
        }).catch(() => {
          /* swallow — never fail a committed trade on a logging error */
        });
      }
      return result;
    },
    [policy, refreshBalances],
  );

  const value: WalletContextValue = {
    address,
    isCreated: created,
    isUnlocked,
    balances,
    policy,
    create,
    unlock,
    lock,
    refreshBalances,
    savePolicy,
    revealKey,
    downloadKeystore,
    fundMusd,
    execute,
  };

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}
