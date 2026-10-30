# Cloudflare runtime integration

## Runtime registry

`workers/platform-registry.js` provides a binding-presence registry for the
Cloudflare resources visible in the OpenPalantir Worker settings screenshots.

It is deliberately read-only:
- checks whether a candidate binding key exists on the Worker `env` object;
- never reads data from D1, KV, R2, Vectorize, Queues or Durable Objects;
- never returns secret values;
- does not claim that a configured binding is operationally healthy.

The Spanish labels visible in the Cloudflare dashboard are retained as
candidate keys alongside conventional environment identifiers. The exact
binding identifiers must be confirmed against Wrangler/runtime configuration
before wiring individual adapters.

## Adapter boundaries

The runtime is organized into capability domains:
- compute and orchestration: Workers AI, Browser, service bindings;
- retrieval: Vectorize;
- state: KV and Durable Objects;
- persistence: D1 and R2;
- events: Queues, Analytics Engine and Rate Limiting;
- media: Images, Stream and Email.

Each future adapter must be independently testable and must fail closed when
its binding is absent. No adapter may create, migrate, rename or delete a
Cloudflare resource automatically.

## Activation sequence

1. Confirm actual runtime binding identifiers against the dashboard.
2. Add adapters one domain at a time behind explicit feature flags.
3. Run unit tests and Wrangler dry-run in the staging environment.
4. Exercise read-only integration tests using non-production data.
5. Promote only after review and explicit production approval.

## Important distinction

Binding presence is configuration evidence, not a health check. A real
readiness probe must perform a narrowly scoped, non-destructive operation and
must report dependency failure separately. Secrets and tenant data must never
be included in diagnostics.
