// Shared number formatters for the trading UI.
// `formatPrice` keeps sub-cent prices readable: instead of "3.31e-10" it renders
// the leading-zero run as a unicode subscript — "0.0₉331" (DexScreener style).

const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";

/** Render a non-negative integer using unicode subscript digits. */
function toSubscript(n: number): string {
  return String(n)
    .split("")
    .map((d) => SUBSCRIPTS[Number(d)] ?? d)
    .join("");
}

/**
 * Format a USD price to a readable plain string.
 *  - >= 1000 → grouped, max 2 decimals ("64,210.51")
 *  - >= 1    → 2–4 decimals ("1.2843", "64.21")
 *  - >= 0.001 → up to 4 significant figures, trimmed ("0.04231")
 *  - < 0.001 → subscript-zero form ("0.000000000331" → "0.0₉331")
 */
export function formatPrice(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0.00";

  const sign = n < 0 ? "-" : "";
  const x = Math.abs(n);

  if (x >= 1_000) return sign + x.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (x >= 1) {
    return sign + x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }
  if (x >= 0.001) return sign + String(parseFloat(x.toPrecision(4)));

  // x < 0.001 → compact subscript-zero form.
  // toExponential(2) yields 3 significant figures, e.g. "3.31e-10".
  const [mant, expPart] = x.toExponential(2).split("e");
  const exp = Number(expPart); // negative
  const zeroCount = -exp - 1; // zeros between the decimal point and the first sig digit
  const sig = mant.replace(".", "").replace(/0+$/, "") || "0";
  return `${sign}0.0${toSubscript(zeroCount)}${sig}`;
}
