// Step-1 intake extraction. Reads a free-form answer (e.g. "buy 10 sol and make
// $100 profit") and pulls out only the trade-scoping fields the user clearly
// stated or strongly implied, mapping natural phrasing to canonical values so
// the intake never re-asks something already answered. Runs on the `thesis`-role
// model at low temperature with structured output.

import { z } from 'zod';
import type { IntakeFields } from '@autonoe/shared';
import { humanize } from '@autonoe/shared';
import { defaultResolver, type ModelResolver } from '../models.ts';

// Every field is optional and nullable: the model omits (or nulls) anything the
// user did not state. We strip blanks before returning.
const Extracted = z.object({
  goal: z
    .enum(['grow', 'hedge', 'scalp', 'swing'])
    .nullish()
    .describe('overall goal; buy/accumulate/long/grow-my-stack -> grow'),
  asset: z
    .string()
    .nullish()
    .describe('the ticker symbol in uppercase, e.g. SOL, BTC, ETH, WMNT, SUI'),
  capital: z
    .string()
    .nullish()
    .describe('position size exactly as the user expressed it, e.g. "10 SOL" or "$500"'),
  risk: z.enum(['low', 'med', 'high']).nullish().describe('risk appetite'),
  horizon: z
    .string()
    .nullish()
    .describe(
      'time horizon EXACTLY as the user stated it, e.g. "5 days", "intraday", "a couple weeks", "1 month". Keep their wording; do NOT round it to a bucket.',
    ),
  type: z
    .enum(['spot', 'convert', 'leverage'])
    .nullish()
    .describe('trade type; perp/margin/Nx -> leverage, swap -> convert'),
  target: z
    .string()
    .nullish()
    .describe('profit target as stated, e.g. "+$100" or "+10%"'),
  stop: z.enum(['tight', 'wide', 'none']).nullish().describe('stop-loss preference'),
});
type Extracted = z.infer<typeof Extracted>;

const SYSTEM =
  'You extract trade-scoping fields from a single free-form message a user typed ' +
  'while scoping a crypto trade (assets vs the mUSD stablecoin: WMNT, BTC, ETH, SUI, SOL). ' +
  'Set a field ONLY when the user clearly states or strongly implies it; otherwise leave it ' +
  'null. Do not guess or invent. Map natural phrasing to the canonical values:\n' +
  '- goal: one of grow, hedge, scalp, swing. buy / accumulate / "go long" / "grow my stack" -> grow.\n' +
  '- asset: the ticker symbol, uppercase (e.g. SOL, BTC, WMNT).\n' +
  '- capital: the position size exactly as written, e.g. "10 SOL" or "$500". Keep the unit the user used.\n' +
  '- risk: one of low, med, high. aggressive/degen/yolo -> high; conservative/safe -> low.\n' +
  '- horizon: the time horizon EXACTLY as stated, e.g. "5 days", "intraday", "a week", "1 month". Keep the user wording; do NOT round it to a bucket like "a few days".\n' +
  '- type: one of spot, convert, leverage. perp/margin/"5x" -> leverage; swap -> convert.\n' +
  '- target: the profit target as stated, e.g. "+$100" (from "make $100 profit") or "+10%".\n' +
  '- stop: one of tight, wide, none.\n' +
  'HARD RULE: never output the em dash or en dash character; use a hyphen (-) instead.';

/** Pull the trade-scoping fields the user stated out of a free-form intake answer.
 *  Only clearly-stated/strongly-implied fields are returned; the rest are omitted. */
export async function extractIntake(
  message: string,
  resolve: ModelResolver = defaultResolver,
): Promise<IntakeFields> {
  const model = resolve('thesis', { temperature: 0 });
  const raw = await model
    .withStructuredOutput<Extracted>(Extracted, { name: 'intake_fields' })
    .invoke(`${SYSTEM}\n\nUSER MESSAGE:\n${message}`);

  // Drop null/blank fields; humanize the free-text fields (capital, target,
  // horizon) since they echo user prose, and uppercase the asset ticker.
  const out: IntakeFields = {};
  if (raw.goal) out.goal = raw.goal;
  if (raw.asset) out.asset = humanize(String(raw.asset)).trim().toUpperCase();
  if (raw.capital) out.capital = humanize(String(raw.capital)).trim();
  if (raw.risk) out.risk = raw.risk;
  if (raw.horizon) out.horizon = humanize(String(raw.horizon)).trim();
  if (raw.type) out.type = raw.type;
  if (raw.target) out.target = humanize(String(raw.target)).trim();
  if (raw.stop) out.stop = raw.stop;
  return out;
}
