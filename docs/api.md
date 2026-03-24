# HTTP API

Base URL (Docker): `http://localhost:3000`

**Interactive testing:** after `docker compose up`, open **[http://localhost:3000/demo.html](http://localhost:3000/demo.html)** for forms and buttons that call these endpoints (see [how-to.md](how-to.md)).

All JSON bodies use `Content-Type: application/json`.

## Health & metrics

### `GET /health`

Returns service liveness.

**Example**

```http
GET /health HTTP/1.1
```

```json
{ "ok": true, "service": "api" }
```

### `GET /metrics`

Aggregate job counts by status.

```json
{
  "jobs": {
    "pending": 0,
    "processing": 0,
    "success": 12,
    "failed": 1
  }
}
```

---

## Pipelines

### `POST /pipelines`

Create a pipeline.

**Body**

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Human-readable name. |
| `source_id` | string | Unique webhook key used in `/webhooks/:source_id`. |
| `action_type` | enum | `uppercase`, `reverse`, or `timestamp`. |

**Example**

```http
POST /pipelines HTTP/1.1
Content-Type: application/json

{
  "name": "CRM hook",
  "source_id": "crm-001",
  "action_type": "uppercase"
}
```

`201` with the created pipeline. `409` if `source_id` is taken.

### `GET /pipelines`

List pipelines (newest first).

### `GET /pipelines/:id`

Fetch one pipeline by UUID. `404` if missing.

### `PUT /pipelines/:id`

Partial update. Optional fields: `name`, `action_type`.

### `DELETE /pipelines/:id`

Deletes pipeline (cascades subscribers and jobs). `204` on success.

---

## Subscribers

### `POST /pipelines/:id/subscribers`

**Body**

```json
{ "url": "https://example.com/webhook-endpoint" }
```

`201` with subscriber row.

### `GET /pipelines/:id/subscribers`

List subscribers for the pipeline.

### `DELETE /pipelines/:id/subscribers/:subId`

Soft-deletes the subscriber: sets `deleted_at` to the current time. The row remains for foreign keys and delivery history; it no longer appears in `GET` lists and will not receive webhook deliveries. `204` on success. `404` if the subscriber is missing or already soft-deleted.

---

## Webhooks

### `POST /webhooks/:source_id`

Accepts arbitrary JSON. Non-object bodies are wrapped as `{ "data": <body> }`.

**Behavior**

1. Resolves `source_id` to a pipeline.
2. Inserts a `jobs` row with `status: pending`.
3. Publishes `{ jobId, pipelineId, payload }` to pg-boss (API does **not** process the job).

**Example**

```http
POST /webhooks/crm-001 HTTP/1.1
Content-Type: application/json

{ "message": "hello" }
```

`202` response:

```json
{
  "message": "Job accepted",
  "job_id": "b2c0c4f0-...",
  "status": "pending"
}
```

`404` if `source_id` is unknown.

---

## Jobs

### `GET /jobs/:id`

Returns the job plus ordered `deliveryAttempts` (delivery audit trail).

### `GET /jobs?pipeline_id=<uuid>`

Lists up to 100 recent jobs, optionally filtered by `pipeline_id`.

---

## Errors

Validation failures return `400` with an `express-validator` detail array. Unexpected failures return `500` with a JSON body and are logged server-side.
