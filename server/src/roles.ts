// T-203 - role → model configuration. Each AI role can run on a different
// provider/model; users override these defaults in Settings.

import { AI_ROLES, type AIRole, type ModelChoice, type RoleModelMap } from '@autonoe/shared';
import { getRoles, setRoles } from './store.ts';

// Default: free/fast Groq Llama models everywhere. Users remap per role in the UI.
const DEFAULT_CHOICE: ModelChoice = { provider: 'groq', model: 'llama-3.3-70b-versatile' };

export function defaultRoles(): RoleModelMap {
  return Object.fromEntries(AI_ROLES.map((r) => [r, { ...DEFAULT_CHOICE }])) as RoleModelMap;
}

/** Persisted map merged over defaults (so new roles always resolve). */
export function getRoleMap(): RoleModelMap {
  const stored = getRoles();
  return { ...defaultRoles(), ...(stored ?? {}) };
}

export function setRoleMap(map: RoleModelMap): void {
  setRoles(map);
}

export function resolveRole(role: AIRole): ModelChoice {
  return getRoleMap()[role];
}
