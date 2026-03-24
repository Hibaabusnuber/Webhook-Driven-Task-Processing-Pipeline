# Manual API demo & test checklist

Use this guide to **manually** exercise every HTTP route and common outcomes (Postman, Insomnia, Thunder Client, or `curl`). For field definitions and response shapes, see [api.md](api.md).

**Base URL:** `http://localhost:3000` (adjust host/port if needed.)

Browsers only send **GET** when you use the address bar. **POST**, **PUT**, **DELETE**, and **webhooks** need **curl**, **Postman**, **Thunder Client**, etc.

---

## Paste in the browser address bar (GET)

Copy the whole line (no spaces). Replace `YOUR_PIPELINE_ID` and `YOUR_JOB_ID` with real UUIDs from JSON responses.

| What | URL to paste |
|------|----------------|
| Health | `http://localhost:3000/health` |
| Metrics | `http://localhost:3000/metrics` |
| List pipelines | `http://localhost:3000/pipelines` |
| One pipeline | `http://localhost:3000/pipelines/YOUR_PIPELINE_ID` |
| List subscribers | `http://localhost:3000/pipelines/YOUR_PIPELINE_ID/subscribers` |
| List jobs | `http://localhost:3000/jobs` |
| Jobs for one pipeline | `http://localhost:3000/jobs?pipeline_id=YOUR_PIPELINE_ID` |
| One job + delivery history | `http://localhost:3000/jobs/YOUR_JOB_ID` |

**Validation / error demos (GET):**

| Case | URL to paste |
|------|----------------|
| Bad pipeline id | `http://localhost:3000/pipelines/not-a-uuid` → **400** |
| Missing pipeline | `http://localhost:3000/pipelines/00000000-0000-4000-8000-000000000001` → **404** |
| Bad job id | `http://localhost:3000/jobs/not-a-uuid` → **400** |
| Missing job | `http://localhost:3000/jobs/00000000-0000-4000-8000-000000000099` → **404** |
| Bad `pipeline_id` query | `http://localhost:3000/jobs?pipeline_id=not-uuid` → **400** |
| Missing pipeline (subscribers) | `http://localhost:3000/pipelines/00000000-0000-4000-8000-000000000003/subscribers` → **404** |

