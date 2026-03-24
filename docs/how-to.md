# Manual testing: web tester + checklist

This guide matches how you **run and test** the project after **`docker compose up`** (or local `npm run dev` + worker). For raw HTTP details, see [api.md](api.md).

---

## 1. Start the full stack (Docker — recommended)

From the project root:

```bash
docker compose up --build
```

This starts **PostgreSQL** (database `pipeline` is created by Compose), the **API** on port **3000**, and the **worker**. Jobs stay **`pending`** until the worker is up — with Compose, all three run together.

- **API + web UI:** [http://localhost:3000](http://localhost:3000) (root redirects to the tester)
- **Tester only:** [http://localhost:3000/demo.html](http://localhost:3000/demo.html)

No host Node.js required for this path.

**Optional — run app/worker on the host instead:** see [README.md](../README.md) (“Optional: local Node”). You still need Postgres and a `pipeline` database (`npm run db:create` if missing).

---

## 2. Web tester GUI (`/demo.html`)

The page is **static HTML + JavaScript** served by the same Express app (no separate frontend build). It talks to the API with **`fetch`**; because it is **same-origin**, you do not need CORS.

### Base URL field

- Default: **`http://localhost:3000`** (filled from `window.location.origin` when you open the page from the API).
- Change only if you access the API through another host/port (reverse proxy, tunnel).

### Sections (top to bottom)

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

### What the GUI does *not* cover

- Some **validation error** cases (e.g. duplicate `source_id`, bad UUIDs) are easier with **curl** or by editing URLs in the address bar — see §5.
- Automated regression: **`npm test`** (developers).

---

## 3. Paste in the browser address bar (GET only)

Use these for quick **GET** checks or **error demos**. Replace `YOUR_PIPELINE_ID` and `YOUR_JOB_ID` with real UUIDs from the tester or API responses.

| What | URL |
|------|-----|
| Health | `http://localhost:3000/health` |
| Metrics | `http://localhost:3000/metrics` |
| List pipelines | `http://localhost:3000/pipelines` |
| One pipeline | `http://localhost:3000/pipelines/YOUR_PIPELINE_ID` |
| List subscribers | `http://localhost:3000/pipelines/YOUR_PIPELINE_ID/subscribers` |
| List jobs | `http://localhost:3000/jobs` |
| Jobs for one pipeline | `http://localhost:3000/jobs?pipeline_id=YOUR_PIPELINE_ID` |
| One job + `deliveryAttempts` | `http://localhost:3000/jobs/YOUR_JOB_ID` |

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

---

## 4. Full manual checklist (API behaviour)

Use the **web tester**, **browser URLs** (§3), or **`curl`** as you prefer.

### Health & metrics

| # | Case | Expected |
|---|------|----------|
| H1 | `GET /health` | **200** — `ok: true`, `service: "api"` |
| H2 | `GET /metrics` | **200** — `jobs.*` counts |

### Pipelines

| # | Case | Expected |
|---|------|----------|
| P1 | `POST /pipelines` invalid body | **400** |
| P2 | `POST /pipelines` valid | **201** |
| P3 | Duplicate `source_id` | **409** |
| P4 | `GET /pipelines` | **200** |
| P5 | `GET /pipelines/not-a-uuid` | **400** |
| P6 | `GET /pipelines/<missing-uuid>` | **404** |
| P7 | `GET /pipelines/:id` | **200** |
| P8 | `PUT /pipelines/:id` | **200** |
| P9 | `PUT` missing / bad id | **404** / **400** |
| P10 | `DELETE /pipelines/:id` | **204** |
| P11 | `GET` after delete | **404** |

### Subscribers

| # | Case | Expected |
|---|------|----------|
| S1 | `POST` bad pipeline id | **400** |
| S2 | `POST` missing pipeline | **404** |
| S3 | `POST` invalid URL | **400** |
| S4 | `POST` subscriber | **201** |
| S5 | `GET` list | **200** |
| S6 | `DELETE` | **204**; list empty |
| S7 | `DELETE` again | **404** |

### Webhooks & jobs

| # | Case | Expected |
|---|------|----------|
| W1 | `POST /webhooks/unknown` | **404** |
| W2 | `POST /webhooks/:source_id` | **202** + `job_id` |
| J1 | `GET /jobs/:id` | **200** + `deliveryAttempts` |
| J2 | `GET /jobs` / `?pipeline_id=` | **200** |
| J3 | Bad UUID / query | **400** |

### curl examples

```bash
export BASE=http://localhost:3000
curl -s "$BASE/health"
curl -s -X POST "$BASE/pipelines" -H "Content-Type: application/json" \
  -d '{"name":"Demo","source_id":"demo-src","action_type":"uppercase"}'
curl -s -X POST "$BASE/webhooks/demo-src" -H "Content-Type: application/json" \
  -d '{"msg":"hello"}'
```

---

## 5. Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Cannot open `/demo.html` | API container not running or wrong port |
| Job stays **`pending`** | Worker container not running or DB unreachable |
| Webhook **404** | `source_id` does not match any pipeline |
| No **`deliveryAttempts`** | No active subscriber, or subscriber URL failed (worker logs) |
| **`npm test`** fails: DB missing | Run Postgres locally and `npm run db:create` — not required for **Docker-only** runtime |

---

## See also

- [README.md](../README.md) — **Docker-only run** + project overview  
- [docker.md](docker.md) — Compose services  
- [api.md](api.md) — HTTP reference  
- Automated tests: `npm test` (see README)
