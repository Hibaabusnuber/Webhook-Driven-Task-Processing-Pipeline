# Docker

## Services (`docker-compose.yml`)

| Service | Image / build | Purpose |
|---------|---------------|---------|
| `postgres` | `postgres:16-alpine` | Primary datastore for Sequelize models and pg-boss. |
| `app` | Project `Dockerfile` | Express API on port `3000`. |
| `worker` | Same image, different command | Consumes pg-boss jobs. |

## First run

```bash
docker compose up --build
```

The API/worker also run `ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS deleted_at ...` on boot (see `syncModels`). For versioned schema changes from scratch, you can run `npm run migrate` against the same `DATABASE_URL` (see `migrations/` and `.sequelizerc`).

- API: `http://localhost:3000`
- Postgres: `localhost:5432` (`postgres` / `postgres`, database `pipeline`)

## Volume

```yaml
volumes:
  postgres_data:
```

Mounted at `postgres_data:/var/lib/postgresql/data` for the `postgres` service so data survives container recreation.

## Environment

Both `app` and `worker` receive:

```
DATABASE_URL=postgres://postgres:postgres@postgres:5432/pipeline
NODE_ENV=production
```

Override `LOG_LEVEL` or `QUEUE_NAME` by extending the `environment` block.

## Health ordering

`app` and `worker` wait for Postgres to report healthy via `pg_isready` before starting, avoiding connection storms on a cold database.

## Production notes

- Run migrations or controlled schema updates instead of relying on `sequelize.sync()` in mature environments.
- Put the stack behind TLS termination (reverse proxy) and rotate database credentials.
