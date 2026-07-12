// Express app - implements the REST contract in @autonoe/shared (PRD §12).
// History/leaderboard return empty until the chain lib (T-108) lands in T-207.

import express, { type Request, type Response, type NextFunction } from 'express';
import { API, type ProviderId, type RoleModelMap } from '@autonoe/shared';
import { listProviders, listModels } from './providers.ts';
import { setProviderKey, recordTrade, listTrades, type TradeMeta } from './store.ts';
import { getRoleMap, setRoleMap } from './roles.ts';
import { generateThesis, structureHumanThesis } from './agents/thesis.ts';
import { runDebate } from './agents/debate.ts';
import { chat } from './agents/assistant.ts';
import { chatConversational, clearSession } from './agents/chatAgent.ts';
import { askDebater, type DebaterRole } from './agents/debateFollowup.ts';
import { extractIntake } from './agents/extract.ts';
import { signPrice } from './oracle.ts';
import { getHistory, getLeaderboard, invalidateHistoryCache, isOnChain } from './history.ts';
import { makeModel, type ChatModelLike, type ModelResolver } from './models.ts';
import { resolveRole } from './roles.ts';
import { sse } from './stream.ts';

/** A model resolver that streams every generated token to `emit`. */
function streamingResolver(emit: (token: string) => void): ModelResolver {
  return (role, opts) =>
    makeModel(resolveRole(role), { ...opts, onToken: emit }) as unknown as ChatModelLike;
}
import { getCandlesFor } from './candles.ts';
import { getSymbols } from './market/symbols.ts';

