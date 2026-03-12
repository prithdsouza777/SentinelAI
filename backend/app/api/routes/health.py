from fastapi import APIRouter

from app.config import settings

router = APIRouter()


@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "0.1.0",
        "simulation_mode": settings.simulation_mode,
    }
