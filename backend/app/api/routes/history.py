"""Historical metrics endpoint.

Serves time-series snapshots of queue metrics captured each tick.
Used by the frontend for trend line visualizations.
No computation — just reads from the in-memory history list.
"""

from fastapi import APIRouter, Query, Request

router = APIRouter()


@router.get("/metrics/history")
async def get_metrics_history(
    request: Request,
    queue_id: str = Query(default=None, description="Filter by queue ID"),
    limit: int = Query(default=60, le=300, description="Max data points"),
):
    """Return historical metric snapshots for trending.

    Each item is a {queueId, contactsInQueue, agentsAvailable, avgWaitTime, ...} dict
    with a timestamp. Sorted oldest-first for chart rendering.
    """
    history: list[dict] = list(getattr(request.app.state, "metrics_history", []))

    if queue_id:
        history = [h for h in history if h.get("queueId") == queue_id]

    # Return oldest → newest, last N points
    history = history[-limit:]
    return {"history": history, "total": len(history)}
