# OpenPalantir

OpenPalantir is an experimental, modular foundation for an ontology-backed operational intelligence platform. It is not a Palantir product and does not claim feature parity with Palantir.

## Components
- **Cloudflare Worker** (`workers/index.js`): health endpoint and authenticated HTTPS gateway to an independently hosted ontology API.
- **Ontology API** (`ontology/main.py`): read-only registry endpoint; fails closed if its API key or registry is not configured.
- **OPA policy** (`configs/opa/policy.rego`): deny-by-default tenant and permission check. It requires trusted, validated identity input; it is not an identity provider.
- **CI**: Node tests, Wrangler dry-run, Python compilation and API tests.

## Validate

Requires Node.js 22+ and Python 3.12+.

```bash
npm install
npm test
npx wrangler deploy --dry-run
python -m pip install -r ontology/requirements.txt
python -m compileall -q ontology
cd ontology && python -m pytest -q
```

See [Cloudflare deployment runbook](docs/cloudflare-deploy.md) and [Security Policy](SECURITY.md). CI does not deploy production automatically.

## Limitations

This is a foundation, not a complete enterprise platform. It does not yet provide production identity-provider integration, database migrations, data connectors, event lineage, policy decision-point integration, or a production deployment pipeline. The health endpoint does not prove that business data is connected.


## API versioning and feature flags

The existing `/api/ontology/*` route remains v1 by default. Existing clients that do not request a version continue to be routed to the upstream `/v1/*` API.

An opt-in v2 request uses:

```http
Accept: application/vnd.openpalantir.v2+json
```

V2 is disabled unless the Worker environment explicitly sets `ENABLE_API_V2=true`. When disabled, a v2 request returns `404 api_version_not_enabled`; it does not fall back to v1. This prevents a client from unknowingly receiving a different schema.

To enable v2 for a test/staging environment only, configure `ENABLE_API_V2=true` there after the upstream API has implemented and tested `/v2/*`. Do not enable it in production until compatibility tests and an explicit rollout decision are complete. Credentials must be stored as Cloudflare secrets, not in this file.

The current flag is environment-wide. Tenant-level flags must wait until the gateway has a trusted tenant identity; an unverified client-supplied `X-Tenant` header is not an authorization boundary.

The rollout rules above are the compatibility contract for this initial version.
