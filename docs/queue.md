# Queue (pg-boss)

## Role

pg-boss is a PostgreSQL-backed job queue. We use a single named queue (default `webhook-jobs`, overridable via `QUEUE_NAME`) to move work from the API process to the worker process.

## Configuration

- Connection string is the same as Sequelize (`DATABASE_URL`).
- On startup, the app ensures the queue exists (`getQueue` → `createQueue` if missing).
- Published messages are shaped as:

```json
{
  "jobId": "<uuid of jobs.id>",
  "pipelineId": "<uuid of pipelines.id>",
  "payload": { "...": "..." }
}
```

The worker always reads the authoritative payload from the `jobs` row; the enqueue payload mirrors what was stored for redundancy and debugging.

## Job lifecycle (domain)

1. **`pending`**: inserted by the API when a webhook is accepted.
2. **`processing`**: worker claims the job from pg-boss and updates the row before running the action.
3. **`success`**: action output stored in `result`; deliveries executed (each attempt logged).
4. **`failed`**: processing error (e.g., missing pipeline in message, unexpected throw). Delivery is skipped.

## pg-boss lifecycle (infrastructure)

- **`send`**: API enqueues after DB insert. Options include limited retries at the pg-boss layer (`retryLimit`, `retryDelay`) to survive transient DB issues.
- **`work`**: Worker registers a handler that receives **batches** of jobs (`Job[]`). Each batch item is processed sequentially in our handler to keep logs deterministic.
- **Idempotency**: If pg-boss redelivers after a successful completion, the worker sees `status === success` and returns without duplicating side effects.

## Failure modes

| Scenario | Mitigation |
|----------|------------|
| Worker crash mid-handler | pg-boss may retry; duplicate success is ignored. |
| Stale `processing` state | Possible if a worker dies after updating the row but before finishing; operational follow-up can reset or re-drive such jobs (future enhancement). |
| API cannot enqueue | HTTP `500` with logs; client may retry webhook (ensure idempotent subscribers). |
