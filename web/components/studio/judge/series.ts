// Pure, dependency-free deterministic series generator for the outcomes chart.
// No Math.random, no Date - fully reproducible from `seed`.

export type SeriesPoint = { t: number; v: number };

export type OptionSeries = {
  id: string;
  label: string;
  color: string;
  points: SeriesPoint[];
};

const BARS = 48;

const COLORS = ["var(--green)", "var(--red)", "var(--blue, #5b8def)"];

/** mulberry32 - deterministic 32-bit PRNG returning floats in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build a baseline (dashed grey) + one drifting series per option. */
export function buildSeries(
  seed: number,
  optionRefs: string[],
  predictedPcts: number[],
): { baseline: SeriesPoint[]; options: OptionSeries[]; bars: number } {
  const rand = mulberry32(seed);

  // Baseline oscillates gently near 0.
  const basePhase = rand() * Math.PI * 2;
  const baseline: SeriesPoint[] = [];
  for (let t = 0; t < BARS; t++) {
    const v = Math.sin(basePhase + (t / BARS) * Math.PI * 4) * 0.6;
    baseline.push({ t, v: round(v) });
  }

  const options: OptionSeries[] = optionRefs.map((id, i) => {
    const target = predictedPcts[i] ?? 0;
    const phase = rand() * Math.PI * 2;
    const freq = 3 + rand() * 3; // seed-varied wave count
    const amp = Math.abs(target) * (0.18 + rand() * 0.22) + 0.4; // seed-varied amplitude
    const points: SeriesPoint[] = [];
    for (let t = 0; t < BARS; t++) {
      const progress = t / (BARS - 1); // 0..1 drift toward target
      const wave = Math.sin(phase + progress * Math.PI * freq) * amp;
      const drift = target * easeInOut(progress);
      points.push({ t, v: round(drift + wave) });
    }
    return {
      id,
      label: id,
      color: COLORS[i % COLORS.length],
      points,
    };
  });

  return { baseline, options, bars: BARS };
}

function easeInOut(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
