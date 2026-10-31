from datetime import datetime, timezone

from fastapi import APIRouter, Request, Response

from app.schemas.responses import HealthResponse, ServiceHealth

router = APIRouter(prefix="/api")


@router.get("/health", response_model=HealthResponse)
def health(request: Request, response: Response):
    services = {}
    mongo = request.app.state.mongo
    cassandra = request.app.state.cassandra
    try:
        services["mongodb"] = ServiceHealth(ok=True, latency_ms=mongo.ping())
    except Exception:
        services["mongodb"] = ServiceHealth(ok=False, detail="MongoDB is unreachable.")
    try:
        services["cassandra"] = ServiceHealth(
            ok=True, latency_ms=cassandra.ping()
        )
    except Exception:
        services["cassandra"] = ServiceHealth(ok=False, detail="Cassandra is unreachable.")
    ok = all(service.ok for service in services.values())
    if not ok:
        response.status_code = 503
    return {
        "status": "ok" if ok else "degraded",
        "services": services,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
