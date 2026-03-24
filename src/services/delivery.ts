import axios from 'axios';
import { DeliveryAttempt } from '../models/delivery_attempt';
import { logger } from '../logger';

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [1000, 2000, 4000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type DeliveryBody = {
  job_id: string;
  pipeline_id: string;
  result: unknown;
  status: 'success';
};

/**
 * POSTs the processed result to a subscriber URL with exponential backoff retries.
 * Each HTTP try is persisted as a delivery_attempts row (audit trail).
 */
export async function deliverWithRetries(
  jobId: string,
  subscriberId: string,
  url: string,
  body: DeliveryBody
): Promise<void> {
  let lastError: string | undefined;
  let lastCode: number | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await axios.post(url, body, {
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' },
        validateStatus: () => true,
      });
      lastCode = response.status;
      const ok = response.status >= 200 && response.status < 300;
      await DeliveryAttempt.create({
        job_id: jobId,
        subscriber_id: subscriberId,
        status: ok ? 'success' : 'failed',
        response_code: response.status,
        attempt_count: attempt,
        error_detail: ok ? null : `HTTP ${response.status}`,
      });
      if (ok) {
        logger.info('Delivery succeeded', { jobId, subscriberId, attempt });
        return;
      }
      lastError = `HTTP ${response.status}`;
      logger.warn('Delivery non-success status', {
        jobId,
        subscriberId,
        attempt,
        status: response.status,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = msg;
      lastCode = null;
      await DeliveryAttempt.create({
        job_id: jobId,
        subscriber_id: subscriberId,
        status: 'failed',
        response_code: null,
        attempt_count: attempt,
        error_detail: msg,
      });
      logger.warn('Delivery attempt failed', {
        jobId,
        subscriberId,
        attempt,
        error: msg,
      });
    }

    if (attempt < MAX_ATTEMPTS) {
      const delay = BACKOFF_MS[attempt - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
      await sleep(delay);
    }
  }

  logger.error('Delivery exhausted retries', {
    jobId,
    subscriberId,
    lastError,
    lastCode,
  });
}
