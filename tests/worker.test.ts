/**
 * Worker/action tests (PostgreSQL required).
 */
import http from 'http';
import { assertDatabaseConnection } from '../src/config/db';
import { sequelize, syncModels } from '../src/models';
import { Pipeline } from '../src/models/pipeline';
import { Subscriber } from '../src/models/subscriber';
import { Job } from '../src/models/job';
import { DeliveryAttempt } from '../src/models/delivery_attempt';
import { processQueueJob } from '../src/worker/worker';
import { hashPayload } from '../src/actions/hash';
import { jsonTransformPayload } from '../src/actions/jsonTransform';
import { keywordsPayload } from '../src/actions/keywords';
import { uppercasePayload } from '../src/actions/uppercase';
import { reversePayload } from '../src/actions/reverse';
import { timestampPayload } from '../src/actions/timestamp';
import { randomUUID } from 'crypto';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/pipeline';
}

async function truncateAppTables(): Promise<void> {
  await sequelize.query(
    'TRUNCATE TABLE delivery_attempts, jobs, subscribers, pipelines RESTART IDENTITY CASCADE;'
  );
}

describe('actions', () => {
  it('uppercase handles nested structures', () => {
    expect(
      uppercasePayload({ a: { b: 'x' }, c: ['y', 1, null] })
    ).toEqual({ a: { b: 'X' }, c: ['Y', 1, null] });
  });

  it('reverse handles nested strings', () => {
    expect(reversePayload({ s: 'ab' })).toEqual({ s: 'ba' });
  });

  it('timestamp adds root marker', () => {
    const out = timestampPayload({ x: 1 }) as { x: number; _processedAt: string };
    expect(out.x).toBe(1);
    expect(typeof out._processedAt).toBe('string');
  });

  it('keywords extracts tokens and drops stop words', () => {
    expect(
      keywordsPayload({
        msg: 'webhooks are powerful for async processing in distributed systems',
      })
    ).toEqual([
      'webhooks',
      'powerful',
      'async',
      'processing',
      'distributed',
      'systems',
    ]);
  });

  it('hash returns sha256 hex of stringified payload', () => {
    const payload = { a: 1, b: 'x' };
    const out = hashPayload(payload) as { result: string };
    expect(out.result).toMatch(/^[a-f0-9]{64}$/);
    expect(out.result).toBe((hashPayload(payload) as { result: string }).result);
  });

  it('json_transform uppercases keys and string values', () => {
    expect(jsonTransformPayload({ name: 'hiba', age: 22 })).toEqual({
      NAME: 'HIBA',
      AGE: 22,
    });
  });
});

describe('processQueueJob', () => {
  beforeAll(async () => {
    await assertDatabaseConnection();
    await syncModels();
  });

  beforeEach(async () => {
    await truncateAppTables();
  });

  it('marks job failed when queue message pipeline_id mismatches the job row', async () => {
    const pipeline = await Pipeline.create({
      name: 'P',
      source_id: 's1',
      action_type: 'uppercase',
    });
    const job = await Job.create({
      pipeline_id: pipeline.id,
      payload: { a: 1 },
      status: 'pending',
    });

    await processQueueJob({
      jobId: job.id,
      pipelineId: randomUUID(),
      payload: job.payload,
    });

    await job.reload();
    expect(job.status).toBe('failed');
    expect(job.error_message).toContain('does not match');
  });

  it('delivers to subscriber with retries on failure', async () => {
    let hits = 0;
    const server = http.createServer((_req, res) => {
      hits += 1;
      if (hits < 3) {
        res.statusCode = 503;
        res.end('no');
        return;
      }
      res.statusCode = 200;
      res.end('ok');
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      throw new Error('expected bound port');
    }
    const port = addr.port;
    const url = `http://127.0.0.1:${port}/notify`;

    const pipeline = await Pipeline.create({
      name: 'P',
      source_id: 's-deliver',
      action_type: 'reverse',
    });
    await Subscriber.create({
      pipeline_id: pipeline.id,
      url,
    });
    const job = await Job.create({
      pipeline_id: pipeline.id,
      payload: { t: 'ab' },
      status: 'pending',
    });

    await processQueueJob({
      jobId: job.id,
      pipelineId: pipeline.id,
      payload: job.payload,
    });

    await job.reload();
    expect(job.status).toBe('success');
    expect(job.result).toEqual({ t: 'ba' });
    expect(hits).toBe(3);

    const rows = await DeliveryAttempt.findAll({ where: { job_id: job.id } });
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows.some((r) => r.status === 'success')).toBe(true);

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }, 60000);

  it('does not deliver to soft-deleted subscribers', async () => {
    let hits = 0;
    const server = http.createServer((_req, res) => {
      hits += 1;
      res.statusCode = 200;
      res.end('ok');
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      throw new Error('expected bound port');
    }
    const url = `http://127.0.0.1:${addr.port}/x`;

    const pipeline = await Pipeline.create({
      name: 'P',
      source_id: 's-soft',
      action_type: 'reverse',
    });
    const sub = await Subscriber.create({
      pipeline_id: pipeline.id,
      url,
    });
    await sub.destroy();

    const job = await Job.create({
      pipeline_id: pipeline.id,
      payload: { t: 'ab' },
      status: 'pending',
    });

    await processQueueJob({
      jobId: job.id,
      pipelineId: pipeline.id,
      payload: job.payload,
    });

    expect(hits).toBe(0);

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });
});
