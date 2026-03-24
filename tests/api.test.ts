/**
 * API integration tests (PostgreSQL required). DATABASE_URL must point at a dev/test database.
 * Coverage aligned with docs/api.md routes.
 */
import { randomUUID } from 'crypto';
import request from 'supertest';
import { assertDatabaseConnection } from '../src/config/db';
import { createApp } from '../src/app';
import { sequelize, syncModels, Subscriber } from '../src/models';
import { startBoss, stopBoss } from '../src/services/queue';
import { processQueueJob } from '../src/worker/worker';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/pipeline';
}

async function truncateAppTables(): Promise<void> {
  await sequelize.query(
    'TRUNCATE TABLE delivery_attempts, jobs, subscribers, pipelines RESTART IDENTITY CASCADE;'
  );
}

describe('HTTP API', () => {
  const app = createApp();

  beforeAll(async () => {
    await assertDatabaseConnection();
    await syncModels();
    await startBoss();
  });

  afterAll(async () => {
    await stopBoss();
  });

  beforeEach(async () => {
    await truncateAppTables();
  });

  describe('GET /health (docs: Health & metrics)', () => {
    it('returns liveness payload', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, service: 'api' });
    });
  });

  describe('GET /metrics (docs: Health & metrics)', () => {
    it('returns job status aggregates', async () => {
      await request(app).post('/pipelines').send({
        name: 'M',
        source_id: 'src-m',
        action_type: 'timestamp',
      });
      const res = await request(app).get('/metrics');
      expect(res.status).toBe(200);
      expect(res.body.jobs).toMatchObject({
        pending: expect.any(Number),
        processing: expect.any(Number),
        success: expect.any(Number),
        failed: expect.any(Number),
      });
    });
  });

  describe('POST /pipelines (docs: Pipelines)', () => {
    it('rejects invalid pipeline payload with 400', async () => {
      const res = await request(app).post('/pipelines').send({ name: '' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('creates a pipeline with 201', async () => {
      const res = await request(app).post('/pipelines').send({
        name: 'Demo',
        source_id: 'src-demo-1',
        action_type: 'uppercase',
      });
      expect(res.status).toBe(201);
      expect(res.body.source_id).toBe('src-demo-1');
      expect(res.body.action_type).toBe('uppercase');
    });

    it('returns 409 when source_id is duplicate', async () => {
      await request(app).post('/pipelines').send({
        name: 'A',
        source_id: 'dup',
        action_type: 'reverse',
      });
      const res = await request(app).post('/pipelines').send({
        name: 'B',
        source_id: 'dup',
        action_type: 'timestamp',
      });
      expect(res.status).toBe(409);
    });
  });

  describe('GET /pipelines (docs: Pipelines)', () => {
    it('lists pipelines newest first', async () => {
      await request(app).post('/pipelines').send({
        name: 'First',
        source_id: 'src-1',
        action_type: 'uppercase',
      });
      await request(app).post('/pipelines').send({
        name: 'Second',
        source_id: 'src-2',
        action_type: 'reverse',
      });
      const res = await request(app).get('/pipelines');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].source_id).toBe('src-2');
      expect(res.body[1].source_id).toBe('src-1');
    });
  });

  describe('GET /pipelines/:id (docs: Pipelines)', () => {
    it('returns 400 for non-UUID id', async () => {
      const res = await request(app).get('/pipelines/not-a-uuid');
      expect(res.status).toBe(400);
    });

    it('returns 404 when pipeline does not exist', async () => {
      const res = await request(app).get(`/pipelines/${randomUUID()}`);
      expect(res.status).toBe(404);
    });

    it('returns pipeline by id', async () => {
      const created = await request(app).post('/pipelines').send({
        name: 'One',
        source_id: 'src-one',
        action_type: 'timestamp',
      });
      const id = created.body.id as string;
      const res = await request(app).get(`/pipelines/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
      expect(res.body.name).toBe('One');
    });
  });

  describe('PUT /pipelines/:id (docs: Pipelines)', () => {
    it('returns 400 for non-UUID id', async () => {
      const res = await request(app)
        .put('/pipelines/not-a-uuid')
        .send({ name: 'X' });
      expect(res.status).toBe(400);
    });

    it('returns 404 when pipeline does not exist', async () => {
      const res = await request(app)
        .put(`/pipelines/${randomUUID()}`)
        .send({ name: 'Nope' });
      expect(res.status).toBe(404);
    });

    it('partially updates name and action_type', async () => {
      const created = await request(app).post('/pipelines').send({
        name: 'Before',
        source_id: 'src-put',
        action_type: 'uppercase',
      });
      const id = created.body.id as string;
      const res = await request(app).put(`/pipelines/${id}`).send({
        name: 'After',
        action_type: 'reverse',
      });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('After');
      expect(res.body.action_type).toBe('reverse');
    });
  });

  describe('DELETE /pipelines/:id (docs: Pipelines)', () => {
    it('returns 400 for non-UUID id', async () => {
      const res = await request(app).delete('/pipelines/not-a-uuid');
      expect(res.status).toBe(400);
    });

    it('returns 404 when pipeline does not exist', async () => {
      const res = await request(app).delete(`/pipelines/${randomUUID()}`);
      expect(res.status).toBe(404);
    });

    it('deletes pipeline with 204 and GET by id returns 404', async () => {
      const created = await request(app).post('/pipelines').send({
        name: 'Del',
        source_id: 'src-del',
        action_type: 'uppercase',
      });
      const id = created.body.id as string;
      const del = await request(app).delete(`/pipelines/${id}`);
      expect(del.status).toBe(204);
      const get = await request(app).get(`/pipelines/${id}`);
      expect(get.status).toBe(404);
    });
  });

  describe('POST /pipelines/:id/subscribers (docs: Subscribers)', () => {
    it('returns 400 for invalid pipeline id', async () => {
      const res = await request(app)
        .post('/pipelines/bad/subscribers')
        .send({ url: 'https://example.com/h' });
      expect(res.status).toBe(400);
    });

    it('returns 404 when pipeline does not exist', async () => {
      const res = await request(app)
        .post(`/pipelines/${randomUUID()}/subscribers`)
        .send({ url: 'https://example.com/h' });
      expect(res.status).toBe(404);
    });

    it('returns 400 when url is missing or not a valid URL', async () => {
      const p = await request(app).post('/pipelines').send({
        name: 'S',
        source_id: 'src-s',
        action_type: 'uppercase',
      });
      const missing = await request(app)
        .post(`/pipelines/${p.body.id}/subscribers`)
        .send({});
      expect(missing.status).toBe(400);
      const bad = await request(app)
        .post(`/pipelines/${p.body.id}/subscribers`)
        .send({ url: '///' });
      expect(bad.status).toBe(400);
    });

    it('creates subscriber with 201', async () => {
      const p = await request(app).post('/pipelines').send({
        name: 'S',
        source_id: 'src-s2',
        action_type: 'uppercase',
      });
      const pid = p.body.id as string;
      const res = await request(app)
        .post(`/pipelines/${pid}/subscribers`)
        .send({ url: 'https://example.com/hook' });
      expect(res.status).toBe(201);
      expect(res.body.url).toBe('https://example.com/hook');
      expect(res.body.pipeline_id).toBe(pid);
    });
  });

  describe('GET /pipelines/:id/subscribers (docs: Subscribers)', () => {
    it('returns 404 when pipeline does not exist', async () => {
      const res = await request(app).get(
        `/pipelines/${randomUUID()}/subscribers`
      );
      expect(res.status).toBe(404);
    });

    it('lists active subscribers only', async () => {
      const p = await request(app).post('/pipelines').send({
        name: 'Sub test',
        source_id: 'src-sub',
        action_type: 'uppercase',
      });
      const pid = p.body.id as string;
      await request(app)
        .post(`/pipelines/${pid}/subscribers`)
        .send({ url: 'https://example.com/hook' });
      const res = await request(app).get(`/pipelines/${pid}/subscribers`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe('DELETE /pipelines/:id/subscribers/:subId (docs: Subscribers)', () => {
    it('soft-deletes subscriber: 204 then absent from list; row retained', async () => {
      const p = await request(app).post('/pipelines').send({
        name: 'Sub test',
        source_id: 'src-sub-del',
        action_type: 'uppercase',
      });
      const pid = p.body.id as string;
      const add = await request(app)
        .post(`/pipelines/${pid}/subscribers`)
        .send({ url: 'https://example.com/hook' });
      const subId = add.body.id as string;

      const del = await request(app).delete(
        `/pipelines/${pid}/subscribers/${subId}`
      );
      expect(del.status).toBe(204);

      const after = await request(app).get(`/pipelines/${pid}/subscribers`);
      expect(after.body).toHaveLength(0);

      const tombstone = await Subscriber.findByPk(subId, { paranoid: false });
      expect(tombstone).not.toBeNull();
      expect(tombstone?.deletedAt).toBeTruthy();
    });

    it('returns 404 when subscriber already soft-deleted', async () => {
      const p = await request(app).post('/pipelines').send({
        name: 'X',
        source_id: 'src-twice',
        action_type: 'uppercase',
      });
      const pid = p.body.id as string;
      const add = await request(app)
        .post(`/pipelines/${pid}/subscribers`)
        .send({ url: 'https://example.com/a' });
      const subId = add.body.id as string;
      await request(app).delete(`/pipelines/${pid}/subscribers/${subId}`);
      const again = await request(app).delete(
        `/pipelines/${pid}/subscribers/${subId}`
      );
      expect(again.status).toBe(404);
    });
  });

  describe('POST /webhooks/:source_id (docs: Webhooks)', () => {
    it('returns 404 for unknown source_id', async () => {
      const res = await request(app)
        .post('/webhooks/does-not-exist')
        .send({ hello: 'world' });
      expect(res.status).toBe(404);
    });

    it('accepts webhook with 202 and creates pending job', async () => {
      await request(app).post('/pipelines').send({
        name: 'Hook',
        source_id: 'src-hook',
        action_type: 'uppercase',
      });
      const res = await request(app)
        .post('/webhooks/src-hook')
        .send({ msg: 'hello' });
      expect(res.status).toBe(202);
      expect(res.body.message).toBe('Job accepted');
      expect(res.body.job_id).toBeDefined();
      expect(res.body.status).toBe('pending');
    });
  });

  describe('GET /jobs/:id and GET /jobs (docs: Jobs)', () => {
    it('returns 400 for non-UUID job id', async () => {
      const res = await request(app).get('/jobs/not-uuid');
      expect(res.status).toBe(400);
    });

    it('returns 404 when job does not exist', async () => {
      const res = await request(app).get(`/jobs/${randomUUID()}`);
      expect(res.status).toBe(404);
    });

    it('returns job with deliveryAttempts array', async () => {
      await request(app).post('/pipelines').send({
        name: 'J',
        source_id: 'src-job',
        action_type: 'uppercase',
      });
      const wh = await request(app)
        .post('/webhooks/src-job')
        .send({ x: 1 });
      const jobId = wh.body.job_id as string;
      const res = await request(app).get(`/jobs/${jobId}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(jobId);
      expect(Array.isArray(res.body.deliveryAttempts)).toBe(true);
      expect(res.body.deliveryAttempts).toHaveLength(0);
    });

    it('lists jobs and filters by pipeline_id', async () => {
      const p = await request(app).post('/pipelines').send({
        name: 'L',
        source_id: 'src-list',
        action_type: 'reverse',
      });
      const pid = p.body.id as string;
      const other = await request(app).post('/pipelines').send({
        name: 'O',
        source_id: 'src-other',
        action_type: 'uppercase',
      });
      const otherId = other.body.id as string;

      await request(app).post('/webhooks/src-list').send({ a: 1 });
      await request(app).post('/webhooks/src-other').send({ b: 2 });

      const all = await request(app).get('/jobs');
      expect(all.status).toBe(200);
      expect(all.body.length).toBeGreaterThanOrEqual(2);

      const filtered = await request(app).get(`/jobs?pipeline_id=${pid}`);
      expect(filtered.status).toBe(200);
      expect(filtered.body.every((j: { pipeline_id: string }) => j.pipeline_id === pid)).toBe(
        true
      );
      expect(
        filtered.body.every((j: { pipeline_id: string }) => j.pipeline_id !== otherId)
      ).toBe(true);
    });

    it('returns 400 when pipeline_id query is not a UUID', async () => {
      const res = await request(app).get('/jobs?pipeline_id=bad');
      expect(res.status).toBe(400);
    });
  });

  describe('End-to-end: job processing via worker helper (docs: Webhooks + Jobs)', () => {
    it('moves job from pending to success after processQueueJob', async () => {
      const p = await request(app).post('/pipelines').send({
        name: 'Hook',
        source_id: 'src-hook-e2e',
        action_type: 'uppercase',
      });
      const pid = p.body.id as string;

      const wh = await request(app)
        .post('/webhooks/src-hook-e2e')
        .send({ msg: 'hello' });
      expect(wh.status).toBe(202);
      const jobId = wh.body.job_id as string;

      const pending = await request(app).get(`/jobs/${jobId}`);
      expect(pending.status).toBe(200);
      expect(pending.body.status).toBe('pending');

      await processQueueJob({
        jobId,
        pipelineId: pid,
        payload: pending.body.payload,
      });

      const done = await request(app).get(`/jobs/${jobId}`);
      expect(done.status).toBe(200);
      expect(done.body.status).toBe('success');
      expect(done.body.result).toEqual({ msg: 'HELLO' });
    });
  });
});
