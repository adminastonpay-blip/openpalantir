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
