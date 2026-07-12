#!/usr/bin/env bun
// Builds a Markdown "tally" of commits + tasks touched in a time window, for the
// Telegram leaderboard post. Run: bun scripts/leaderboard.ts "24 hours ago" "Session leaderboard"

import { execSync } from 'node:child_process';

const since = process.argv[2] ?? '24 hours ago';
const title = process.argv[3] ?? 'Leaderboard';

let log = '';
try {
  log = execSync(`git log --since="${since}" --pretty=format:%an%x09%s`, {
    encoding: 'utf8',
  });
} catch {
  log = '';
}

const rows = log.split('\n').filter(Boolean);

interface Tally {
  commits: number;
  tasks: Set<string>;
  done: number;
}
const byAuthor = new Map<string, Tally>();

for (const row of rows) {
  const [author = 'unknown', subject = ''] = row.split('\t');
  const t = byAuthor.get(author) ?? { commits: 0, tasks: new Set<string>(), done: 0 };
  t.commits++;
  const m = subject.match(/\bT-(\d+)\b/);
  if (m) t.tasks.add(m[1]!);
  if (/^(done|T-\d+:.*\bdone\b)/i.test(subject) || /\bdone:/i.test(subject)) t.done++;
  byAuthor.set(author, t);
}

const ranked = [...byAuthor.entries()].sort((a, b) => b[1].commits - a[1].commits);

let out = `*${title}* (since ${since})\n`;
if (ranked.length === 0) {
  out += '_No commits in this window._';
} else {
  for (const [author, t] of ranked) {
    out += `\n• *${author}* — ${t.commits} commit${t.commits === 1 ? '' : 's'}, ${t.tasks.size} task${t.tasks.size === 1 ? '' : 's'} touched`;
  }
}

console.log(out);
