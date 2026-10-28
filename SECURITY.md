# Security Policy

Report vulnerabilities privately through GitHub's private vulnerability reporting feature when enabled. Do not publish exploit details, credentials, personal data, or sensitive production URLs in public issues.

Deployment requirements:
- Store tokens in Cloudflare Worker secrets or GitHub Actions secrets; never commit them.
- Use least-privilege, account-scoped Cloudflare API tokens.
- Configure independent strong values for `API_ACCESS_TOKEN`, `UPSTREAM_API_TOKEN`, and `ONTOLOGY_API_KEY`.
- Point `ONTOLOGY_API_URL` only to an HTTPS origin you control.
- Set `CORS_ALLOWED_ORIGINS` to exact trusted origins, never a wildcard for authenticated APIs.
- Keep production deployment manual until CI and staging smoke tests pass.
- Do not log authorization headers, request bodies, or personal data.
