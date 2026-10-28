import test from "node:test";
import assert from "node:assert/strict";
import worker from "../workers/index.js";

const req = (path, init = {}) => new Request("https://edge.example.test" + path, init);

test("health endpoint returns JSON and no-store", async () => {
  const response = await worker.fetch(req("/health"), {});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "ok");
  assert.equal(response.headers.get("cache-control"), "no-store");
});
test("unknown routes are not exposed", async () => {
  assert.equal((await worker.fetch(req("/admin"), {})).status, 404);
});
test("protected API fails closed when secret is absent", async () => {
  assert.equal((await worker.fetch(req("/api/ontology/objects"), {})).status, 503);
});
test("protected API rejects missing credentials", async () => {
  const response = await worker.fetch(req("/api/ontology/objects"), { API_ACCESS_TOKEN: "expected" });
  assert.equal(response.status, 401);
});
test("preflight rejects unconfigured origins", async () => {
  const response = await worker.fetch(req("/api/ontology/objects", {
    method: "OPTIONS", headers: { Origin: "https://attacker.example" }
  }), { CORS_ALLOWED_ORIGINS: "https://app.example" });
  assert.equal(response.status, 403);
});
