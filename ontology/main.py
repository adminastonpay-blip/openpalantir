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
