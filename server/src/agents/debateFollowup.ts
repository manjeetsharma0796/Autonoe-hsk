// Post-debate "Ask the X" follow-up. After the tribunal has finished debating a
// trade, the user can press one of the three debaters with a follow-up question.
// Unlike the generic assistant, this replies IN CHARACTER (no briefing format, no
// "send it to the tribunal" — the debate already happened) and can call get_ticker
// for fresh live numbers. Each role answers on its own configured model.

import { humanize, stripMarkdown } from '@autonoe/shared';
import { defaultResolver, type ModelResolver } from '../models.ts';
import { tickerTool } from './assistant.ts';

export type DebaterRole = 'supporter' | 'discriminator' | 'judge';

export interface AskDebaterInput {
  role: DebaterRole;
  question: string;
  intent: string;
  supporterArgument: string;
  discriminatorArgument: string;
  judgeSummary: string;
}

// In-character persona per role. No markdown section headers, no bold-label
// briefing format, and explicitly NOT telling the user to send it to the tribunal.
const PERSONA: Record<DebaterRole, string> = {
  supporter:
    'You are the SUPPORTER from a trading tribunal that just finished debating this trade. ' +
    'You argued FOR it. Answer the user in your own voice: defend and extend your bull case, ' +
    'concede a point only if fair.',
  discriminator:
    "You are the DISCRIMINATOR (devil's advocate) from the tribunal. You argued AGAINST the trade. " +
    'Press your bear case honestly and directly.',
  judge:
    'You are the JUDGE from the tribunal. You weighed both sides and ruled. ' +
    'Stay balanced, decisive, and concrete.',
};

const STYLE = [
  'Speak conversationally in the first person, 2 to 4 sentences, plain prose.',
  'Do NOT use "##" markdown headers, do NOT dump bullet lists unless it is genuinely natural.',
  'Write plain prose with NO markdown formatting (no **, no ##, no backticks, no bullet lists).',
  'Do NOT tell the user to send this to the tribunal or run a thesis/verdict: the debate already happened.',
  'HARD RULE: never output the em dash or en dash character. Use commas, colons, or a hyphen (-) instead.',
].join(' ');

// Only the (non-streamed) probe step is told about the tool, so a model that
// renders tool calls as raw text can never leak that text into the user's reply.
const TOOL_HINT =
  'You have a `get_ticker` tool. ONLY if the question needs the CURRENT price, 24h change, or volume, ' +
  'call get_ticker with the bare symbol (e.g. "SOL", no USDT suffix). Otherwise do not call it.';

/** Strip any tool-call syntax a model may emit as plain text (some providers
 *  render calls inline as "<function=...>" instead of as structured tool_calls).
 *  Safety net so the user never sees that noise in a reply. */
function stripToolSyntax(s: string): string {
  return s
    .replace(/<function[^>]*>[\s\S]*?<\/function>/gi, ' ')
    .replace(/<\/?(?:function|tool_call|function_call|tool)[^>]*>/gi, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Build the role-specific grounding context: own argument vs the opposing side(s). */
function grounding(input: AskDebaterInput): string {
  const lines = [`THESIS INTENT: ${input.intent}`];
  if (input.role === 'supporter') {
    lines.push(`YOUR OWN ARGUMENT (bull case):\n${input.supporterArgument}`);
    lines.push(`OPPOSING ARGUMENT (bear case):\n${input.discriminatorArgument}`);
  } else if (input.role === 'discriminator') {
    lines.push(`YOUR OWN ARGUMENT (bear case):\n${input.discriminatorArgument}`);
    lines.push(`OPPOSING ARGUMENT (bull case):\n${input.supporterArgument}`);
  } else {
    lines.push(`YOUR VERDICT:\n${input.judgeSummary}`);
    lines.push(`SUPPORTER ARGUMENT (bull case):\n${input.supporterArgument}`);
    lines.push(`DISCRIMINATOR ARGUMENT (bear case):\n${input.discriminatorArgument}`);
  }
  return lines.join('\n\n');
}

/**
 * Answer a post-debate follow-up question in the voice of the chosen debater.
 * Mirrors assistant.ts `chat()`: bind the ticker tool, run a small tool-calling
 * loop, then return (and optionally stream) the final humanized answer.
 */
export async function askDebater(
  input: AskDebaterInput,
  resolve: ModelResolver = defaultResolver,
  onToken?: (t: string) => void,
): Promise<string> {
  const persona = `${PERSONA[input.role]}\n\n${STYLE}\n\n${grounding(input)}`;
  const base = `${persona}\n\nUSER: ${input.question}`;
  const tag = `${input.role.toUpperCase()}:`;

  // ── Step 1: tool detection on a NON-streaming model ────────────────────────
  // Never streamed to the user, so a tool-call (which some models emit as raw
  // text) can't leak. Only STRUCTURED calls run; text-format "calls" are ignored.
  let liveData = '';
  try {
    const probe = resolve(input.role, { temperature: 0.3 });
    const probeModel =
      typeof (probe as unknown as { bindTools?: unknown }).bindTools === 'function'
        ? (probe as unknown as { bindTools: (t: unknown[]) => typeof probe }).bindTools([tickerTool])
        : probe;
    const r = await probeModel.invoke(`${base}\n\n${TOOL_HINT}`);
    const calls = Array.isArray((r as { tool_calls?: unknown[] }).tool_calls)
      ? ((r as { tool_calls: Array<{ name: string; args: Record<string, unknown> }> }).tool_calls)
      : [];
    const results: string[] = [];
    for (const call of calls) {
      if (call.name === 'get_ticker') {
        try {
          results.push(String(await tickerTool.invoke(call.args as { symbol: string })));
        } catch (e) {
          results.push(`(live price unavailable: ${(e as Error).message})`);
        }
      }
    }
    liveData = results.join('\n');
  } catch {
    // probe failed -> answer from the debate context only, no live data
  }

  // ── Step 2: stream the FINAL answer ────────────────────────────────────────
  // NO tools bound and NO tool mention, so this model cannot emit a tool call
  // (structured or text) into the reply. Live data, if any, is given inline.
  const finalModel = resolve(input.role, { temperature: 0.6, onToken });
  const finalPrompt = liveData
    ? `${base}\n\nLIVE MARKET DATA (just fetched, use it):\n${liveData}\n\n${tag}`
    : `${base}\n\n${tag}`;
  const res = await finalModel.invoke(finalPrompt);
  const content = typeof res.content === 'string' ? res.content : String(res.content ?? '');
  return humanize(stripToolSyntax(stripMarkdown(content)));
}
