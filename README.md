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

## Architecture (short)

```
Client → API → PostgreSQL (domain tables)
          ↘ pg-boss (queue tables) ↙
                    Worker → Actions → Delivery → Subscribers
```

See [docs/architecture.md](docs/architecture.md) for diagrams and rationale.

**Manual API demo** (every route, curl checklist): [docs/how-to.md](docs/how-to.md).

## Quick start (Docker)

```bash
docker compose up --build
```

- API: [http://localhost:3000](http://localhost:3000)
- Postgres: `localhost:5432` (user/password `postgres`, DB `pipeline`)

Check health:

```bash
curl http://localhost:3000/health
```

## Local development (without Docker for Node)

1. Start PostgreSQL 16+ and create database `pipeline`.
2. Copy `.env.example` → `.env` and adjust `DATABASE_URL`.
3. Install & run:

```bash
npm install
npm run dev          # API
npm run dev:worker   # second terminal — worker
```

## Example API usage

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

**First time:** if you see `database "pipeline" does not exist`, create it: `npm run db:create` (Postgres must be running).

```bash
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/pipeline
npm run db:create   # once per machine / database
npm test
npm run lint
```

GitHub Actions workflow: [.github/workflows/ci.yml](.github/workflows/ci.yml)

## Documentation


| Doc                                          | Description                  |
| -------------------------------------------- | ---------------------------- |
| [docs/architecture.md](docs/architecture.md) | System design & boundaries   |
| [docs/api.md](docs/api.md)                   | Endpoint reference + samples |
| [docs/queue.md](docs/queue.md)               | pg-boss behavior & lifecycle |
| [docs/docker.md](docs/docker.md)             | Compose services & volumes   |
| [docs/decisions.md](docs/decisions.md)       | Technology choices           |


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
tests/           # Jest + Supertest integration tests
```

## License

MIT