// Conversational "Chat" mode for the studio. Unlike assistant.ts `chat()` (which
// forces a trade-scoping briefing format and nudges the user to the tribunal),
// this holds a NORMAL back-and-forth conversation: it answers what is asked, in
// plain prose, like a knowledgeable friend. It runs on the `assistant`-role model,
// reuses the shared get_ticker tool, and can render ```chart```/```heatmap```
// blocks when a few numbers genuinely benefit from a visual.
//
// History is stored server-side in InMemoryChatMessageHistory instances keyed by
// sessionId, so the client only sends the new user message per turn.

import type { ChatMessage } from '@autonoe/shared';
import { humanize } from '@autonoe/shared';
import { SystemMessage, HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { InMemoryChatMessageHistory } from '@langchain/core/chat_history';
import { defaultResolver, type ModelResolver } from '../models.ts';
import { tickerTool } from './assistant.ts';

const SYSTEM = [
  'You are Autonoe, a friendly and sharp crypto trading copilot. Assets trade vs',
  'the mUSD stablecoin on HashKey Chain: WMNT, BTC, ETH, SUI, SOL.',
  '',
  'You hold a NORMAL conversation. Answer exactly what the user asks, conversationally,',
  'in plain prose, like a knowledgeable friend would. Let the user lead.',
  '',
  'Use the `get_ticker` tool whenever the user asks about the price, 24h change, or',
  'volume of ANY token. Call it with the bare ticker symbol (e.g. "BTC", "WMNT",',
  '"PEPE") - do not append USDT yourself.',
  '',
  'When the user asks to "see", "show", or "chart" an asset, the UI automatically',
  'embeds a live TradingView chart for them - you do NOT need to output a chart block',
  'or a URL. Just acknowledge the chart is shown and add any relevant commentary.',
  '',
  'You MAY render visuals ONLY when they genuinely help. Do not force them. Options:',
  '- A few numbers (returns, risk, momentum): a fenced chart block, for example',
  '  ```chart',
  '  {"type":"bar","title":"4h momentum","unit":"%","data":[{"label":"WMNT","value":4.2},{"label":"BTC","value":-1.1}]}',
  '  ```',
  '- A correlation or risk matrix: a fenced heatmap block, for example',
  '  ```heatmap',
  '  {"title":"30d correlation","x":["BTC","ETH"],"y":["BTC","ETH"],"values":[[1,0.82],[0.82,1]]}',
  '  ```',
  '- Net inflow/outflow data: a fenced flow block, for example',
  '  ```flow',
  '  {"title":"7d inflow vs outflow","unit":"M","data":[{"label":"Mon","inflow":12,"outflow":8},{"label":"Tue","inflow":5,"outflow":14}]}',
  '  ```',
  '- A compact TradingView mini chart for a single asset: a fenced tv-mini block, for example',
  '  ```tv-mini',
  '  {"symbol":"BTC"}',
  '  ```',
  '- A side-by-side multi-asset comparison: a fenced tv-overview block, for example',
  '  ```tv-overview',
  '  {"symbols":["BTC","ETH","SOL"]}',
  '  ```',
  '- A broad crypto market heatmap: a fenced tv-market block (no args needed)',
  '  ```tv-market',
  '  {}',
  '  ```',
  '- A live crypto screener table: a fenced tv-screener block (no args needed)',
  '  ```tv-screener',
  '  {}',
  '  ```',
  '  Keep static charts to 6 points or fewer. Only use a visual when it adds clarity.',
  '',
  'Do NOT force "## Section" headers onto every reply. Do NOT end with a canned',
  'call-to-action and do NOT tell the user to send anything to the tribunal. Just be',
  'helpful and natural.',
  '',
  'Keep replies reasonably tight: a short paragraph or two, not an essay.',
  '',
  'HARD RULE: never output the em dash or en dash character. Use commas, colons, or a',
  'hyphen (-) instead. This is non-negotiable.',
].join('\n');

// ── Session store ──────────────────────────────────────────────────────────────
// InMemoryChatMessageHistory from @langchain/core stores the raw BaseMessage list
// per session. The Map lives for the lifetime of the server process — good enough
// for a dev/demo session. Swap the Map for Redis/DB for production persistence.

const sessions = new Map<string, InMemoryChatMessageHistory>();

function getSession(sessionId: string): InMemoryChatMessageHistory {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, new InMemoryChatMessageHistory());
  }
  return sessions.get(sessionId)!;
}

export function clearSession(sessionId: string): void {
  sessions.delete(sessionId);
}

