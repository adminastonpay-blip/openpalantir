# OpenPalantir staging deployment

This workflow is deliberately manual and targets only the isolated Worker `openpalantir-staging`. It cannot deploy production: the job requires the `main` ref and an explicit `deploy-staging` confirmation input.

## Prerequisites

1. Review and merge the pull request that introduces this workflow and the isolated Wrangler environment.
2. In GitHub repository Settings → Environments, create/review the `staging` environment.
3. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as environment secrets. Scope the token to the correct account and minimum Workers deployment permissions. Never commit or paste the values into code or chat.
4. Configure the runtime secrets `API_ACCESS_TOKEN` and `UPSTREAM_API_TOKEN` on the Cloudflare Worker `openpalantir-staging` separately. Configure a valid HTTPS `ONTOLOGY_API_URL` and exact `CORS_ALLOWED_ORIGINS` for staging before testing protected API routes. The deployment workflow does not create or copy runtime secrets.
5. Keep `ENABLE_API_V2` disabled. The staging config explicitly sets it to `false`.

## Execute

In GitHub → Actions → Deploy OpenPalantir staging → Run workflow, select branch `main`, and choose `deploy-staging` only when intentionally publishing to staging. The workflow runs Worker tests and a Wrangler dry-run before deployment, then records Cloudflare deployment metadata.

## Acceptance checklist

- [ ] Workflow completes successfully with the expected commit.
- [ ] Cloudflare deployment metadata identifies the newly published staging version.
- [ ] The staging `/health` endpoint responds successfully.
- [ ] Unauthenticated ontology requests are rejected.
- [ ] An authorized request succeeds only when the upstream is correctly configured.
- [ ] Invalid CORS origin, upstream timeout, and unavailable upstream fail safely.
- [ ] Rollback/version procedure is documented and tested.
- [ ] No production Worker was changed.

A green CI or successful dry-run alone is not proof of deployment. Record deployment evidence and smoke-test results before marking staging verified.
