# Phase 3 — Operational Intelligence Readiness

## Status

Implementation in progress on an isolated branch. The first increment adds an opt-in signed tenant-identity gate and regression tests. It does not enable the gate in production, enable API v2, or deploy the Worker.

## Why this phase is gated

The current platform exposes a read-only registry and an opt-in ontology schema. The gateway authenticates a shared bearer token, but it does not yet establish a trusted end-user principal or enforce tenant-scoped authorization. The OPA policy is deny-by-default and requires trusted identity input; it is not itself an identity provider.

Until trusted identity and tenant scope are implemented and verified, an analytics endpoint must not aggregate registry data across tenants or treat a client-supplied tenant header as authorization.

## Phase 3 target

Add read-only operational intelligence over explicitly configured, real source data. No synthetic/demo business records and no inferred values presented as facts.

### Increment sequence

1. **Identity and tenant boundary prerequisite**
   - Define a trusted principal contract supplied only by a validated authentication layer.
   - Bind each request to one tenant from that trusted principal, not from an untrusted request header.
   - Fail closed when identity, tenant, permission, or policy evaluation is missing or invalid.
   - Add negative tests proving cross-tenant access is denied.

2. **Read-only query contract**
   - Add bounded, typed query inputs with pagination and strict maximums.
   - Keep existing v1 routes and response shapes backward compatible.
   - Keep v2 disabled unless explicitly enabled in a non-production environment.

3. **Provenance-first insights**
   - Every returned metric must identify its configured source and observation time when the source provides one.
   - Distinguish unavailable, empty, stale, and valid data; never substitute demo values.
   - Return only fields authorized for the resolved tenant and permission set.
   - Do not log bearer tokens, personal data, or raw query payloads.

4. **Validation before rollout**
   - Unit tests for malformed input, bounds, empty/missing registry, source errors, provenance, and authorization.
   - Integration tests for unauthorized, wrong-tenant, insufficient-permission, and successful read-only requests.
   - Wrangler dry-run and the full repository CI must pass.
   - Deploy to staging first, run smoke tests, and record the deployed commit before considering production.

## Explicit non-goals

- No writes, mutations, workflow execution, autonomous agents, or payment actions.
- No activation of `ENABLE_API_V2` or `ENABLE_ONTOLOGY_V2`.
- No production deployment from CI.
- No claim of production readiness or Palantir feature parity.


## Implemented in this branch

- Added `workers/tenant-identity.js` to validate HS256-signed identity tokens.
- Identity claims require configured issuer and audience, an unexpired `exp`, valid optional `nbf`, a bounded subject and tenant identifier, and the `ontology:read` permission.
- The gateway applies the identity gate only when `ENABLE_TENANT_AUTH=true`; missing or incomplete identity configuration fails closed.
- When the gate is enabled, the gateway derives `X-Aston-Tenant` exclusively from the verified signed claim. A client-supplied tenant header is not forwarded as authorization.
- Added tests for missing identity, expired/tampered tokens, insufficient permission, incomplete configuration, and tenant-header spoofing.
- The feature remains opt-in. Existing behavior remains unchanged while `ENABLE_TENANT_AUTH` is unset or not `true`.

## Required configuration before any non-production enablement

Set these Worker variables/secrets only after the trusted identity issuer is implemented and configured:
- `ENABLE_TENANT_AUTH=true` (enable only in a non-production environment first)
- `TENANT_IDENTITY_SECRET` (secret, at least 32 characters; never commit it)
- `TENANT_IDENTITY_ISSUER` (exact trusted issuer)
- `TENANT_IDENTITY_AUDIENCE` (exact API audience)

The token must be issued by a trusted authentication service. Do not create identity tokens in the browser or let a caller choose its own tenant claim. This shared-HMAC contract is a first integration step, not a replacement for an identity provider, key rotation, or a full authorization review.
