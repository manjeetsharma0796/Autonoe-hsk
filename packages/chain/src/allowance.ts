// Allowance helpers. HashKey's public RPC is load-balanced, so a read immediately
// after an approve tx can hit a node that hasn't seen it yet (read-after-write
// staleness). We approve max-uint (sticky) and poll until the allowance reflects.

export const MAX_UINT256 = (1n << 256n) - 1n;

/** Poll `read()` until it returns >= `amount`, defeating stale read-after-write. */
export async function waitForAllowance(
  read: () => Promise<bigint>,
  amount: bigint,
  tries = 15,
  delayMs = 1500,
): Promise<void> {
  for (let i = 0; i < tries; i++) {
    if ((await read()) >= amount) return;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error('allowance did not propagate in time');
}
