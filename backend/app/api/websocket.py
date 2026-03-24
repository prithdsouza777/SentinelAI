import asyncio
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse

logger = logging.getLogger("sentinelai.websocket")

router = APIRouter()


class ConnectionManager:
    """Manages active WebSocket connections and SSE subscribers."""

    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self.sse_queues: list[asyncio.Queue] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    def add_sse(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=200)
        self.sse_queues.append(q)
        return q

    def remove_sse(self, q: asyncio.Queue):
        if q in self.sse_queues:
            self.sse_queues.remove(q)

    async def broadcast(self, event: str, data: dict):
        message = json.dumps({
            "event": event,
            "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        # WebSocket clients
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.debug("WS send failed: %s", e)
        # SSE subscribers
        for q in self.sse_queues:
            try:
                q.put_nowait(message)
            except asyncio.QueueFull:
                pass  # drop oldest events for slow clients


manager = ConnectionManager()


@router.websocket("/ws/dashboard")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                logger.warning("WS received invalid JSON: %s", data[:200])
                continue

            event = message.get("event", "")

            try:
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

            except Exception as e:
                logger.exception("Error handling WS event '%s': %s", event, e)
                try:
                    await websocket.send_text(json.dumps({
                        "event": "error",
                        "data": {"message": f"Server error handling {event}"},
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }))
                except Exception:
                    pass

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.exception("WebSocket connection error: %s", e)
    finally:
        manager.disconnect(websocket)


@router.post("/api/ws-action")
async def ws_action(request: Request):
    """HTTP fallback for client-to-server actions when WebSocket is unavailable."""
    body = await request.json()
    event = body.get("event", "")
    data = body.get("data", {})

    if event == "chat:message":
        from app.agents.analytics import analytics_agent
        user_message = data.get("message", "")
        context = {
            "recent_alerts": list(getattr(request.app.state, "recent_alerts", []))[:10],
            "recent_decisions": list(getattr(request.app.state, "recent_decisions", []))[:10],
            "queue_metrics": list(getattr(request.app.state, "latest_metrics", {}).values()),
        }
        result = await analytics_agent.query(user_message, context)
        response_msg = {
            "event": "chat:response",
            "data": {"message": result.get("message", ""), "reasoning": result.get("reasoning", "")},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        # Broadcast to SSE subscribers too
        await manager.broadcast("chat:response", response_msg["data"])
        return response_msg

    elif event == "action:approve":
        decision_id = data.get("decisionId")
        if decision_id:
            from app.agents.orchestrator import orchestrator
            ok = await orchestrator.handle_human_decision(decision_id, approved=True, approver="human")
            decisions = request.app.state.recent_decisions
            await orchestrator.execute_approved_decision(decision_id, decisions)
            return {"event": "action:approved", "data": {"decisionId": decision_id, "success": ok}}

    elif event == "action:reject":
        decision_id = data.get("decisionId")
        if decision_id:
            from app.agents.orchestrator import orchestrator
            ok = await orchestrator.handle_human_decision(decision_id, approved=False, approver="human")
            return {"event": "action:rejected", "data": {"decisionId": decision_id, "success": ok}}

    elif event == "chaos:inject":
        from app.services.simulation import simulation_engine
        simulation_engine.inject_chaos(data.get("type", ""), data.get("params", {}))
        await manager.broadcast("chaos:injected", data)
        return {"status": "injected"}

    return {"status": "unknown event"}


@router.get("/api/stream")
async def sse_stream(request: Request):
    """Server-Sent Events fallback for environments that block WebSocket (e.g. App Runner)."""
    q = manager.add_sse()

    async def event_generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    message = await asyncio.wait_for(q.get(), timeout=15)
                    yield f"data: {message}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"  # prevent proxy timeout
        finally:
            manager.remove_sse(q)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
