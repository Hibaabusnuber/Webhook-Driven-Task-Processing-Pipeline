# Webhook-Driven Task Processing Pipeline

TypeScript + Express service that ingests webhooks, stores **jobs** in PostgreSQL, hands work to **pg-boss**, processes payloads with pluggable **actions**, and **delivers** JSON results to subscriber URLs with retries and full audit history.

## Features

- Pipeline CRUD and subscriber management APIs
- Webhook ingestion that only **persists + enqueues** (never processes inline)
- Worker-driven processing with `uppercase`, `reverse`, and `timestamp` actions
- Axios-based delivery with exponential backoff (`1s`, `2s`, `4s`) and up to **3** attempts per subscriber
- Job status API including `delivery_attempts` history
- Docker Compose stack (`app`, `worker`, `postgres` + named volume)
- GitHub Actions CI (install → lint → build → test)
- Structured logging (Winston), request validation (express-validator), `GET /metrics`
- **Web tester UI** — forms, buttons, response log, and a browser-saved checklist at [`/demo.html`](http://localhost:3000/demo.html)

## Architecture (short)

```
Client → API → PostgreSQL (domain tables)
          ↘ pg-boss (queue tables) ↙
                    Worker → Actions → Delivery → Subscribers
```

See [docs/architecture.md](docs/architecture.md) for diagrams and rationale.

---

## Run the service (Docker only)

The intended way to run the **full stack** (Postgres + API + worker) is a single Compose command. You do **not** need Node installed on the host for this path.

**First time (build images):**

```bash
docker compose up --build
```

**Later (reuse existing images):**

```bash
docker compose up
```

Leave the terminal attached to see logs from all services, or add `-d` to run in the background.

**What starts**

| Service   | Role |
|-----------|------|
| `postgres` | Database `pipeline` (created by Compose; data in volume `postgres_data`) |
| `app`      | HTTP API on port **3000** (serves REST + static `public/demo.html`) |
| `worker`   | Consumes pg-boss jobs and runs actions + deliveries |

**After it is healthy**

- Open **[http://localhost:3000](http://localhost:3000)** — redirects to the **web tester**
- Or open **[http://localhost:3000/demo.html](http://localhost:3000/demo.html)** directly
- Postgres is exposed at **`localhost:5432`** (`postgres` / `postgres`, database `pipeline`)

Quick health check:

```bash
curl http://localhost:3000/health
```

More detail: [docs/docker.md](docs/docker.md).

---

## Manual testing with the web tester

Use the built-in GUI to drive the same flows as [docs/how-to.md](docs/how-to.md) without Postman or `curl`.

1. With Compose running, open **http://localhost:3000** in a browser.
2. Leave **API base URL** as `http://localhost:3000` (same origin; change only if you use a tunnel or different port).
3. Use **Quick GET** for health/metrics/pipelines/jobs.
4. **Pipelines:** fill name, `source_id`, and `action_type` → **POST**; the returned pipeline `id` is filled into **Pipeline ID** for later steps.
5. **Subscribers:** set subscriber URL (e.g. `https://httpbin.org/post`) → **POST subscriber**; subscriber `id` is filled for delete.
6. **Webhooks:** set `source_id` to match the pipeline → **POST webhook**; `job_id` is filled when the response is **202**.
7. **Jobs:** **GET /jobs/:id** until `status` is `success` (the **worker** container must be running).
8. Tick items in the **checklist** at the bottom; progress is stored in **localStorage** for this browser.

Full checklist, curl equivalents, and error-case URLs: **[docs/how-to.md](docs/how-to.md)**.

---

## Optional: local Node (without Docker for the app)

Use this only if you develop the code without running `app`/`worker` in containers.

1. Start PostgreSQL 16+ and create database `pipeline` (or `npm run db:create` with Postgres up).
2. Copy `.env.example` → `.env` and set `DATABASE_URL`.
3. Run API and worker in two terminals:

```bash
npm install
npm run dev          # API
npm run dev:worker   # worker
```

Open **http://localhost:3000/demo.html** the same way.

---

## Example API usage (`curl`)

Create a pipeline:

```bash
curl -X POST http://localhost:3000/pipelines \
  -H "Content-Type: application/json" \
  -d '{"name":"Demo","source_id":"demo-src","action_type":"uppercase"}'
```

Add a subscriber (replace `:pipeline_id`):

```bash
curl -X POST http://localhost:3000/pipelines/<pipeline_id>/subscribers \
  -H "Content-Type: application/json" \
  -d '{"url":"https://httpbin.org/post"}'
```

Send a webhook:

```bash
curl -X POST http://localhost:3000/webhooks/demo-src \
  -H "Content-Type: application/json" \
  -d '{"msg":"hello"}'
```

Poll the job (replace `<job_id>` from the `202` response):

```bash
curl http://localhost:3000/jobs/<job_id>
```

## Database migrations

Schema changes are tracked under `migrations/` (Sequelize CLI). With `DATABASE_URL` set:

```bash
npm run migrate
```

(`syncModels()` also runs `ADD COLUMN IF NOT EXISTS deleted_at` on `subscribers` so existing Docker volumes pick up soft-delete without a manual migrate.)

## Testing & CI

`tests/api.test.ts` exercises every HTTP route described in [docs/api.md](docs/api.md) (health, metrics, pipelines CRUD, subscribers, webhooks, jobs list/detail, plus an end-to-end job processing check).

**First time (local `npm test`, not inside Docker):** if you see `database "pipeline" does not exist`, create it: `npm run db:create` (Postgres must be running).

```bash
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/pipeline
npm run db:create   # once per machine / database
npm test
npm run lint
```

GitHub Actions workflow: [.github/workflows/ci.yml](.github/workflows/ci.yml)

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/how-to.md](docs/how-to.md) | **Web tester** walkthrough + manual checklist + browser URLs |
| [docs/api.md](docs/api.md) | Endpoint reference + samples |
| [docs/architecture.md](docs/architecture.md) | System design |
| [docs/docker.md](docs/docker.md) | Compose services & volumes |
| [docs/queue.md](docs/queue.md) | pg-boss lifecycle |
| [docs/decisions.md](docs/decisions.md) | Technology choices |

## Project layout

```
src/
  api/           # Express routers
  services/      # queue, processor, delivery
  actions/       # modular transforms
  models/        # Sequelize models
  worker/        # pg-boss consumer
  config/        # env + db connection
  app.ts         # API bootstrap
public/
  demo.html      # Web tester UI (served by Express)
tests/           # Jest + Supertest integration tests
```

## License

MIT
