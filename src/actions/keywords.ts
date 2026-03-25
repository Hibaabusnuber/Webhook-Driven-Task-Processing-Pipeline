/**
 * Extracts keyword tokens from `msg` (or a top-level string): lowercase, split on whitespace,
 * drop common English stop words and empties.
 */
const STOP_WORDS = new Set([
  'the',
  'is',
  'a',
  'and',
  'of',
  'to',
  'in',
  'for',
  'are',
]);

export function keywordsPayload(input: unknown): unknown {
  let text = '';
  if (input !== null && typeof input === 'object' && !Array.isArray(input)) {
    const msg = (input as { msg?: unknown }).msg;
    if (typeof msg === 'string') {
      text = msg;
    }
  } else if (typeof input === 'string') {
    text = input;
  }

  const words = text
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w));

  return words;
}
