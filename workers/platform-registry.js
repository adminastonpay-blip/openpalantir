/**
 * OpenPalantir Cloudflare runtime registry.
 *
 * This module only reports whether a binding exists on the Worker env object.
 * It never reads binding contents, queries databases, calls external services,
 * or exposes secret values. It is safe to use for authenticated diagnostics.
 */
const GROUPS = Object.freeze([
  {
    id: "compute",
    label: "Compute and orchestration",
    capabilities: [
      { id: "workers_ai", label: "Workers AI", candidates: ["AI"] },
      { id: "browser", label: "Browser", candidates: ["Navegador", "BROWSER"] },
      { id: "service", label: "Primary service binding", candidates: ["SERVICIO PRINCIPAL", "PRIMARY_SERVICE"] },
    ],
  },
  {
    id: "retrieval",
    label: "Search and retrieval",
    capabilities: [
      { id: "vectorize", label: "Vectorize index", candidates: ["BÚSQUEDA DE IA", "BUSQUEDA_DE_IA", "VECTORIZE"] },
    ],
  },
  {
    id: "state",
    label: "State and coordination",
    capabilities: [
      { id: "aston_kv", label: "Aston KV", candidates: ["ASTON_KV"] },
      { id: "openpalantir_cache", label: "OpenPalantir cache", candidates: ["OPENPALANTIR_CACHE"] },
      { id: "openpalantir_config", label: "OpenPalantir configuration", candidates: ["CONFIGURACIÓN DE OPEN...", "OPENPALANTIR_CONFIG"] },
      { id: "agent_do", label: "Aston Agent Durable Object", candidates: ["Agente de Aston", "AstonAgent"] },
      { id: "ledger_lock_do", label: "Aston Ledger Lock Durable Object", candidates: ["AstonLedgerLock"] },
      { id: "ontology_do", label: "Aston Ontology Durable Object", candidates: ["Ontologia Aston", "OntologiaAston"] },
      { id: "rate_limiter_do", label: "Aston Rate Limiter Durable Object", candidates: ["AstonRateLimiter"] },
      { id: "voice_session_do", label: "Aston Voice Session Durable Object", candidates: ["AstonVoiceSession"] },
      { id: "session_do", label: "Aston Session Durable Object", candidates: ["Sesión de Aston", "AstonSession"] },
      { id: "orchestrator_do", label: "Aston Orchestrator Durable Object", candidates: ["Orquestador", "AstonOrchestrator"] },
    ],
  },
  {
    id: "data",
    label: "Data and persistence",
    capabilities: [
      { id: "audit_db", label: "Audit D1 database", candidates: ["BD_AUDITORIA"] },
      { id: "core_db", label: "Core D1 database", candidates: ["base de datos", "OPENPALANTIR_DB"] },
      { id: "metadata_db", label: "Metadata D1 database", candidates: ["BASE DE DATOS DE META...", "OPENPALANTIR_METADATA"] },
      { id: "operations_db", label: "Operations D1 database", candidates: ["OPERACIONES_DB"] },
      { id: "tenants_db", label: "Tenants D1 database", candidates: ["BASE DE DATOS DE INQU...", "OPENPALANTIR_TENANTS"] },
      { id: "documents_bucket", label: "Documents R2 bucket", candidates: ["CUBETA DE DOCUMENTOS"] },
      { id: "evidence_bucket", label: "Evidence R2 bucket", candidates: ["CUBETA DE PRUEBAS"] },
      { id: "ingestion_bucket", label: "Ingestion R2 bucket", candidates: ["CUBO DE INGESTIÓN"] },
      { id: "processed_bucket", label: "Processed R2 bucket", candidates: ["CUBO PROCESADO"] },
      { id: "backups_bucket", label: "Backups R2 bucket", candidates: ["Copias de seguridad d..."] },
    ],
  },
  {
    id: "events",
    label: "Events and analytics",
    capabilities: [
      { id: "global_queue", label: "Global Queue", candidates: ["COLA GLOBAL"] },
      { id: "analytics_engine", label: "Analytics Engine dataset", candidates: ["ALMACENAMIENTO ASTON"] },
      { id: "rate_limit", label: "Rate Limiting namespace", candidates: ["LIMITADOR DE TASA"] },
    ],
  },
  {
    id: "media",
    label: "Media and delivery",
    capabilities: [
      { id: "images", label: "Cloudflare Images", candidates: ["MANEJADOR_DE_IMÁGENES", "MANEJADOR_DE_IMAGENES"] },
      { id: "stream", label: "Cloudflare Stream", candidates: ["TRANSMISIÓN DE VIDEO", "STREAM"] },
      { id: "email", label: "Email service", candidates: ["SERVICIO DE CORREO ELECTRÓNICO", "EMAIL"] },
    ],
  },
]);

function isBinding(value) {
  return value !== undefined && value !== null;
}

/**
 * Resolve only binding presence. A binding is considered present even if its
 * runtime resource is temporarily unavailable; operational health is separate.
 */
export function inspectPlatformBindings(env = {}) {
  const groups = GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    capabilities: group.capabilities.map((capability) => {
      const matched = capability.candidates.find((key) => isBinding(env[key]));
      return {
        id: capability.id,
        label: capability.label,
        configured: Boolean(matched),
        matchedBinding: matched ?? null,
      };
    }),
  }));

  const all = groups.flatMap((group) => group.capabilities);
  const configured = all.filter((item) => item.configured).length;
  return Object.freeze({
    schemaVersion: 1,
    mode: "binding-presence-only",
    summary: Object.freeze({
      configured,
      unconfigured: all.length - configured,
      total: all.length,
    }),
    groups,
  });
}