Clickable (same links): [health](http://localhost:3000/health) · [metrics](http://localhost:3000/metrics) · [pipelines](http://localhost:3000/pipelines) · [jobs](http://localhost:3000/jobs)

---

## 0. Start the stack

You need **PostgreSQL**, the **`pipeline` database**, the **API**, and the **worker** (jobs stay `pending` without the worker).

**Option A — Docker (simplest)**

```bash
docker compose up --build
```

Ensure the DB exists the first time: `npm run db:create` (from the project root, with Postgres reachable).

**Option B — Local Node**

1. Postgres running; `.env` with `DATABASE_URL=.../pipeline`.
2. Terminal 1: `npm run dev`
3. Terminal 2: `npm run dev:worker`

---

## 1. Health & metrics

| # | Case | Request | Expected |
|---|------|---------|----------|
| 1.1 | Liveness | `GET /health` | **200** — `ok: true`, `service: "api"` |
| 1.2 | Job counters | `GET /metrics` | **200** — `jobs.pending`, `processing`, `success`, `failed` |

```bash
curl -s http://localhost:3000/health
curl -s http://localhost:3000/metrics
```

---

## 2. Pipelines

Set shell variables after a successful create (or paste UUIDs from JSON):

```bash
export BASE=http://localhost:3000
# After step 2.2:
# export PIPE_ID='<uuid from JSON>'
# export SUB_ID='<uuid after adding subscriber>'
# export JOB_ID='<uuid from webhook 202 response>'
```

| # | Case | Request | Expected |
|---|------|---------|----------|
| 2.1 | Validation error | `POST /pipelines` body `{ "name": "" }` or missing fields | **400** — `error: "Validation failed"`, `details` |
| 2.2 | Create | `POST /pipelines` with valid `name`, `source_id`, `action_type` (`uppercase` \| `reverse` \| `timestamp`) | **201** — pipeline JSON; save `id` as `PIPE_ID` |
| 2.3 | Duplicate `source_id` | `POST /pipelines` again with same `source_id` | **409** |
| 2.4 | List | `GET /pipelines` | **200** — array, newest first |
| 2.5 | Bad id | `GET /pipelines/not-a-uuid` | **400** |
| 2.6 | Missing pipeline | `GET /pipelines/00000000-0000-4000-8000-000000000001` | **404** |
| 2.7 | Get by id | `GET /pipelines/$PIPE_ID` | **200** |
| 2.8 | Update | `PUT /pipelines/$PIPE_ID` e.g. `{ "name": "Updated", "action_type": "reverse" }` | **200** |
| 2.9 | PUT missing | `PUT /pipelines/00000000-0000-4000-8000-000000000002` | **404** |
| 2.10 | PUT bad id | `PUT /pipelines/bad-uuid` body `{}` | **400** |
| 2.11 | Delete | `DELETE /pipelines/$PIPE_ID` | **204** |
| 2.12 | GET after delete | `GET /pipelines/$PIPE_ID` | **404** |

**Create (2.2) example:**

```bash
curl -s -X POST "$BASE/pipelines" -H "Content-Type: application/json" \
  -d '{"name":"Demo","source_id":"demo-src","action_type":"uppercase"}'
```

Repeat **2.2** with different `source_id` values if you already ran **2.11** and need a fresh pipeline for webhooks/subscribers.

---

## 3. Subscribers

Use a `PIPE_ID` from an existing pipeline. Use a real HTTPS URL that accepts POST JSON (e.g. `https://httpbin.org/post`).

| # | Case | Request | Expected |
|---|------|---------|----------|
| 3.1 | Bad pipeline param | `POST /pipelines/bad/subscribers` | **400** |
| 3.2 | Missing pipeline | `POST /pipelines/<random-uuid>/subscribers` + valid `url` | **404** |
| 3.3 | Invalid / missing URL | `POST /pipelines/$PIPE_ID/subscribers` `{}` or `{ "url": "///" }` | **400** |
| 3.4 | Create | `POST /pipelines/$PIPE_ID/subscribers` `{ "url": "https://httpbin.org/post" }` | **201** — save `id` as `SUB_ID` |
| 3.5 | List | `GET /pipelines/$PIPE_ID/subscribers` | **200** — array of active subscribers |
| 3.6 | List — missing pipeline | `GET /pipelines/<random-uuid>/subscribers` | **404** |
| 3.7 | Soft delete | `DELETE /pipelines/$PIPE_ID/subscribers/$SUB_ID` | **204** |
| 3.8 | List after delete | `GET /pipelines/$PIPE_ID/subscribers` | **200** — `[]` |
| 3.9 | Delete again | `DELETE` same URL as 3.7 | **404** |

**Create (3.4) example:**

```bash
curl -s -X POST "$BASE/pipelines/$PIPE_ID/subscribers" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://httpbin.org/post"}'
```

---

## 4. Webhooks

Uses pipeline **`source_id`**, not `PIPE_ID`.

| # | Case | Request | Expected |
|---|------|---------|----------|
| 4.1 | Unknown source | `POST /webhooks/does-not-exist` + JSON body | **404** |
| 4.2 | Accepted | `POST /webhooks/demo-src` (match your pipeline’s `source_id`) + JSON | **202** — `job_id`, `status: "pending"`; save `JOB_ID` |

```bash
curl -s -X POST "$BASE/webhooks/demo-src" -H "Content-Type: application/json" \
  -d '{"msg":"hello"}'
```

Poll until the worker finishes (a few seconds):

```bash
curl -s "$BASE/jobs/$JOB_ID"
```

Expect `status` → `success`, `result` matching the pipeline `action_type` (e.g. uppercase → `"HELLO"`), and `deliveryAttempts` if subscribers were active.

---

## 5. Jobs

| # | Case | Request | Expected |
|---|------|---------|----------|
| 5.1 | Bad job id | `GET /jobs/not-a-uuid` | **400** |
| 5.2 | Missing job | `GET /jobs/00000000-0000-4000-8000-000000000099` | **404** |
| 5.3 | Get job + history | `GET /jobs/$JOB_ID` | **200** — job fields + `deliveryAttempts` array |
| 5.4 | List all | `GET /jobs` | **200** — up to 100 jobs |
| 5.5 | Filter by pipeline | `GET /jobs?pipeline_id=$PIPE_ID` | **200** — all rows have that `pipeline_id` |
| 5.6 | Bad query | `GET /jobs?pipeline_id=not-uuid` | **400** |

---

## 6. End-to-end story (minimal order)

1. `GET /health` → `GET /metrics`
2. `POST /pipelines` → note `PIPE_ID` and `source_id`
3. `GET /pipelines`, `GET /pipelines/$PIPE_ID`
4. `PUT /pipelines/$PIPE_ID` (optional)
5. `POST /pipelines/$PIPE_ID/subscribers` → note `SUB_ID`
6. `GET /pipelines/$PIPE_ID/subscribers`
7. `POST /webhooks/<source_id>` → note `JOB_ID`; poll `GET /jobs/$JOB_ID` until `success`
8. `GET /jobs?pipeline_id=$PIPE_ID`
9. `DELETE .../subscribers/$SUB_ID` → `GET .../subscribers` empty
10. `POST /webhooks/<source_id>` again — job succeeds; no delivery to removed subscriber
11. `DELETE /pipelines/$PIPE_ID` → `GET /pipelines/$PIPE_ID` **404**

Run the **error rows** in §§1–5 anytime to confirm validation and `404`/`409` behavior.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Job stays `pending` | Worker not running or wrong `DATABASE_URL` / DB |
| Webhook **404** | Wrong `source_id` or pipeline deleted |
| No `deliveryAttempts` | No active subscribers, or URL failed (see worker logs) |
| Connection errors | Postgres down; create DB with `npm run db:create` |

---

## See also

- [api.md](api.md) — full API reference  
- [docker.md](docker.md) — Compose services  
- [README.md](../README.md) — project overview  

Automated tests: `npm test` (see README).
