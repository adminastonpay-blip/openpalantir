# ASTON Universal OS Worker (isolated deployment)

This Worker is deployed separately from the OpenPalantir ontology gateway. It does not replace or alter workers/index.js.

## Included
- Cloudflare Workers AI binding (AI)
- Tenant-scoped Durable Object task registry (MALLA_DE_ENJAMBRE)
- Optional D1 event persistence (DB_ASTON)
- Optional R2 document storage (CUBETA_DE_DOCUMENTOS)
- Fail-closed authentication using TENANT_KEYS_JSON or SOVEREIGN_MASTER_KEY
- Exact-origin CORS allowlist

## Configure secrets in the ASTON Worker environment
- TENANT_KEYS_JSON: JSON object mapping tenant IDs to distinct bearer tokens, e.g. {"tenant-a":"LONG_RANDOM_SECRET"}. Store as a Cloudflare secret, never in source.
- SOVEREIGN_MASTER_KEY: optional root bearer secret. Restrict its use.
- ALLOWED_ORIGINS: exact comma-separated browser origins as a variable.

Optional bindings:
- D1 database binding named DB_ASTON; apply workers/aston/schema.sql.
- R2 bucket binding named CUBETA_DE_DOCUMENTOS.

## Validate
- npm test
- npx wrangler deploy --dry-run --config wrangler.aston.toml

## Deploy
Authenticate Wrangler to the intended Cloudflare account, configure the secrets and optional bindings, then deploy with:
npx wrangler deploy --config wrangler.aston.toml

A successful dry-run is not a production deployment. The Worker cannot access the existing OpenPalantir upstream API unless separately configured. No production secrets are stored in this repository.
