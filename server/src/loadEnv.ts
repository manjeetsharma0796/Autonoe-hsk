// Side-effect module: load the repo-root .env.local BEFORE any other import runs.
// Bun only auto-loads .env from the launch cwd (server/), but the oracle signer
// key (DEPLOYER_PRIVATE_KEY / ORACLE_SIGNER_PRIVATE_KEY), provider keys, and an
// optional MANTLE_SEPOLIA_RPC override live in the repo-root .env.local. Importing
// this first (before app.ts → @autonoe/chain) guarantees the env is populated
// before modules that read it at evaluation time (e.g. the chain RPC_URL).
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url)); // server/src
for (const rel of ['../../.env.local', '../../.env', '../.env.local', '../.env']) {
  const path = resolve(here, rel);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || !m[1]) continue;
    const key = m[1];
    const val = (m[2] ?? '').trim().replace(/^["']|["']$/g, '');
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
