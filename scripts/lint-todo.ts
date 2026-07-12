#!/usr/bin/env bun
// Validates TODO.md structure so the claim/PR workflow can't silently rot.
// Run: bun scripts/lint-todo.ts   (CI-gated in .github/workflows/ci.yml)

import { readFileSync } from 'node:fs';

const FILE = 'TODO.md';
const md = readFileSync(FILE, 'utf8');
const lines = md.split('\n');

// Base status, optionally followed by " — <free-text note>".
const VALID_STATUS =
  /^(pending|in-progress @\S+ \d{4}-\d{2}-\d{2}|review|blocked — .+|done @\S+ \d{4}-\d{2}-\d{2})( —\s.*)?$/;

const errors: string[] = [];
const ids = new Map<string, number>();

interface Block {
  id: string;
  line: number;
  status?: string;
  hasAcceptance: boolean;
}
let current: Block | null = null;

const flush = (b: Block | null) => {
  if (!b) return;
  if (!b.status) errors.push(`T-${b.id} (line ${b.line}): missing "- Status:" line`);
  else if (!VALID_STATUS.test(b.status))
    errors.push(`T-${b.id} (line ${b.line}): invalid Status "${b.status}"`);
  if (!b.hasAcceptance)
    errors.push(`T-${b.id} (line ${b.line}): missing "- Acceptance:" line`);
};

lines.forEach((raw, i) => {
  const head = raw.match(/^###\s+T-(\d+)\b/);
  if (head) {
    flush(current);
    const id = head[1]!;
    if (ids.has(id)) errors.push(`Duplicate task id T-${id} (lines ${ids.get(id)! + 1} and ${i + 1})`);
    ids.set(id, i);
    current = { id, line: i + 1, hasAcceptance: false };
    return;
  }
  if (!current) return;
  const status = raw.match(/^-\s+Status:\s+(.+?)\s*$/);
  if (status) current.status = status[1];
  if (/^-\s+Acceptance:/.test(raw)) current.hasAcceptance = true;
});
flush(current);

if (errors.length) {
  console.error(`TODO.md lint FAILED (${errors.length} issue(s)):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`TODO.md lint OK (${ids.size} tasks).`);
