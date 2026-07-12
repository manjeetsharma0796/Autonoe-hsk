// T-206 - the debate panel. Supporter argues for the thesis, Discriminator
// argues against, Judge synthesizes both into refined, risk-graded options.
// Each role runs on its own configured model and contributes a reasoning trace.

import { z } from 'zod';
import type { DebateResult, DebateTurn, ReasoningTrace, Thesis } from '@autonoe/shared';
import { humanizeDeep, stripMarkdown } from '@autonoe/shared';
import { defaultResolver, type ChatModelLike, type ModelResolver } from '../models.ts';

// Tolerant schema: some providers validate tool-call args server-side and reject
// when a model emits a quoted number or an off-enum risk ("High"), which dead-ends
// the verdict. Accept loose shapes here and coerce/clamp in code (normalizeRefined).
const LooseNum = z
  .union([z.number(), z.string()])
  .describe('a number (emit a plain number, not a quoted string)');

const JudgeOut = z.object({
  judgeSummary: z.string(),
  refinedOptions: z
    .array(
      z.object({
        optionRef: z.string().describe('id of the thesis option, e.g. opt-1'),
        predictedOutputPct: LooseNum.describe('predicted % outcome (a number)'),
        risk: z.string().describe('risk tier: one of low, medium, high'),
        caveats: z.array(z.string()),
        confidence: LooseNum.describe('confidence from 0 to 1 (a number)'),
      }),
    )
    .min(1),
});
type RawJudgeOut = z.infer<typeof JudgeOut>;

type Risk = 'low' | 'medium' | 'high';

