import { createHash } from 'crypto';

/**
 * Returns SHA-256 (hex) of the JSON-stringified webhook payload.
 */
export function hashPayload(input: unknown): unknown {
  const json = JSON.stringify(input);
  const hex = createHash('sha256').update(json, 'utf8').digest('hex');
  return { result: hex };
}
