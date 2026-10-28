"""Read-only ontology registry API; no fabricated business records are seeded."""
import hmac
import json
import os
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, status

app = FastAPI(title="OpenPalantir Ontology API", version="1.0.0", docs_url=None, redoc_url=None, openapi_url=None)


def registry_path() -> Path:
    return Path(os.getenv("ONTOLOGY_REGISTRY_PATH", "/data/registry/ontology.json"))


async def require_api_key(authorization: str | None = Header(default=None)) -> None:
    expected = os.getenv("ONTOLOGY_API_KEY", "")
    if not expected:
        raise HTTPException(status_code=503, detail="API authentication is not configured")
    supplied = authorization[7:] if authorization and authorization.startswith("Bearer ") else ""
    if not supplied or not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized",
                            headers={"WWW-Authenticate": "Bearer"})


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "ontology-api"}


@app.get("/ready")
async def ready() -> dict[str, str]:
    if not os.getenv("ONTOLOGY_API_KEY"):
        raise HTTPException(status_code=503, detail="Authentication is not configured")
    if not registry_path().is_file():
        raise HTTPException(status_code=503, detail="Ontology registry is not configured")
    return {"status": "ready"}


@app.get("/v1/objects", dependencies=[Depends(require_api_key)])
async def list_objects() -> dict[str, Any]:
    path = registry_path()
    if not path.is_file():
        raise HTTPException(status_code=503, detail="Ontology registry is not configured")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        raise HTTPException(status_code=503, detail="Ontology registry is unavailable") from None
    objects = payload.get("objects", []) if isinstance(payload, dict) else payload
    if not isinstance(objects, list):
        raise HTTPException(status_code=503, detail="Ontology registry has an invalid format")
    return {"items": objects, "count": len(objects), "source": "configured_registry"}


def schema_path() -> Path:
    return Path(os.getenv("ONTOLOGY_SCHEMA_V2_PATH", "/data/registry/ontology-schema-v2.json"))


@app.get("/v2/ontology", dependencies=[Depends(require_api_key)])
async def get_ontology_v2() -> dict[str, Any]:
    """Read-only, opt-in ontology schema endpoint. No inferred or seeded business data."""
    if os.getenv("ENABLE_ONTOLOGY_V2", "false").lower() != "true":
        raise HTTPException(status_code=404, detail="Ontology API v2 is not enabled")
    path = schema_path()
    if not path.is_file():
        raise HTTPException(status_code=503, detail="Ontology v2 schema is not configured")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        raise HTTPException(status_code=503, detail="Ontology v2 schema is unavailable") from None
    if not isinstance(payload, dict):
        raise HTTPException(status_code=503, detail="Ontology v2 schema has an invalid format")
    if not isinstance(payload.get("schemaVersion"), str) or not payload["schemaVersion"].strip():
        raise HTTPException(status_code=503, detail="Ontology v2 schema version is invalid")
    for key in ("objectTypes", "linkTypes"):
        if not isinstance(payload.get(key), list):
            raise HTTPException(status_code=503, detail=f"Ontology v2 {key} must be a list")
    object_types = payload["objectTypes"]
    link_types = payload["linkTypes"]
    all_types = object_types + link_types
    type_ids: list[str] = []
    for item in all_types:
        if not isinstance(item, dict) or not isinstance(item.get("id"), str) or not item["id"].strip():
            raise HTTPException(status_code=503, detail="Ontology v2 schema contains an invalid type")
        type_ids.append(item["id"])
        properties = item.get("properties", [])
        if not isinstance(properties, list):
            raise HTTPException(status_code=503, detail="Ontology v2 type properties must be a list")
        property_names: list[str] = []
        for prop in properties:
            if not isinstance(prop, dict) or not isinstance(prop.get("name"), str) or not prop["name"].strip():
                raise HTTPException(status_code=503, detail="Ontology v2 schema contains an invalid property")
            property_names.append(prop["name"])
        if len(property_names) != len(set(property_names)):
            raise HTTPException(status_code=503, detail="Ontology v2 schema contains duplicate property names")
    if len(type_ids) != len(set(type_ids)):
        raise HTTPException(status_code=503, detail="Ontology v2 schema contains duplicate type IDs")
    object_type_ids = {item["id"] for item in object_types}
    for link in link_types:
        if not isinstance(link.get("source"), str) or link["source"] not in object_type_ids:
            raise HTTPException(status_code=503, detail="Ontology v2 link source must reference an object type")
        if not isinstance(link.get("target"), str) or link["target"] not in object_type_ids:
            raise HTTPException(status_code=503, detail="Ontology v2 link target must reference an object type")
    provenance = payload.get("provenancePolicy", {})
    if (
        not isinstance(provenance, dict)
        or provenance.get("required") is not True
        or not isinstance(provenance.get("fields"), list)
        or not provenance["fields"]
        or any(not isinstance(field, str) or not field.strip() for field in provenance["fields"])
    ):
        raise HTTPException(status_code=503, detail="Ontology v2 provenance policy must require named fields")
    if len(provenance["fields"]) != len(set(provenance["fields"])):
        raise HTTPException(status_code=503, detail="Ontology v2 provenance fields must be unique")
    return {
        "schemaVersion": payload["schemaVersion"],
        "objectTypes": payload["objectTypes"],
        "linkTypes": payload["linkTypes"],
        "provenancePolicy": provenance,
        "source": "configured_schema",
        "readOnly": True,
    }
