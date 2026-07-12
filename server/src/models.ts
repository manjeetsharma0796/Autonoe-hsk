// LangChain model factory. Every provider is OpenAI-compatible, so we build a
// ChatOpenAI pointed at the provider's base URL. `modelForRole` resolves the
// configured model + key for a given AI role - the single entry point the agents use.

import { ChatOpenAI } from '@langchain/openai';
import type { AIRole, ModelChoice } from '@autonoe/shared';
import { humanize } from '@autonoe/shared';
import { baseUrl } from './providers.ts';
import { getProviderKey } from './store.ts';
import { resolveRole } from './roles.ts';

export class MissingKeyError extends Error {
  status = 400;
  constructor(public provider: string) {
    super(`No API key set for provider "${provider}". Add one in Settings.`);
  }
}

export interface ModelOpts {
  temperature?: number;
  /** If set, the model streams and each generated text token is passed here. */
  onToken?: (token: string) => void;
}

/** Build a chat model for an explicit provider/model choice. */
export function makeModel(choice: ModelChoice, opts: ModelOpts = {}): ChatOpenAI {
  const apiKey = getProviderKey(choice.provider);
  if (!apiKey) throw new MissingKeyError(choice.provider);
  return new ChatOpenAI({
    model: choice.model,
    apiKey,
    temperature: opts.temperature ?? 0.4,
    streaming: Boolean(opts.onToken),
    configuration: { baseURL: baseUrl(choice.provider) },
    callbacks: opts.onToken
      ? [{ handleLLMNewToken: (token: string) => opts.onToken?.(humanize(token)) }]
      : undefined,
  });
}

/** Resolve the model assigned to a role (from the role→model map). */
export function modelForRole(role: AIRole, opts?: ModelOpts): ChatOpenAI {
  return makeModel(resolveRole(role), opts);
}

/**
 * Injectable resolver type - agents depend on this so tests can pass a fake.
 * The default implementation is `modelForRole`.
 */
export type ModelResolver = (role: AIRole, opts?: ModelOpts) => ChatModelLike;

/** A tool call requested by the model. */
export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  id?: string;
}

/** Minimal surface the agents rely on (satisfied by ChatOpenAI; fakeable in tests). */
export interface ChatModelLike {
  invoke(input: unknown): Promise<{ content: unknown; tool_calls?: ToolCall[] }>;
  withStructuredOutput<T>(schema: unknown, config?: unknown): { invoke(input: unknown): Promise<T> };
  bindTools?(tools: unknown[]): ChatModelLike;
}

export const defaultResolver: ModelResolver = (role, opts) =>
  modelForRole(role, opts) as unknown as ChatModelLike;
