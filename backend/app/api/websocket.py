import json
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


class ConnectionManager:
    """Manages active WebSocket connections."""

    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, event: str, data: dict):
        message = json.dumps({
            "event": event,
            "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                pass


manager = ConnectionManager()


@router.websocket("/ws/dashboard")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            event = message.get("event", "")

            if event == "chat:message":
                from app.agents.analytics import analytics_agent
                user_message = message.get("data", {}).get("message", "")
                # Build context from app state
                context = {
                    "recent_alerts": list(getattr(websocket.app.state, "recent_alerts", []))[:10],
                    "recent_decisions": list(getattr(websocket.app.state, "recent_decisions", []))[:10],
                    "queue_metrics": list(getattr(websocket.app.state, "latest_metrics", {}).values()),
                }
                result = await analytics_agent.query(user_message, context)
                await websocket.send_text(json.dumps({
                    "event": "chat:response",
                    "data": {
                        "message": result.get("message", ""),
                        "reasoning": result.get("reasoning", ""),
                    },
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }))

            elif event == "chaos:inject":
                from app.services.simulation import simulation_engine
                data = message.get("data", {})
                simulation_engine.inject_chaos(data.get("type", ""), data.get("params", {}))
                await manager.broadcast("chaos:injected", data)

            elif event == "action:approve":
                decision_id = message.get("data", {}).get("decisionId")
                if decision_id:
                    from app.agents.orchestrator import orchestrator
                    ok = await orchestrator.handle_human_decision(
                        decision_id, approved=True, approver="human"
                    )
                    decisions = websocket.app.state.recent_decisions
                    await orchestrator.execute_approved_decision(decision_id, decisions)
                    await websocket.send_text(json.dumps({
                        "event": "action:approved",
                        "data": {"decisionId": decision_id, "success": ok},
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }))

            elif event == "action:reject":
                decision_id = message.get("data", {}).get("decisionId")
                if decision_id:
                    from app.agents.orchestrator import orchestrator
                    ok = await orchestrator.handle_human_decision(
                        decision_id, approved=False, approver="human"
                    )
                    await websocket.send_text(json.dumps({
                        "event": "action:rejected",
                        "data": {"decisionId": decision_id, "success": ok},
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }))

    except WebSocketDisconnect:
        manager.disconnect(websocket)
