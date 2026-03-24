/**
 * Recursively reverses string values in nested JSON (non-strings unchanged).
 */
export function reversePayload(input: unknown): unknown {
  if (input === null || input === undefined) {
    return input;
  }
  if (typeof input === 'string') {
    return input.split('').reverse().join('');
  }
  if (Array.isArray(input)) {
    return input.map((item) => reversePayload(item));
  }
  if (typeof input === 'object' && input !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = reversePayload(v);
    }
    return out;
  }
  return input;
}