// ── Suggestion generator ───────────────────────────────────────────────────────

async function generateSuggestions(
  content: string,
  stored: (SystemMessage | HumanMessage | AIMessage | ToolMessage)[],
  resolve: ModelResolver,
): Promise<string[]> {
  try {
    const model = resolve('assistant', { temperature: 0.4 });
    const ctx = stored
      .slice(-6)
      .map((m) => {
        const t = m.getType();
        const c = typeof m.content === 'string' ? m.content.slice(0, 200) : '';
        return `${t}: ${c}`;
      })
      .join('\n');
    const res = await (model as unknown as { invoke: (msgs: unknown[]) => Promise<{ content: unknown }> }).invoke([
      new SystemMessage(
        `Generate 3 short follow-up suggestions for a crypto trading AI chat (max 8 words each).
Be specific. When an asset was discussed, mix chart actions with analysis questions:
- Chart actions: "Show [SYMBOL] mini chart", "Compare [SYMBOL] vs [OTHER] overview", "Open crypto market overview", "Show [SYMBOL] screener"
- Analysis: "What is the key support level?", "Show 7d momentum vs BTC"
Return ONLY a valid JSON array of exactly 3 strings. No explanation, no markdown.`,
      ),
      new HumanMessage(
        `Recent conversation:\n${ctx}\n\nLast AI reply:\n${content.slice(0, 500)}\n\nJSON array of 3 suggestions:`,
      ),
    ]);
    const text = typeof res.content === 'string' ? res.content : '';
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]) as unknown[];
    return parsed.filter((s): s is string => typeof s === 'string').slice(0, 3);
  } catch {
    return [];
  }
}

// ── Chat ───────────────────────────────────────────────────────────────────────

/**
 * Hold a normal conversation keyed by `sessionId`.
 * The client sends only the new user message; the server loads full history
 * from InMemoryChatMessageHistory, runs the tool loop, appends both the user
 * message and the assistant reply, then streams/returns the final answer.
 */
export async function chatConversational(
  { sessionId, message }: { sessionId: string; message: string },
  resolve: ModelResolver = defaultResolver,
  onToken?: (t: string) => void,
): Promise<{ content: string; suggestions: string[] }> {
  const history = getSession(sessionId);

  // Load stored history and append the new user message.
  await history.addMessage(new HumanMessage(message));
  const stored = await history.getMessages();

  // Build the full message list: system prompt + everything stored so far.
  const lcMessages: (SystemMessage | HumanMessage | AIMessage | ToolMessage)[] = [
    new SystemMessage(SYSTEM),
    ...stored,
  ];

  const baseModel = resolve('assistant', { temperature: 0.7, onToken });
  const model = typeof (baseModel as unknown as { bindTools?: unknown }).bindTools === 'function'
    ? (baseModel as unknown as { bindTools: (t: unknown[]) => typeof baseModel }).bindTools([tickerTool])
    : baseModel;

  let res = await model.invoke(lcMessages);

  // Tool loop: append AIMessage + ToolMessages, re-invoke until no more tool calls.
  let steps = 0;
  while (Array.isArray(res.tool_calls) && res.tool_calls.length > 0 && steps < 5) {
    steps += 1;
    const aiMsg = new AIMessage({ content: res.content as string, tool_calls: res.tool_calls });
    lcMessages.push(aiMsg);
    // Tool messages are intermediate — don't save them to long-term history.
    for (const call of res.tool_calls as Array<{ name: string; args: Record<string, unknown>; id?: string }>) {
      let out = '';
      if (call.name === 'get_ticker') {
        try {
          out = String(await tickerTool.invoke(call.args as { symbol: string }));
        } catch (e) {
          out = `Error fetching price: ${(e as Error).message}`;
        }
      }
      lcMessages.push(new ToolMessage({ content: out, tool_call_id: call.id ?? call.name, name: call.name }));
    }
    const finalModel = resolve('assistant', { temperature: 0.7, onToken });
    res = await finalModel.invoke(lcMessages);
  }

  const content = humanize(
    typeof res.content === 'string' ? res.content : String(res.content ?? ''),
  );

  // Persist the assistant reply so the next turn sees the full conversation.
  await history.addMessage(new AIMessage(content));

  // Generate follow-up suggestions in parallel with the return (non-streaming, fast).
  const suggestions = await generateSuggestions(content, stored as (SystemMessage | HumanMessage | AIMessage | ToolMessage)[], resolve);

  return { content, suggestions };
}
