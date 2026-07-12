"use client";

/**
 * ProviderCard - legacy per-provider card, now superseded by the compact
 * ProviderKeyPanel in /settings and KeyQuickPanel. Kept for any external
 * callers; re-exports from the new implementation so there is a single source
 * of truth for provider key handling.
 *
 * If nothing imports this file it is safe to delete.
 */

import type { ProviderInfo, ModelInfo, ProviderId } from "@autonoe/shared";

// Unused - kept to avoid breaking any stale import that hasn't been updated.
export interface ProviderCardProps {
  provider: ProviderInfo;
  onModelsLoaded: (providerId: ProviderId, models: ModelInfo[]) => void;
}

/** @deprecated Use ProviderKeyPanel from @/components/keys instead. */
export function ProviderCard(_props: ProviderCardProps) {
  return null;
}
