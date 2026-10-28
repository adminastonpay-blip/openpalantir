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
