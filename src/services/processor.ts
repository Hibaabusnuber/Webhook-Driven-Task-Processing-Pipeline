import type { ActionType } from '../models/pipeline';
import { hashPayload } from '../actions/hash';
import { jsonTransformPayload } from '../actions/jsonTransform';
import { keywordsPayload } from '../actions/keywords';
import { reversePayload } from '../actions/reverse';
import { timestampPayload } from '../actions/timestamp';
import { uppercasePayload } from '../actions/uppercase';
import { logger } from '../logger';

/**
 * Runs the pipeline action on the webhook payload. All actions are pure over JSON-like data.
 */
export function processPayload(actionType: ActionType, payload: unknown): unknown {
  logger.debug('processPayload', { actionType });
  switch (actionType) {
    case 'uppercase':
      return uppercasePayload(payload);
    case 'reverse':
      return reversePayload(payload);
    case 'timestamp':
      return timestampPayload(payload);
    case 'keywords':
      return keywordsPayload(payload);
    case 'hash':
      return hashPayload(payload);
    case 'json_transform':
      return jsonTransformPayload(payload);
    default: {
      const _exhaustive: never = actionType;
      throw new Error(`Unknown action type: ${_exhaustive}`);
    }
  }
}
