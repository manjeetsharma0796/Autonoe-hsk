import { test, expect } from 'bun:test';

process.env.AUTONOE_DB = ':memory:';
process.env.AUTONOE_SECRET = 'test-secret';

const { generateThesis, structureHumanThesis } = await import('../src/agents/thesis.ts');
const { runDebate } = await import('../src/agents/debate.ts');
const { chat } = await import('../src/agents/assistant.ts');
import type { Fetcher } from '../src/market/bybit.ts';

const thesisCore = {
  suggestedPair: 'WHSK',
  reasoning: 'WHSK momentum is constructive on real candles.',
  options: [
    { direction: 'long', asset: 'WHSK', sizeMUSD: 100, rationale: 'breakout', predictedReturnPct: { low: 5, high: 10 }, risk: 'medium' },
    { direction: 'hedge', asset: 'BTC', sizeMUSD: 50, rationale: 'cover', predictedReturnPct: { low: -2, high: 4 }, risk: 'low' },
  ],
};
const judgeOut = {
  judgeSummary: 'Option A is the stronger risk-adjusted play.',
  refinedOptions: [
    { optionRef: 'opt-1', predictedOutputPct: 8, risk: 'medium', caveats: ['thin depth'], confidence: 0.72 },
  ],
};

// Fake fetcher → fixture candles/ticker so the real tools run without network.
const fakeFetch: Fetcher = async (url) => ({
  ok: true,
  status: 200,
  json: async () =>
    url.includes('kline')
      ? { result: { list: Array.from({ length: 30 }, (_, i) => [String(29 - i), '100', '110', '90', String(100 + (29 - i)), '5', '0']) } }
      : { result: { list: [{ lastPrice: '1.2843', price24hPcnt: '0.0421', volume24h: '1000' }] } },
});

// Fake resolver: thesis model calls get_indicators once (tool loop), then stops;
// structured finalize returns the fixture core. Judge returns judgeOut.
const fakeResolve = (role: string) => {
  let calls = 0;
  return {
    bindTools: () => ({
      invoke: async () => {
        calls++;
        return calls === 1
          ? { content: '', tool_calls: [{ name: 'get_indicators', args: { asset: 'WHSK' }, id: 't1' }] }
          : { content: 'done', tool_calls: [] };
      },
    }),
    invoke: async () => ({ content: `argument from ${role}` }),
    withStructuredOutput: <T,>() => ({ invoke: async (): Promise<T> => (role === 'judge' ? judgeOut : thesisCore) as T }),
  };
};

test('generateThesis runs tools, records traces, returns a structured thesis', async () => {
  const thesis = await generateThesis(
    { intent: 'long the dip on WHSK' },
    { resolve: fakeResolve as never, fetcher: fakeFetch },
  );
  expect(thesis.source).toBe('ai');
  expect(thesis.options).toHaveLength(2);
  expect(thesis.options[0]!.id).toBe('opt-1');
  expect(thesis.suggestedPair).toBe('WHSK');
  expect(thesis.traces?.some((t) => t.role === 'subagent.indicators')).toBe(true);
  expect(thesis.activeSources).toContain('subagent.indicators');
  expect(thesis.id).toMatch(/[0-9a-f-]{36}/);
});

test('structureHumanThesis marks source human with no subagents', async () => {
  const thesis = await structureHumanThesis(
    { intent: 'my idea', body: 'long WHSK into the incentive news', suggestedPair: 'WHSK' },
    fakeResolve as never,
  );
  expect(thesis.source).toBe('human');
  expect(thesis.activeSources).toHaveLength(0);
  expect(thesis.options.length).toBeGreaterThanOrEqual(2);
});

test('runDebate returns three traces and judge refined options', async () => {
  const thesis = await generateThesis({ intent: 'x' }, { resolve: fakeResolve as never, fetcher: fakeFetch });
  const result = await runDebate(thesis, fakeResolve as never);
  expect(result.thesisId).toBe(thesis.id);
  expect(result.supporterArgument).toContain('supporter');
  expect(result.discriminatorArgument).toContain('discriminator');
  expect(result.refinedOptions).toHaveLength(1);
  expect(result.refinedOptions[0]!.optionRef).toBe('opt-1');
  expect(result.traces?.map((t) => t.role)).toEqual(['supporter', 'discriminator', 'judge']);
});

test('assistant chat returns an assistant message', async () => {
  const reply = await chat({ messages: [{ role: 'user', content: 'hi' }] }, fakeResolve as never);
  expect(reply.role).toBe('assistant');
  expect(reply.content).toContain('assistant');
});
