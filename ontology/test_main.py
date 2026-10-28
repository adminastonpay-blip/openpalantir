import json
from fastapi.testclient import TestClient
import main

client = TestClient(main.app)

def test_health_is_liveness_only():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_objects_fail_closed_without_api_key(monkeypatch, tmp_path):
    monkeypatch.delenv("ONTOLOGY_API_KEY", raising=False)
    monkeypatch.setenv("ONTOLOGY_REGISTRY_PATH", str(tmp_path / "ontology.json"))
    assert client.get("/v1/objects").status_code == 503

def test_objects_require_bearer_token(monkeypatch, tmp_path):
    registry = tmp_path / "ontology.json"
    registry.write_text(json.dumps({"objects": [{"type": "Customer"}]}), encoding="utf-8")
    monkeypatch.setenv("ONTOLOGY_API_KEY", "test-secret")
    monkeypatch.setenv("ONTOLOGY_REGISTRY_PATH", str(registry))
    assert client.get("/v1/objects").status_code == 401
    response = client.get("/v1/objects", headers={"Authorization": "Bearer test-secret"})
    assert response.status_code == 200
    assert response.json()["count"] == 1


def test_ontology_v2_disabled_by_default(monkeypatch):
    monkeypatch.setenv("ONTOLOGY_API_KEY", "test-secret")
    monkeypatch.delenv("ENABLE_ONTOLOGY_V2", raising=False)
    response = client.get("/v2/ontology", headers={"Authorization": "Bearer test-secret"})
    assert response.status_code == 404


def test_ontology_v2_returns_configured_schema_only(monkeypatch, tmp_path):
    schema = tmp_path / "schema.json"
    schema.write_text(json.dumps({
        "schemaVersion": "2.0.0",
        "objectTypes": [{"id": "Customer", "properties": [{"name": "external_id", "type": "string"}]}],
        "linkTypes": [{"id": "PLACED", "source": "Customer", "target": "Order"}],
        "provenancePolicy": {"required": True, "fields": ["source", "createdAt", "createdBy", "transformations"]}
    }), encoding="utf-8")
    monkeypatch.setenv("ONTOLOGY_API_KEY", "test-secret")
    monkeypatch.setenv("ENABLE_ONTOLOGY_V2", "true")
    monkeypatch.setenv("ONTOLOGY_SCHEMA_V2_PATH", str(schema))
    response = client.get("/v2/ontology", headers={"Authorization": "Bearer test-secret"})
    assert response.status_code == 200
    body = response.json()
    assert body["schemaVersion"] == "2.0.0"
    assert body["objectTypes"][0]["id"] == "Customer"
    assert body["linkTypes"][0]["id"] == "PLACED"
    assert body["provenancePolicy"]["required"] is True
    assert body["readOnly"] is True
    assert body["source"] == "configured_schema"


def test_ontology_v2_fails_closed_for_invalid_schema(monkeypatch, tmp_path):
    schema = tmp_path / "schema.json"
    schema.write_text(json.dumps({"schemaVersion": "2.0.0", "objectTypes": [], "linkTypes": [],
                                  "provenancePolicy": {"required": False}}), encoding="utf-8")
    monkeypatch.setenv("ONTOLOGY_API_KEY", "test-secret")
    monkeypatch.setenv("ENABLE_ONTOLOGY_V2", "true")
    monkeypatch.setenv("ONTOLOGY_SCHEMA_V2_PATH", str(schema))
    response = client.get("/v2/ontology", headers={"Authorization": "Bearer test-secret"})
    assert response.status_code == 503

def test_ontology_v2_rejects_dangling_link_and_duplicate_ids(monkeypatch, tmp_path):
    schema = tmp_path / "schema.json"
    schema.write_text(json.dumps({
        "schemaVersion": "2.0.0",
        "objectTypes": [{"id": "Customer"}, {"id": "Customer"}],
        "linkTypes": [{"id": "PLACED", "source": "Customer", "target": "Missing"}],
        "provenancePolicy": {"required": True, "fields": ["source"]}
    }), encoding="utf-8")
    monkeypatch.setenv("ONTOLOGY_API_KEY", "test-secret")
    monkeypatch.setenv("ENABLE_ONTOLOGY_V2", "true")
    monkeypatch.setenv("ONTOLOGY_SCHEMA_V2_PATH", str(schema))
    response = client.get("/v2/ontology", headers={"Authorization": "Bearer test-secret"})
    assert response.status_code == 503


def test_ontology_v2_rejects_invalid_provenance_fields(monkeypatch, tmp_path):
    schema = tmp_path / "schema.json"
    schema.write_text(json.dumps({
        "schemaVersion": "2.0.0",
        "objectTypes": [{"id": "Customer"}],
        "linkTypes": [],
        "provenancePolicy": {"required": True, "fields": []}
    }), encoding="utf-8")
    monkeypatch.setenv("ONTOLOGY_API_KEY", "test-secret")
    monkeypatch.setenv("ENABLE_ONTOLOGY_V2", "true")
    monkeypatch.setenv("ONTOLOGY_SCHEMA_V2_PATH", str(schema))
    response = client.get("/v2/ontology", headers={"Authorization": "Bearer test-secret"})
    assert response.status_code == 503
