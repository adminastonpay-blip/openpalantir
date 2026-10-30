/**
 * ASTON UNIVERSAL OS — isolated Cloudflare Worker
 * This is a separate deployment; it does not replace OpenPalantir's ontology gateway.
 */
const VERSION = "20.1.1";
const enc = new TextEncoder();
const PUBLIC_GET = new Set(["/health", "/v1/capabilities"]);

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "x-aston-version": VERSION,
      ...headers,
    },
  });
}
function cors(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map(x => x.trim()).filter(Boolean);
  const h = { "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Authorization, Content-Type, X-Tenant, X-Correlation-ID",
    "access-control-max-age": "600", vary: "Origin" };
  if (origin && allowed.includes(origin)) h["access-control-allow-origin"] = origin;
  return h;
}
async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(value)));
}
async function equal(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const [x, y] = await Promise.all([digest(a), digest(b)]);
  let d = 0; for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}
async function authenticate(request, env, path, method) {
  if (method === "GET" && PUBLIC_GET.has(path)) return { ok: true, tenant: "public", role: "public" };
  const tenant = request.headers.get("X-Tenant") || "";
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(tenant)) return { ok: false };
  const auth = request.headers.get("Authorization") || "";
  const supplied = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (env.SOVEREIGN_MASTER_KEY && await equal(supplied, env.SOVEREIGN_MASTER_KEY))
    return { ok: true, tenant, role: "sovereign" };
  let keys = {};
  try { keys = JSON.parse(env.TENANT_KEYS_JSON || "{}"); } catch { return { ok: false }; }
  if (typeof keys[tenant] === "string" && await equal(supplied, keys[tenant]))
    return { ok: true, tenant, role: "tenant" };
  return { ok: false };
}
async function readJson(request, limit = 65536) {
  const raw = await request.text();
  if (enc.encode(raw).byteLength > limit) throw new Error("payload_too_large");
  try { return raw ? JSON.parse(raw) : {}; } catch { throw new Error("invalid_json"); }
}
function correlation(request) {
  const value = request.headers.get("X-Correlation-ID") || crypto.randomUUID();
  return /^[a-zA-Z0-9._:-]{1,128}$/.test(value) ? value : crypto.randomUUID();
}
async function logEvent(env, tenant, type, payload) {
  if (!env.DB_ASTON) return { stored: false, reason: "d1_binding_not_configured" };
  await env.DB_ASTON.prepare(
    "INSERT INTO aston_events (tenant_id,event_type,payload_json,created_at) VALUES (?,?,?,?)"
  ).bind(tenant, type, JSON.stringify(payload), new Date().toISOString()).run();
  return { stored: true };
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url), headers = cors(request, env);
    if (request.method === "OPTIONS") {
      if (!headers["access-control-allow-origin"]) return json({ error: "origin_not_allowed" }, 403);
      return new Response(null, { status: 204, headers });
    }
    if (url.pathname === "/health" && request.method === "GET")
      return json({ ok: true, service: "aston-universal-os", version: VERSION }, 200, headers);
    if (url.pathname === "/v1/capabilities" && request.method === "GET")
      return json({ version: VERSION, modules: ["workers-ai", "durable-object-tasks", "d1-events-optional", "r2-documents-optional"],
        bindings: { ai: !!env.AI, task_namespace: !!env.MALLA_DE_ENJAMBRE,
          d1: !!env.DB_ASTON, r2: !!env.CUBETA_DE_DOCUMENTOS } }, 200, headers);

    const identity = await authenticate(request, env, url.pathname, request.method);
    if (!identity.ok) return json({ error: "unauthorized" }, 401, { "www-authenticate": "Bearer", ...headers });
    const tenant = identity.tenant, trace = correlation(request);
    try {
      if (url.pathname === "/v1/ai" && request.method === "POST") {
        if (!env.AI) return json({ error: "workers_ai_binding_missing" }, 503, headers);
        const body = await readJson(request, 32768);
        const prompt = String(body.prompt || "").trim();
        if (!prompt || prompt.length > 12000) return json({ error: "prompt_required_or_too_long" }, 400, headers);
        const model = String(body.model || env.ASTON_AI_MODEL || "@cf/meta/llama-3.1-8b-instruct");
        const allowed = ["@cf/meta/llama-3.1-8b-instruct", "@cf/meta/llama-3.3-70b-instruct-fp8-fast"];
        if (!allowed.includes(model)) return json({ error: "model_not_allowlisted" }, 400, headers);
        const result = await env.AI.run(model, { prompt, max_tokens: Math.min(Number(body.max_tokens) || 1000, 1800) });
        await logEvent(env, tenant, "ai_inference", { model, correlation_id: trace, prompt_length: prompt.length });
        return json({ ok: true, model, result, tenant, correlation_id: trace }, 200, headers);
      }
      if (url.pathname === "/v1/swarm/tasks" && request.method === "POST") {
        if (!env.MALLA_DE_ENJAMBRE) return json({ error: "durable_object_binding_missing" }, 503, headers);
        const body = await readJson(request, 32768);
        const task = { id: crypto.randomUUID(), tenant, type: String(body.type || "task").slice(0, 80),
          payload: body.payload ?? {}, status: "accepted", created_at: new Date().toISOString() };
        const stub = env.MALLA_DE_ENJAMBRE.get(env.MALLA_DE_ENJAMBRE.idFromName(tenant));
        const result = await stub.fetch("https://aston.internal/task", {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(task) });
        const data = await result.json();
        return json(data, result.status, headers);
      }
      if (url.pathname === "/v1/events" && request.method === "POST") {
        const body = await readJson(request, 32768);
        const result = await logEvent(env, tenant, String(body.type || "event").slice(0, 80), body);
        return json({ ok: true, ...result, tenant, correlation_id: trace }, 200, headers);
      }
      if (url.pathname === "/v1/documents" && request.method === "POST") {
        if (!env.CUBETA_DE_DOCUMENTOS) return json({ error: "r2_binding_missing" }, 503, headers);
        const body = await readJson(request, 5_250_000);
        const key = String(body.key || "").replace(/^\/+/, "");
        const content = String(body.content || "");
        if (!key || key.includes("..") || !content || content.length > 5_000_000)
          return json({ error: "valid_key_and_content_required" }, 400, headers);
        const objectKey = `tenants/${tenant}/${key}`;
        await env.CUBETA_DE_DOCUMENTOS.put(objectKey, content, { httpMetadata: { contentType: "text/plain; charset=utf-8" } });
        return json({ ok: true, key: objectKey }, 201, headers);
      }
      return json({ error: "not_found" }, 404, headers);
    } catch (error) {
      const status = error.message === "payload_too_large" ? 413 : error.message === "invalid_json" ? 400 : 502;
      return json({ error: status === 502 ? "operation_failed" : error.message, correlation_id: trace }, status, headers);
    }
  },
};

export class AstonTaskObject {
  constructor(state) { this.state = state; }
  async fetch(request) {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/task")
      return json({ error: "not_found" }, 404);
    const task = await readJson(request, 32768);
    if (!task.id || !task.tenant) return json({ error: "invalid_task" }, 400);
    await this.state.storage.put(task.id, task);
    const index = await this.state.storage.get("index") || [];
    index.unshift(task.id);
    await this.state.storage.put("index", index.slice(0, 500));
    return json({ ok: true, task });
  }
}
