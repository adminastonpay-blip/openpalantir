#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "=== OpenPalantir — starting CORE profile ==="

if [ ! -f .env ]; then
  echo "Creating .env from .env.example..."
  cp .env.example .env
fi

echo "Building ontology-api image..."
docker compose build ontology-api

echo "Starting core services..."
docker compose --profile core up -d

echo ""
echo "=== Services ==="
echo "  Ontology API:  http://localhost:8000/docs"
echo "  Trino:         http://localhost:8080"
echo "  MinIO Console: http://localhost:9001  (minioadmin / minioadmin)"
echo "  Keycloak:      http://localhost:8180  (admin / admin)"
echo "  Grafana:       http://localhost:3001  (admin / admin)"
echo "  Prometheus:    http://localhost:9090"
echo ""
echo "Health check Ontology:"
sleep 5
curl -s http://localhost:8000/health || echo "(waiting for ontology-api...)"
echo ""
echo "Done. Run 'docker compose --profile core logs -f' to follow logs."
