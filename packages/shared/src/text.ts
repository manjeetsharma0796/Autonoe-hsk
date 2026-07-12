// Sanitizes machine-written punctuation tells out of model output. Right now
// that means normalizing the dash family (figure / en / em / horizontal-bar /
// unicode-minus) to a plain ASCII hyphen, so AI text doesn't read as obviously
// generated. Applied at the model boundary (streamed tokens + final results).

const DASHES = /[‒–—―−]/g;

/** Replace em/en/figure dashes (and the unicode minus) with a plain hyphen. */
export function humanize(s: string): string {
  return s.replace(DASHES, "-");
}

/**
 * Convert markdown to clean plain text for user-facing output. Defensive: each
 * transform is independent so malformed markup degrades gracefully.
 *
 * - **bold** / *italic* / __x__ / _x_  -> inner text (markers removed). Word-internal
 *   underscores (e.g. "gpt_oss") are preserved.
 * - inline `code` and ```fenced``` blocks -> inner text (backticks/fence + lang tag dropped).
 * - leading heading (#..######), blockquote (>), and list markers (-, *, +, 1.) at the
 *   START of a line -> marker removed, text kept.
 * - leftover stray * or # removed; runs of spaces/tabs collapsed; newlines/paragraphs
 *   preserved; result trimmed.
 */
export function stripMarkdown(s: string): string {
  if (typeof s !== 'string') return s;
  let out = s;

  // Fenced code blocks: drop the ``` fences and an optional language tag on the
  // opening fence, keeping the inner body. Tolerate an unterminated final fence.
  out = out.replace(/```[^\n`]*\n?([\s\S]*?)```/g, '$1');
  out = out.replace(/```[^\n`]*\n?/g, ''); // stray opening fence with no close

  // Inline code: `code` -> code (drop the backticks).
  out = out.replace(/`([^`]+)`/g, '$1');

  // Bold/italic with asterisks: **x** / *x* -> x. Bold first so the leftover
  // single-asterisk pass doesn't eat half a ** pair.
  out = out.replace(/\*\*([^*]+)\*\*/g, '$1');
  out = out.replace(/\*([^*\n]+)\*/g, '$1');

  // Bold/italic with underscores, but ONLY when the markers hug the text and sit
  // at a word boundary, so identifiers like gpt_oss / foo_bar_baz are untouched.
  out = out.replace(/(^|[^\w])__(?=\S)([^_]+?)(?<=\S)__(?=[^\w]|$)/g, '$1$2');
  out = out.replace(/(^|[^\w])_(?=\S)([^_\n]+?)(?<=\S)_(?=[^\w]|$)/g, '$1$2');

  // Per-line leading markers: heading #.., blockquote >, list -/*/+ or 1. .
  out = out
    .split('\n')
    .map((line) =>
      line.replace(/^[ \t]*(?:#{1,6}\s+|>\s?|(?:[-*+]|\d+\.)\s+)/, ''),
    )
    .join('\n');

  // Sweep up any leftover stray markdown markers.
  out = out.replace(/[*#]/g, '');

  // Collapse runs of spaces/tabs to a single space (newlines preserved).
  out = out.replace(/[ \t]{2,}/g, ' ');
  // Tidy trailing spaces left on individual lines after marker removal.
  out = out.replace(/[ \t]+(\n|$)/g, '$1');

  return out.trim();
}

/** Recursively run `humanize` over every string in a value (arrays/objects),
 *  leaving numbers, booleans, null, etc. untouched. */
export function humanizeDeep<T>(value: T): T {
  if (typeof value === "string") return humanize(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => humanizeDeep(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = humanizeDeep(v);
    }
    return out as T;
  }
  return value;
}
