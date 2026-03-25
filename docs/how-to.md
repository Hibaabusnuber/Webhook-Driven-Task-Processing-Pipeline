# Manual testing: web tester + checklist

This guide matches how you **run and test** the project after **`docker compose up`** (or local `npm run dev` + worker). For raw HTTP details, see [api.md](api.md).

---

## 1. Start the stack (Docker)

```bash
docker compose up --build
```

Later: `docker compose up`. This starts PostgreSQL (`pipeline` DB), the API on **3000**, and the **worker**. Jobs stay `pending` until the worker runs.

- **API + UI:** [http://localhost:3000](http://localhost:3000) (redirects to the tester)
- **Tester:** [http://localhost:3000/demo.html](http://localhost:3000/demo.html)

**Run app/worker on the host instead:** [README.md](../README.md) (“Optional: local Node”). You still need Postgres and database `pipeline` (`npm run db:create` if missing).

---

## 2. Web tester (`/demo.html`)

Static HTML + **fetch** to the same origin (no CORS). **Base URL** defaults to `http://localhost:3000`.


**Auto-filled IDs:** POST pipeline → Pipeline ID; POST subscriber → Subscriber ID; POST webhook (202) → Job ID.

Poll **GET /jobs/:id** until `status` is **`success`** (worker must be running).

| Section | What it does |
|---------|----------------|
| **Quick GET** | One-click `GET` for `/health`, `/metrics`, `/pipelines`, `/jobs` |
| **Pipelines** | Create pipeline (`name`, `source_id`, `action_type`); **Pipeline ID** field for get/put/delete; PUT uses JSON textarea; DELETE pipeline |
| **Subscribers** | POST subscriber (needs **Pipeline ID**); GET list; DELETE (needs **Subscriber ID**) |
| **Webhooks** | POST to `/webhooks/:source_id` with JSON body; **`source_id` must match** an existing pipeline |
| **Jobs** | GET one job by id; list all jobs; list filtered by `pipeline_id` |

### Auto-filled IDs

When a request succeeds, the UI copies IDs into fields when possible:

- After **POST /pipelines** → **Pipeline ID**
- After **POST subscriber** → **Subscriber ID**
- After **POST webhook** (202) → **Job ID**

Poll **GET /jobs/:id** until `status` is **`success`** (worker must be running — use Docker Compose or `npm run dev:worker`).

### Response log

Every action appends **HTTP status** and **body** at the bottom. Use **Clear log** to reset. Errors (4xx/5xx) are highlighted in the log.

### Checklist

The bottom **checklist** is stored in your browser (**`localStorage`**). Use **Reset checklist** to clear it. It is a reminder only — it does not call the API.

Suggested order (aligns with a full demo):

1. GET /health and /metrics (Quick GET)
2. POST pipeline → note pipeline id
3. POST subscriber (httpbin or similar URL)
4. POST webhook → note job id
5. GET job until success
6. GET jobs with pipeline filter (optional)
7. DELETE subscriber → list empty → optional second webhook
8. DELETE pipeline

---

## 3. Quick GET URLs (browser)

Replace `YOUR_PIPELINE_ID` / `YOUR_JOB_ID` with real UUIDs.

| What | URL |
|------|-----|
| Health | `http://localhost:3000/health` |
| Metrics | `http://localhost:3000/metrics` |
| Pipelines | `http://localhost:3000/pipelines` |
| One pipeline | `http://localhost:3000/pipelines/YOUR_PIPELINE_ID` |
| Subscribers | `http://localhost:3000/pipelines/YOUR_PIPELINE_ID/subscribers` |
| Jobs | `http://localhost:3000/jobs` |
| Jobs by pipeline | `http://localhost:3000/jobs?pipeline_id=YOUR_PIPELINE_ID` |
| One job | `http://localhost:3000/jobs/YOUR_JOB_ID` |

**Validation / error demos (GET):**

| Case | URL |
|------|-----|
| Bad pipeline id | `http://localhost:3000/pipelines/not-a-uuid` → **400** |
| Missing pipeline | `http://localhost:3000/pipelines/00000000-0000-4000-8000-000000000001` → **404** |
| Bad job id | `http://localhost:3000/jobs/not-a-uuid` → **400** |
| Missing job | `http://localhost:3000/jobs/00000000-0000-4000-8000-000000000099` → **404** |
| Bad `pipeline_id` query | `http://localhost:3000/jobs?pipeline_id=not-uuid` → **400** |
| Missing pipeline (subscribers) | `http://localhost:3000/pipelines/00000000-0000-4000-8000-000000000003/subscribers` → **404** |

Clickable: [health](http://localhost:3000/health) · [metrics](http://localhost:3000/metrics) · [pipelines](http://localhost:3000/pipelines) · [jobs](http://localhost:3000/jobs)