type Handler = (req: Request, res: Response) => Promise<void> | void;
const wrap = (h: Handler) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(h(req, res)).catch(next);

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Verbose request log: method, path, status, duration.
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      const code = res.statusCode;
      const mark = code >= 500 ? '✗' : code >= 400 ? '!' : '✓';
      console.log(`${mark} ${req.method} ${req.originalUrl} → ${code} ${ms}ms`);
    });
    next();
  });

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.get(API.providers, (_req, res) => res.json(listProviders()));

  app.post(
    API.keys,
    wrap((req, res) => {
      const { provider, apiKey } = req.body ?? {};
      if (!provider || !apiKey) throw httpError(400, 'provider and apiKey required');
      setProviderKey(provider as ProviderId, String(apiKey));
      res.json({ ok: true });
    }),
  );

  app.get(
    API.models,
    wrap(async (req, res) => {
      const provider = req.query.provider as ProviderId | undefined;
      if (!provider) throw httpError(400, 'provider query param required');
      res.json(await listModels(provider));
    }),
  );

  app.get(API.roles, (_req, res) => res.json(getRoleMap()));
  app.put(
    API.roles,
    wrap((req, res) => {
      // Merge the (possibly partial) body into the current map so saving one role
      // never clobbers the others. Backward-compatible with full-map senders.
      const body = req.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw httpError(400, 'role map object required');
      }
      for (const [role, choice] of Object.entries(body as Record<string, unknown>)) {
        const c = choice as { provider?: unknown; model?: unknown } | null;
        if (!c || typeof c !== 'object' || typeof c.provider !== 'string' || typeof c.model !== 'string') {
          throw httpError(400, `role "${role}" must have string provider and model`);
        }
      }
      const merged = { ...getRoleMap(), ...(body as Partial<RoleModelMap>) } as RoleModelMap;
      setRoleMap(merged);
      res.json(getRoleMap());
    }),
  );

  app.post(
    API.thesis,
    wrap(async (req, res) => {
      const { intent, activeSources } = req.body ?? {};
      if (!intent) throw httpError(400, 'intent required');
      res.json(await generateThesis({ intent: String(intent), activeSources }));
    }),
  );

  app.post(
    API.thesisHuman,
    wrap(async (req, res) => {
      const { intent, body, suggestedPair } = req.body ?? {};
      if (!intent || !body || !suggestedPair) throw httpError(400, 'intent, body, suggestedPair required');
      res.json(await structureHumanThesis({ intent, body, suggestedPair }));
    }),
  );

  app.post(
    API.debate,
    wrap(async (req, res) => {
      const { thesis, rounds } = req.body ?? {};
      if (!thesis?.id) throw httpError(400, 'thesis required');
      const debateRounds =
        rounds == null ? undefined : Math.min(6, Math.max(1, Math.trunc(Number(rounds)) || 1));
      res.json(await runDebate(thesis, undefined, debateRounds));
    }),
  );

  app.post(
    API.assistant,
    wrap(async (req, res) => {
      const { messages, context } = req.body ?? {};
      if (!Array.isArray(messages)) throw httpError(400, 'messages[] required');
      res.json(await chat({ messages, context }));
    }),
  );

  // Step-1 intake: LLM-extract trade-scoping fields from a free-form answer.
  app.post(
    API.intakeExtract,
    wrap(async (req, res) => {
      const { message } = req.body ?? {};
      if (typeof message !== 'string' || !message.trim()) throw httpError(400, 'message required');
      res.json(await extractIntake(message));
    }),
  );

  // ── Streaming (SSE) variants - stream `thinking`/`token` deltas, then `result` ──

  app.post(
    '/api/assistant/stream',
    wrap(async (req, res) => {
      const { messages, context } = req.body ?? {};
      if (!Array.isArray(messages)) throw httpError(400, 'messages[] required');
      const ch = sse(res);
      const resolver = streamingResolver((t) => ch.send('token', { delta: t }));
      try {
        const reply = await chat({ messages, context }, resolver);
        ch.send('result', reply);
        ch.send('done', {});
      } catch (e) {
        ch.send('error', { error: (e as Error).message });
      }
      ch.end();
    }),
  );

  // Conversational "Chat" mode (studio). Normal back-and-forth on the assistant
  // model. History is stored server-side keyed by sessionId; client sends only
  // the new user message each turn.
  app.post(
    '/api/chat/stream',
    wrap(async (req, res) => {
      const { sessionId, message } = req.body ?? {};
      if (!sessionId || typeof sessionId !== 'string') throw httpError(400, 'sessionId required');
      if (!message || typeof message !== 'string') throw httpError(400, 'message required');
      const ch = sse(res);
      const resolver = streamingResolver((t) => ch.send('token', { delta: t }));
      try {
        const { content, suggestions } = await chatConversational({ sessionId, message }, resolver);
        ch.send('result', { role: 'assistant', content });
        ch.send('suggestions', { suggestions });
        ch.send('done', {});
      } catch (e) {
        ch.send('error', { error: (e as Error).message });
      }
      ch.end();
    }),
  );

  // Clear a chat session's history (e.g. when user clicks "New chat").
  app.delete(
    '/api/chat/session/:id',
    wrap((req, res) => {
      clearSession(req.params.id ?? '');
      res.json({ ok: true });
    }),
  );

  app.post(
    '/api/thesis/stream',
    wrap(async (req, res) => {
      const { intent, activeSources } = req.body ?? {};
      if (!intent) throw httpError(400, 'intent required');
      const ch = sse(res);
      const resolver = streamingResolver((t) => ch.send('thinking', { delta: t }));
      try {
        const thesis = await generateThesis({ intent: String(intent), activeSources }, { resolve: resolver });
        ch.send('result', thesis);
        ch.send('done', {});
      } catch (e) {
        ch.send('error', { error: (e as Error).message });
      }
      ch.end();
    }),
  );

  app.post(
    '/api/debate/stream',
    wrap(async (req, res) => {
      const { thesis, rounds } = req.body ?? {};
      if (!thesis?.id) throw httpError(400, 'thesis required');
      const debateRounds =
        rounds == null ? undefined : Math.min(6, Math.max(1, Math.trunc(Number(rounds)) || 1));
      const ch = sse(res);
      const resolver = streamingResolver((t) => ch.send('thinking', { delta: t }));
      try {
        const result = await runDebate(thesis, resolver, debateRounds);
        ch.send('result', result);
        ch.send('done', {});
      } catch (e) {
        ch.send('error', { error: (e as Error).message });
      }
      ch.end();
    }),
  );

  // Post-debate "Ask the X" follow-up: in-character, tool-enabled, streamed reply
  // from one of the three debaters. Path is hardcoded (not in @autonoe/shared).
  app.post(
    '/api/debate/ask',
    wrap(async (req, res) => {
      const { role, question, intent, supporterArgument, discriminatorArgument, judgeSummary } =
        req.body ?? {};
      if (role !== 'supporter' && role !== 'discriminator' && role !== 'judge') {
        throw httpError(400, 'role must be supporter, discriminator, or judge');
      }
      if (typeof question !== 'string' || !question.trim()) {
        throw httpError(400, 'question required');
      }
      const ch = sse(res);
      const resolver = streamingResolver((t) => ch.send('token', { delta: t }));
      try {
        // The streaming resolver already emits `token` per generated token (it bakes
        // its own onToken into the model), so no explicit onToken arg is needed here —
        // same pattern as the other /stream handlers.
        const content = await askDebater(
          {
            role: role as DebaterRole,
            question,
            intent: String(intent ?? ''),
            supporterArgument: String(supporterArgument ?? ''),
            discriminatorArgument: String(discriminatorArgument ?? ''),
            judgeSummary: String(judgeSummary ?? ''),
          },
          resolver,
        );
        ch.send('result', { role: 'assistant', content });
        ch.send('done', {});
      } catch (e) {
        ch.send('error', { error: (e as Error).message });
      }
      ch.end();
    }),
  );

  // Signed-pull price oracle (T-210): live price + signature for SyntheticExchange.
  app.get(
    '/api/price/sign',
    wrap(async (req, res) => {
      const symbol = req.query.symbol;
      if (!symbol || typeof symbol !== 'string') throw httpError(400, 'symbol query param required');
      res.json(await signPrice(symbol));
    }),
  );

  // Dynamic symbol list from Bybit spot tickers.
  app.get(
    API.symbols,
    wrap(async (req, res) => {
      const q = typeof req.query.q === 'string' ? req.query.q : '';
      const rawLimit = parseInt(String(req.query.limit ?? '80'), 10);
      const limit = Math.min(isNaN(rawLimit) ? 80 : rawLimit, 500);
      res.json(await getSymbols(q, limit));
    }),
  );

  // T-415: OHLCV candles for the prediction chart.
  app.get(
    '/api/candles',
    wrap(async (req, res) => {
      const symbol = req.query.symbol;
      if (!symbol || typeof symbol !== 'string') throw httpError(400, 'symbol query param required');
      const interval = typeof req.query.interval === 'string' ? req.query.interval : '60';
      const rawLimit = parseInt(String(req.query.limit ?? '100'), 10);
      const limit = Math.min(isNaN(rawLimit) ? 100 : rawLimit, 200);
      res.json(await getCandlesFor(symbol, interval, limit));
    }),
  );

  // T-207: backed by on-chain DecisionLog + off-chain TradeMeta store.
  app.get(API.history, wrap(async (_req, res) => { res.json(await getHistory()); }));
  app.get(API.leaderboard, wrap(async (_req, res) => { res.json(await getLeaderboard()); }));

  // Off-chain trade metadata, posted by the client after a successful on-chain
  // execution. Joined onto the on-chain DecisionLog by thesisHash so History /
  // leaderboard can show source, model attribution and the tx explorer link.
  app.post(
    '/api/trades',
    wrap((req, res) => {
      const b = (req.body ?? {}) as Record<string, unknown>;
      if (typeof b.thesisId !== 'string' || typeof b.thesisHash !== 'string') {
        throw httpError(400, 'thesisId and thesisHash required');
      }
      const meta: TradeMeta = {
        thesisId: b.thesisId,
        thesisHash: b.thesisHash as `0x${string}`,
        source: b.source === 'human' ? 'human' : 'ai',
        judged: Boolean(b.judged),
        chosenOptionRef: typeof b.chosenOptionRef === 'string' ? b.chosenOptionRef : '',
        modelsUsed:
          b.modelsUsed && typeof b.modelsUsed === 'object'
            ? (b.modelsUsed as TradeMeta['modelsUsed'])
            : {},
        asset: typeof b.asset === 'string' ? b.asset : '',
        txHash: typeof b.txHash === 'string' ? (b.txHash as `0x${string}`) : null,
        commitment: b.commitment ?? null,
        createdAt: typeof b.createdAt === 'string' ? b.createdAt : new Date().toISOString(),
      };
      recordTrade(meta);
      invalidateHistoryCache(); // surface the new trade on History without the TTL wait
      res.json({ ok: true });
    }),
  );

  // Commit-reveal: reveal the commitment for a trade tx so the client can
  // recompute keccak256(payload) and confirm it matches the on-chain thesisHash.
  app.get(
    '/api/verify',
    wrap(async (req, res) => {
      const tx = typeof req.query.tx === 'string' ? req.query.tx.toLowerCase() : '';
      if (!tx) throw httpError(400, 'tx query param required');
      const meta = listTrades().find((t) => (t.txHash ?? '').toLowerCase() === tx);
      if (!meta) {
        res.json({ onChainHash: null, onChain: false, commitment: null });
        return;
      }
      const onChain = await isOnChain(meta.thesisHash);
      res.json({ onChainHash: meta.thesisHash, onChain, commitment: meta.commitment ?? null });
    }),
  );

  // error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = (err as { status?: number }).status ?? 500;
    const message = (err as Error).message ?? 'internal error';
    if (status >= 500) console.error(err);
    res.status(status).json({ error: message });
  });

  return app;
}

function httpError(status: number, message: string): Error {
  return Object.assign(new Error(message), { status });
}
