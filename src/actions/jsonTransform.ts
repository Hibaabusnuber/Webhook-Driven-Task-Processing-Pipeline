/**
 * Recursively uppercases object keys and string values; numbers and booleans unchanged.
 * Arrays are walked element-wise; nested objects recurse.
 */
function transformValue(val: unknown): unknown {
  if (val === null || typeof val === 'number' || typeof val === 'boolean') {
    return val;
  }
  if (typeof val === 'string') {
    return val.toUpperCase();
  }
  if (Array.isArray(val)) {
    return val.map((item) => transformValue(item));
  }
  if (typeof val === 'object' && val !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      out[k.toUpperCase()] = transformValue(v);
    }
    return out;
  }
  return val;
}

export function jsonTransformPayload(input: unknown): unknown {
  if (input !== null && typeof input === 'object' && !Array.isArray(input)) {
    return transformValue(input) as Record<string, unknown>;
  }
  return input;
}
