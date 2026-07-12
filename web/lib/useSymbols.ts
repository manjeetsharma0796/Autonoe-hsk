"use client";

import { useEffect, useState } from "react";
import { getSymbols, type TokenInfo } from "./api";

export type { TokenInfo };

export interface UseSymbolsResult {
  tokens: TokenInfo[];
  loading: boolean;
  error: string | null;
}

/**
 * Fetches the live symbol list from GET /api/symbols once on mount.
 * Returns up to `limit` tokens sorted by 24h volume desc.
 */
export function useSymbols(limit = 80): UseSymbolsResult {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getSymbols(undefined, limit)
      .then((data) => {
        if (!cancelled) {
          setTokens(data);
          setLoading(false);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [limit]);

  return { tokens, loading, error };
}
