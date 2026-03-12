from fastapi import APIRouter

from app.config import settings

router = APIRouter()


@router.get("/health")
async def health_check():
    from app.services.redis_client import redis_client
    from app.services.bedrock import bedrock_service

    redis_health = await redis_client.health_check()
    bedrock_status = "mock" if bedrock_service.is_mock else "bedrock"

    return {
        "status": "healthy",
        "version": "0.1.0",
        "simulation_mode": settings.simulation_mode,
        "services": {
            "redis": redis_health,
            "bedrock": {
                "status": bedrock_status,
                "model": settings.bedrock_model_id if bedrock_status == "bedrock" else "MockBedrockLLM",
            },
        },
    }
