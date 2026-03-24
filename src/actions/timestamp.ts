/**
 * Adds an ISO-8601 `_processedAt` field at the root without mutating nested structures unsafely.
 * If input is not a plain object, wraps as { value, _processedAt }.
 */
export function timestampPayload(input: unknown): unknown {
  const at = new Date().toISOString();
  if (input !== null && typeof input === 'object' && !Array.isArray(input)) {
    return {
      ...(input as Record<string, unknown>),
      _processedAt: at,
    };
  }
  return { value: input, _processedAt: at };
}
