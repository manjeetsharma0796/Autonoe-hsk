import { test, expect } from 'bun:test';
import { AI_ROLES, PROVIDER_IDS, SUBAGENT_ROLES, ASSET_SYMBOLS, API } from './index.js';

test('every subagent role is a known AI role', () => {
  for (const r of SUBAGENT_ROLES) expect(AI_ROLES).toContain(r);
});

test('provider ids are the five free providers', () => {
  expect([...PROVIDER_IDS].sort()).toEqual(
    ['gemini', 'groq', 'mistral', 'nvidia', 'openrouter'].sort(),
  );
});

test('settlement asset list is WHSK + the synthetic markets', () => {
  expect([...ASSET_SYMBOLS]).toEqual(['WHSK', 'BTC', 'ETH', 'SUI', 'SOL']);
});

test('API route map exposes all endpoints', () => {
  expect(Object.keys(API)).toHaveLength(12);
  expect(API.thesisHuman).toBe('/api/thesis/human');
  expect(API.leaderboard).toBe('/api/leaderboard');
});
