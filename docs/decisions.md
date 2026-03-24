# Design decisions

## Why PostgreSQL?

- Strong consistency for pipeline configuration, job history, and delivery audit data.
- pg-boss reuses the same engine, so operators manage one primary datastore instead of Redis + Postgres.
- JSONB fits webhook payloads and action results without a rigid schema per integration.

## Why pg-boss instead of an in-memory queue?

- Durability across process restarts and horizontal scaling potential.
- Aligns with the requirement that the **API never processes jobs**—work must cross a durable boundary.
- Keeps operational footprint small for a class project while still demonstrating real queue semantics.

## Why asynchronous processing?

- Webhook providers expect quick acknowledgements; long-running transforms or slow subscriber endpoints should not block ingestion.
- Failures in downstream HTTP calls can be retried without making the original webhook request hang or time out.

## Additional schema fields

- **`jobs.error_message`**: not in the original sketch but added to surface worker failures in the API/DB without losing context.
- **`delivery_attempts.error_detail`**: stores HTTP status text or network errors per try, satisfying the “log every attempt” requirement readably.

## Typing & validation

- **Express Validator** centralizes input checks (UUID params, enums, URLs).
- Actions are **pure functions** to stay testable and avoid hidden side effects.

## Subscriber soft delete (`deleted_at`)

- **`DELETE /pipelines/:id/subscribers/:subId`** sets `deleted_at` instead of removing the row (Sequelize **paranoid** mode).
- **Why:** `delivery_attempts` references `subscriber_id`. Hard-deleting subscribers can break referential integrity or force cascading deletes that erase audit history. Keeping the row preserves FK validity and past delivery rows while clearly marking the endpoint as inactive.
- **Delivery & listing:** Default Sequelize scopes exclude rows with `deleted_at` set, so the worker never POSTs to soft-deleted URLs and API lists only active subscribers.

## Web tester (`public/demo.html`)

- A **single static page** served by Express (`express.static`) so operators can run **`docker compose up`** and immediately open **`http://localhost:3000`** to drive pipelines, webhooks, and jobs without Postman or `curl`.
- Checklist state lives in **`localStorage`** only (no backend session).
- Same-origin **`fetch`** avoids CORS configuration.

## Trade-offs

- `sequelize.sync()` on boot is convenient for `docker compose up` but is not a substitute for versioned migrations in production.
- Subscriber delivery uses `Promise.all`; independent subscribers fail in parallel—acceptable for moderate fan-out.
