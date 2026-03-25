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

With Compose running, open **http://localhost:3000**. Leave **API base URL** as `http://localhost:3000` unless you use another host/port.

Use **Quick GET** for health/metrics/lists; create a **pipeline** (note `source_id`), add a **subscriber** (e.g. httpbin), **POST webhook** with matching `source_id`, then **GET job** until `status` is `success`. The checklist at the bottom uses **localStorage** only.

Step-by-step URLs and troubleshooting: **[docs/how-to.md](docs/how-to.md)**.

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

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/how-to.md](docs/how-to.md) | Web tester walkthrough, browser URLs, troubleshooting |
| [docs/api.md](docs/api.md) | Endpoint reference + samples |
| [docs/architecture.md](docs/architecture.md) | System design |
| [docs/docker.md](docs/docker.md) | Compose services, volumes, optional dev notes |
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
