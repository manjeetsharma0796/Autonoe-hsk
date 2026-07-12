"use client";

import { useState, useCallback } from "react";
// query state removed — search now lives inside MarketsTable
import type { TokenInfo } from "../../lib/api";
import { MarketStats } from "./MarketStats";
import { MoversStrip } from "./MoversStrip";
import { MarketsTable } from "./MarketsTable";

/**
 * Thin client shell that owns the shared query + tokens state so that:
 * - The search input in MarketStats controls the query fed to MarketsTable.
 * - The live token list fetched by MarketsTable flows up to MarketStats (stats band)
 *   and MoversStrip (gainers/losers).
 */
export function MarketsShell() {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);

  const handleTokensLoaded = useCallback((t: TokenInfo[]) => {
    setTokens(t);
  }, []);

  return (
    <>
      <MarketStats tokens={tokens} />
      <MoversStrip tokens={tokens} />
      <MarketsTable onTokensLoaded={handleTokensLoaded} />
    </>
  );
}
