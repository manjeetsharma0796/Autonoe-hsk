// T-205 - the thesis agent. A real tool-calling loop: the model decides which
// market/indicator/on-chain tools to call based on the user's intent, then a
// structured finalize call turns the gathered evidence into a risk-tiered thesis.
// Tools actually used become the reasoning traces ("Show thinking").

import { z } from 'zod';
import { SystemMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';
import { SUBAGENT_ROLES, humanizeDeep, type AIRole, type Thesis, type ThesisOption } from '@autonoe/shared';
import { defaultResolver, type ModelResolver } from '../models.ts';
import { resolveRole } from '../roles.ts';
import { makeRecorder, makeTools } from './tools.ts';
import type { Fetcher } from '../market/bybit.ts';

// Tolerant schema. Many providers (e.g. Groq) validate the model's tool-call
// arguments against this JSON schema SERVER-SIDE and hard-reject the call when a
// model emits "100" (string) for a number or "High" for an enum - which dead-ends
// the whole flow and is the flaky "tool call validation failed" error. So we
// accept the loose shapes here and coerce/clamp to strict types in code
// (normalizeOption). Descriptions still tell the model the intended type/values.
const LooseNum = z
  .union([z.number(), z.string()])
  .describe('a number (emit a plain number, not a quoted string)');

const Option = z.object({
  direction: z.string().describe('one of: long, short, hedge, hold'),
  asset: z.string().describe('one of: WMNT, BTC, ETH, SUI, SOL'),
  sizeMUSD: LooseNum.describe('position size in mUSD (a number)'),
  rationale: z.string(),
  predictedReturnPct: z.object({ low: LooseNum, high: LooseNum }),
  risk: z.string().describe('risk tier: one of low, medium, high'),
});

const ThesisCore = z.object({
  suggestedPair: z.string().describe('one of: WMNT, BTC, ETH, SUI, SOL'),
  reasoning: z.string().describe('overall reasoning grounded in the tool evidence, 2-4 sentences'),
  // min(1) (not 2): some providers hard-REJECT the tool call when the model
  // returns a single option ("/options: minimum 2 items"), which would dead-end
  // the whole flow. We accept >=1 here and guarantee >=2 in code (ensureTwoOptions).
  options: z.array(Option).min(1).max(4),
});
type RawThesisCore = z.infer<typeof ThesisCore>;

// ── normalization: loose model output → strict ThesisOption fields ─────────────

const ASSETS = ['WMNT', 'BTC', 'ETH', 'SUI', 'SOL'] as const;
type Asset = (typeof ASSETS)[number];
const DIRECTIONS = ['long', 'short', 'hedge', 'hold'] as const;
type Direction = (typeof DIRECTIONS)[number];
type Risk = 'low' | 'medium' | 'high';

interface NormOption {
  direction: Direction;
  asset: Asset;
  sizeMUSD: number;
  rationale: string;
  predictedReturnPct: { low: number; high: number };
  risk: Risk;
}

function toNum(v: number | string, fallback: number): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  const n = parseFloat(String(v).replace(/[^0-9.eE+-]/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

function normAsset(v: unknown): Asset {
  const s = String(v ?? '').toUpperCase();
  return ASSETS.find((a) => s.includes(a)) ?? 'WMNT';
}

function normDirection(v: unknown): Direction {
  const s = String(v ?? '').toLowerCase();
  return DIRECTIONS.find((d) => s.includes(d)) ?? 'hold';
}

function normRisk(v: unknown): Risk {
  const s = String(v ?? '').toLowerCase();
  if (s.includes('low')) return 'low';
  if (s.includes('high')) return 'high';
  return 'medium';
}

function normalizeOption(o: RawThesisCore['options'][number]): NormOption {
  return {
    direction: normDirection(o.direction),
    asset: normAsset(o.asset),
    sizeMUSD: Math.max(0, toNum(o.sizeMUSD, 0)),
    rationale: o.rationale,
    predictedReturnPct: {
      low: toNum(o.predictedReturnPct.low, 0),
      high: toNum(o.predictedReturnPct.high, 0),
    },
    risk: normRisk(o.risk),
  };
}

/** The panel and debate need a real choice. If the model returned a single
 *  option, synthesize a conservative half-size counterpart so the UI always
 *  has >=2 without ever failing the structured-output call. */
function ensureTwoOptions(options: NormOption[]): NormOption[] {
  if (options.length >= 2) return options;
  const [first] = options;
  if (!first) return options;
  const half = Math.max(1, Math.round(first.sizeMUSD / 2));
  return [
    first,
    {
      direction: first.direction,
      asset: first.asset,
      sizeMUSD: half,
      rationale: `Conservative half-size alternative: the same view on ${first.asset} at reduced exposure to cap drawdown while staying positioned.`,
      predictedReturnPct: {
        low: Math.round(first.predictedReturnPct.low / 2),
        high: Math.round(first.predictedReturnPct.high / 2),
      },
      risk: first.risk === 'high' ? 'medium' : 'low',
    },
  ];
}

const SYSTEM =
  'You are Autonoe, an autonomous crypto trading strategist on HashKey Chain. ' +
  'Assets tradable against the mUSD stablecoin: WMNT (real AMM), BTC, ETH, SUI, SOL (synthetics). ' +
  'Use the available tools to gather real price, candle, indicator and on-chain evidence for the ' +
  'assets relevant to the user intent before forming a view. Be specific and honest about risk. ' +
  'When you write reasoning or rationale prose, structure it with short bold labels and tag risk ' +
  'as (High), (Medium) or (Low) where useful, and use a plain ASCII arrow "->" for cause and effect. ' +
  'HARD RULE: never output the em dash or en dash character anywhere; use a hyphen (-) instead.';

const MAX_STEPS = 5;

function assemble(core: RawThesisCore, intent: string, source: 'ai' | 'human', used: AIRole[]): Thesis {
  const normalized = core.options.map(normalizeOption);
  const options: ThesisOption[] = ensureTwoOptions(normalized).map((o, i) => ({ id: `opt-${i + 1}`, ...o }));
  return {
    id: crypto.randomUUID(),
    intent,
    source,
    suggestedPair: normAsset(core.suggestedPair),
    activeSources: used,
    options,
    reasoning: core.reasoning,
    modelsUsed: { thesis: resolveRole('thesis') },
    createdAt: new Date().toISOString(),
  };
}

export interface ThesisOpts {
  resolve?: ModelResolver;
  /** Injected fetcher for the market tools (tests supply fixtures). */
  fetcher?: Fetcher;
}

export async function generateThesis(
  input: { intent: string; activeSources?: AIRole[] },
  opts: ThesisOpts = {},
): Promise<Thesis> {
  const resolve = opts.resolve ?? defaultResolver;
  const active = input.activeSources?.length ? input.activeSources : [...SUBAGENT_ROLES];
  const rec = makeRecorder();
  const { tools, byName } = makeTools(rec, active, opts.fetcher);

  const base = resolve('thesis', { temperature: 0.4 });
  const model = base.bindTools ? base.bindTools(tools) : base;

  const messages: unknown[] = [
    new SystemMessage(SYSTEM),
    new HumanMessage(
      `USER INTENT:\n${input.intent}\n\nCall the tools you need on the relevant assets, then stop.`,
    ),
  ];

  for (let step = 0; step < MAX_STEPS; step++) {
    const ai = await model.invoke(messages);
    messages.push(ai);
    const calls = ai.tool_calls ?? [];
    if (calls.length === 0) break;
    for (const c of calls) {
      const t = byName.get(c.name);
      let out: string;
      try {
        out = t ? String(await t.invoke(c.args)) : `unknown tool: ${c.name}`;
      } catch (e) {
        out = `tool ${c.name} failed: ${(e as Error).message}`;
      }
      messages.push(new ToolMessage({ content: out, tool_call_id: c.id ?? c.name, name: c.name }));
    }
  }

  const core = await base
    .withStructuredOutput<RawThesisCore>(ThesisCore, { name: 'thesis' })
    .invoke([
      ...messages,
      new HumanMessage(
        'Now output the final thesis as structured data, grounded strictly in the tool evidence above. ' +
          'Provide 2 to 4 DISTINCT risk-tiered options (vary the size, direction, or risk) so the user has a real choice. ' +
          'Types matter: sizeMUSD and predictedReturnPct.low/high must be plain numbers (not quoted strings); ' +
          'risk must be exactly "low", "medium", or "high"; asset one of WMNT, BTC, ETH, SUI, SOL.',
      ),
    ]);

  const traces = rec.traces();
  const used = [...new Set(traces.map((t) => t.role))];
  const thesis = assemble(core, input.intent, 'ai', used.length ? used : active);
  thesis.traces = traces;
  return humanizeDeep(thesis);
}

export async function structureHumanThesis(
  input: { intent: string; body: string; suggestedPair: Thesis['suggestedPair'] },
  resolve: ModelResolver = defaultResolver,
): Promise<Thesis> {
  const model = resolve('thesis', { temperature: 0.2 });
  const structured = model.withStructuredOutput<RawThesisCore>(ThesisCore, { name: 'thesis' });
  const prompt =
    `${SYSTEM}\n\nThe user has written their own thesis. Convert it faithfully into structured, ` +
    `risk-tiered options without inventing new directions.\n\nINTENT:\n${input.intent}\n\n` +
    `USER THESIS:\n${input.body}\n\nSuggested pair: ${input.suggestedPair}.`;
  const core = await structured.invoke(prompt);
  return humanizeDeep(assemble({ ...core, suggestedPair: input.suggestedPair }, input.intent, 'human', []));
}
