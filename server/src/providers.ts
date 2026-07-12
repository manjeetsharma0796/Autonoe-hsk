// T-202 - provider registry (ported from the "Mono" pattern). All five providers
// are OpenAI-compatible for chat, so the agent layer talks to one shape.

import type { ProviderId } from '@autonoe/shared';
import type { ModelInfo, ProviderInfo } from '@autonoe/shared';
import { getProviderKey, hasProviderKey } from './store.ts';

interface ProviderDef {
  label: string;
  base: string;
  modelsPath: string;
  keysUrl: string;
  note: string;
}

export const PROVIDERS: Record<ProviderId, ProviderDef> = {
  groq: {
    label: 'Groq',
    base: 'https://api.groq.com/openai/v1',
    modelsPath: '/models',
    keysUrl: 'https://console.groq.com/keys',
    note: 'Ultra-fast inference. Generous free tier.',
  },
  mistral: {
    label: 'Mistral',
    base: 'https://api.mistral.ai/v1',
    modelsPath: '/models',
    keysUrl: 'https://console.mistral.ai/api-keys',
    note: 'Open-weight EU models. Free tier on La Plateforme.',
  },
  nvidia: {
    label: 'NVIDIA',
    base: 'https://integrate.api.nvidia.com/v1',
    modelsPath: '/models',
    keysUrl: 'https://build.nvidia.com',
    note: 'NIM-hosted models. Free credits to start.',
  },
  openrouter: {
    label: 'OpenRouter',
    base: 'https://openrouter.ai/api/v1',
    modelsPath: '/models',
    keysUrl: 'https://openrouter.ai/keys',
    note: 'Aggregator. Many models tagged :free.',
  },
  gemini: {
    label: 'Gemini',
    base: 'https://generativelanguage.googleapis.com/v1beta/openai',
    modelsPath: '/models',
    keysUrl: 'https://aistudio.google.com/apikey',
    note: 'Google. Multimodal, huge context. Free tier in AI Studio.',
  },
};

/** Base URL for a provider (used by the LangChain model factory). */
export function baseUrl(provider: ProviderId): string {
  return PROVIDERS[provider].base;
}

export function listProviders(): ProviderInfo[] {
  return (Object.keys(PROVIDERS) as ProviderId[]).map((id) => ({
    id,
    label: PROVIDERS[id].label,
    keysUrl: PROVIDERS[id].keysUrl,
    note: PROVIDERS[id].note,
    hasKey: hasProviderKey(id),
  }));
}

/** Fetch and normalize the model list for a provider (requires a stored key). */
export async function listModels(provider: ProviderId): Promise<ModelInfo[]> {
  const key = getProviderKey(provider);
  if (!key) throw Object.assign(new Error('no api key for provider'), { status: 400 });
  const def = PROVIDERS[provider];
  const res = await fetch(def.base + def.modelsPath, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    throw Object.assign(new Error(`provider ${provider} models: ${res.status}`), { status: 502 });
  }
  const json = (await res.json()) as { data?: unknown[]; models?: unknown[] };
  const rows = json.data ?? json.models ?? [];
  // Dedupe by id: some providers (e.g. Mistral) return the same model id more
  // than once, which would produce duplicate React keys downstream.
  const seen = new Set<string>();
  const models: ModelInfo[] = [];
  for (const row of rows) {
    const info = normalizeModel(provider, row as Record<string, unknown>);
    if (!info.id || seen.has(info.id)) continue;
    seen.add(info.id);
    models.push(info);
  }
  return models;
}

function normalizeModel(provider: ProviderId, m: Record<string, unknown>): ModelInfo {
  const id = String(m.id ?? (m.name as string) ?? '').replace(/^models\//, '');
  const info: ModelInfo = {
    id,
    label: String(m.name ?? id),
    contextWindow: null,
    maxOutput: null,
    vision: null,
    tools: null,
    free: null,
  };
  if (provider === 'groq') {
    info.contextWindow = (m.context_window as number) ?? null;
    info.maxOutput = (m.max_completion_tokens as number) ?? null;
  } else if (provider === 'openrouter') {
    info.contextWindow = (m.context_length as number) ?? null;
    info.free = id.endsWith(':free');
  }
  return info;
}
