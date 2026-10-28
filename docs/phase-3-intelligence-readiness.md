# Phase 3 — Operational Intelligence Readiness

## Status

Planning and safety contract only. This document does not enable API v2, change production configuration, or deploy the Worker.

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
