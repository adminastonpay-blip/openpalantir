# Cloudflare deployment runbook

The edge Worker and Python ontology API are separate services. Deploying the Worker does not deploy PostgreSQL, Trino, MinIO, Keycloak, or the ontology API.

## Validate locally

Requires Node.js 22+ and Python 3.12+.

```bash
npm install
npm test
npx wrangler deploy --dry-run
python -m pip install -r ontology/requirements.txt
python -m compileall -q ontology
cd ontology && python -m pytest -q
```

## Configure Worker

After authenticating Wrangler to the intended Cloudflare account, set secrets interactively:

```bash
npx wrangler secret put API_ACCESS_TOKEN
npx wrangler secret put UPSTREAM_API_TOKEN
```

Set `ONTOLOGY_API_URL` as a Worker variable to the deployed ontology API's HTTPS base URL. Set `CORS_ALLOWED_ORIGINS` to exact browser origins. Never put tokens in Wrangler config, GitHub source, logs, or Shopify theme code.

## Configure ontology service

Set `ONTOLOGY_API_KEY` in the runtime secret manager and mount the registry JSON at `ONTOLOGY_REGISTRY_PATH` (default `/data/registry/ontology.json`). The API intentionally returns 503 when auth or registry is missing; it never invents sample business records.

## GitHub Actions

CI tests and runs a Wrangler dry-run without production credentials. It intentionally does not deploy automatically. Before creating a deploy workflow, configure repository/environment secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, restrict token scope to the required account and Workers deployment permissions, and require review plus successful CI.

## Go-live checklist

- [ ] Worker tests and Wrangler dry-run pass.
- [ ] Ontology API tests pass.
- [ ] Secrets exist in the intended environment and are independent.
- [ ] HTTPS backend and bearer auth work from Cloudflare.
- [ ] CORS uses exact trusted origins.
- [ ] Staging smoke tests cover 401, 404, invalid origin, upstream timeout and authorized success.
- [ ] Observability is enabled; sensitive headers and personal data are not logged.
- [ ] Rollback/version strategy is tested before production traffic is switched.
