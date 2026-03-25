from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request

from app.api.websocket import manager

router = APIRouter()


@router.get("/alerts")
async def list_alerts(request: Request):
    """List active and recent alerts."""
    return {"alerts": list(request.app.state.recent_alerts)}


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str, request: Request):
    """Acknowledge an alert and mark it resolved."""
    alerts = request.app.state.recent_alerts
    for alert in alerts:
        if alert.get("id") == alert_id:
            alert["resolvedAt"] = datetime.now(timezone.utc).isoformat()
            alert["resolvedBy"] = "human"
            await manager.broadcast("alert:resolved", {"id": alert_id})
            return {"status": "acknowledged", "id": alert_id}
    raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found")
