# Cómo extender OpenPalantir

## 1. Añadir un nuevo Object Type

1. Edita `ontology/main.py` (SEED_ONTOLOGY) o el archivo `/data/registry/ontology.json` que genera el servicio.
2. Reinicia el servicio `ontology-api`.
3. (Opcional) Añade transformaciones dbt que materialicen una vista `ontology.<ObjectType>` en Trino.

## 2. Conectar Helix Foundry como backend de ontología

```bash
cd helix-foundry   # o clona https://github.com/HelixDB/helix-foundry
./scripts/setup.sh --compose
```

Luego modifica el Ontology Layer para que haga proxy de queries hacia HelixDB en lugar del store in-memory.

## 3. Añadir OSIRIS (capa Gotham / inteligencia)

```bash
git clone https://github.com/simplifaisoul/osiris.git
cd osiris
cp .env.template .env
docker compose up -d
```

Abre http://localhost:3000. Integra en el portal mediante iframe o API.

## 4. Añadir Airbyte + Dagster (pipelines completos)

Usa los docker-compose oficiales de Airbyte y Dagster y conéctalos a MinIO + Trino.
Documentación oficial:
- https://docs.airbyte.com
- https://docs.dagster.io

## 5. Portal unificado (recomendado)

Despliega Backstage y crea plugins para:
- Ontology Explorer
- Pipeline status
- Superset embeds
- OSIRIS map
- AI chat

## 6. Producción

- Sustituye el store in-memory del Ontology Layer por Postgres + HelixDB/Neo4j.
- Añade TLS, secrets management (Vault / SOPS).
- Despliega con Helm + ArgoCD.
- Implementa políticas OPA reales (row-level, markings).
