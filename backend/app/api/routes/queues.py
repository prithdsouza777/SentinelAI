from fastapi import APIRouter, HTTPException, Request

router = APIRouter()


@router.get("/queues")
async def list_queues(request: Request):
    """List all queues with their latest metrics snapshot."""
    latest = request.app.state.latest_metrics
    return {"queues": list(latest.values())}


@router.get("/queues/{queue_id}/metrics")
async def get_queue_metrics(queue_id: str, request: Request):
    """Get the latest metrics for a specific queue."""
    latest = request.app.state.latest_metrics
    if queue_id not in latest:
        raise HTTPException(status_code=404, detail=f"Queue '{queue_id}' not found")
    return latest[queue_id]