function toNum(v: number | string, fallback: number): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  const n = parseFloat(String(v).replace(/[^0-9.eE+-]/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

function normRisk(v: unknown): Risk {
  const s = String(v ?? '').toLowerCase();
  if (s.includes('low')) return 'low';
  if (s.includes('high')) return 'high';
  return 'medium';
}

/** Coerce one loose refined option into the strict RefinedOption shape. */
function normalizeRefined(o: RawJudgeOut['refinedOptions'][number]) {
  return {
    optionRef: o.optionRef,
    predictedOutputPct: toNum(o.predictedOutputPct, 0),
    risk: normRisk(o.risk),
    caveats: o.caveats,
    confidence: Math.min(1, Math.max(0, toNum(o.confidence, 0.5))),
  };
}

// Appended to every debater/judge prompt: keep their output as plain prose so the
// studio panels never render literal markdown markers.
const NO_MD =
  'Write PLAIN PROSE only. Do NOT use any markdown formatting - no ** bold, no ## headers, no backticks, no bullet lists.';

function asText(r: { content: unknown }): string {
  const c = r.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map((x) => (typeof x === 'string' ? x : ((x as { text?: string }).text ?? ''))).join('');
  return String(c ?? '');
}

function summarize(intent: string, options: Thesis['options']): string {
  const opts = options
    .map((o) => `${o.id}: ${o.direction} ${o.asset} ${o.sizeMUSD} mUSD (risk ${o.risk}) - ${o.rationale}`)
    .join('\n');
  return `INTENT: ${intent}\n\nOPTIONS:\n${opts}`;
}

export async function runDebate(
  thesis: Thesis,
  resolve: ModelResolver = defaultResolver,
  rounds = 4,
): Promise<DebateResult> {
  // How many Supporter<->Discriminator rebuttal exchanges to run, on top of the
  // openings. Coerce to an integer and clamp to a sane range.
  const exchanges = Math.min(6, Math.max(1, Math.trunc(Number(rounds)) || 1));

  const brief = summarize(thesis.intent, thesis.options);

  const supporter = resolve('supporter', { temperature: 0.6 });
  const discriminator = resolve('discriminator', { temperature: 0.6 });
  const judge = resolve('judge', { temperature: 0.3 });

  // ── Phase 1: opening statements, generated in parallel (independent) ──
  const [supOpening, disOpening] = await Promise.all([
    supporter
      .invoke(
        `You are the SUPPORTER on a trading tribunal. Open with the strongest evidence-based bull ` +
          `case for this thesis. Cite concrete numbers (price, RSI, %). 3-4 sentences. ${NO_MD}\n\n${brief}`,
      )
      .then(asText)
      .then(stripMarkdown),
    discriminator
      .invoke(
        `You are the DISCRIMINATOR (devil's advocate). Open with the bear case: liquidity, drawdown, ` +
          `regime risk, every way this loses. Cite concrete numbers. 3-4 sentences. ${NO_MD}\n\n${brief}`,
      )
      .then(asText)
      .then(stripMarkdown),
  ]);

  const turns: DebateTurn[] = [
    { role: 'supporter', kind: 'opening', text: supOpening },
    { role: 'discriminator', kind: 'opening', text: disOpening },
  ];

  // ── Phase 2: turn-taking rebuttals — each answers the opponent's MOST RECENT
  // turn, so the loop must be serial. `rounds` exchanges, each = 1 discriminator
  // rebuttal followed by 1 supporter rebuttal. We track each side's latest text
  // plus a short running transcript the prompts can reference. ──
  const supRebuttals: string[] = [];
  const disRebuttals: string[] = [];
  let supLast = supOpening; // supporter's most recent turn
  let disLast = disOpening; // discriminator's most recent turn

  for (let i = 0; i < exchanges; i++) {
    const recap = turns.map((t) => `${t.role.toUpperCase()} (${t.kind}): ${t.text}`).join('\n');

    // a. Discriminator rebuts the Supporter's most recent turn.
    const disRebuttal = await discriminator
      .invoke(
        `You are the DISCRIMINATOR, exchange ${i + 1} of ${exchanges}. The Supporter's latest point was:\n\n` +
          `"${supLast}"\n\nRebut it directly: name the specific claim or number you are attacking, then ` +
          `dismantle it. Do NOT repeat any earlier point you have made. 2-3 sentences. ${NO_MD}\n\n` +
          `For reference:\n${brief}\n\nDebate so far:\n${recap}`,
      )
      .then(asText)
      .then(stripMarkdown);
    turns.push({
      role: 'discriminator',
      kind: 'rebuttal',
      text: disRebuttal,
      repliesTo: "the Supporter's latest point",
    });
    disRebuttals.push(disRebuttal);
    disLast = disRebuttal;

    // b. Supporter rebuts the Discriminator's most recent turn.
    const supRebuttal = await supporter
      .invoke(
        `You are the SUPPORTER, exchange ${i + 1} of ${exchanges}. The Discriminator's latest attack was:\n\n` +
          `"${disLast}"\n\nDefend the trade head-on: answer their specific point directly. Do NOT repeat any ` +
          `earlier point you have made. 2-3 sentences. ${NO_MD}\n\n` +
          `For reference:\n${brief}\n\nDebate so far:\n${turns.map((t) => `${t.role.toUpperCase()} (${t.kind}): ${t.text}`).join('\n')}`,
      )
      .then(asText)
      .then(stripMarkdown);
    turns.push({
      role: 'supporter',
      kind: 'rebuttal',
      text: supRebuttal,
      repliesTo: "the Discriminator's latest attack",
    });
    supRebuttals.push(supRebuttal);
    supLast = supRebuttal;
  }

  // ── Phase 3: the judge reads the full transcript, then rules ──
  const transcript = turns.map((t) => `${t.role.toUpperCase()} (${t.kind}): ${t.text}`).join('\n\n');
  const judged = await judge
    .withStructuredOutput<RawJudgeOut>(JudgeOut, { name: 'verdict' })
    .invoke(
      `You are the JUDGE on a trading tribunal. Read the full debate, weigh both sides, then issue ` +
        `refined options referencing the thesis option ids. Give a predicted % outcome, risk, ` +
        `caveats, and a 0-1 confidence per option. ${NO_MD}\n\n${brief}\n\nDEBATE:\n${transcript}`,
    );
  const judgeSummary = stripMarkdown(judged.judgeSummary);

  const supporterArgument = [supOpening, ...supRebuttals].join('\n\n');
  const discriminatorArgument = [disOpening, ...disRebuttals].join('\n\n');

  const traces: ReasoningTrace[] = [
    {
      role: 'supporter',
      summary: 'Bull case',
      steps: [
        { label: 'Opening', detail: supOpening },
        ...supRebuttals.map((detail, i) => ({ label: `Rebuttal ${i + 1}`, detail })),
      ],
    },
    {
      role: 'discriminator',
      summary: 'Bear case',
      steps: [
        { label: 'Opening', detail: disOpening },
        ...disRebuttals.map((detail, i) => ({ label: `Rebuttal ${i + 1}`, detail })),
      ],
    },
    { role: 'judge', summary: 'Synthesis', steps: [{ label: 'Verdict', detail: judgeSummary }] },
  ];

  return humanizeDeep({
    thesisId: thesis.id,
    supporterArgument,
    discriminatorArgument,
    judgeSummary,
    refinedOptions: judged.refinedOptions.map(normalizeRefined),
    turns,
    traces,
  });
}
