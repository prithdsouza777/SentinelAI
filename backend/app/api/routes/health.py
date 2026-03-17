from fastapi import APIRouter

from app.config import settings

router = APIRouter()


@router.get("/health")
async def health_check():
    from app.services.redis_client import redis_client
    from app.services.bedrock import bedrock_service

    redis_health = await redis_client.health_check()
    provider = bedrock_service.provider_name

    return {
        "status": "healthy",
        "version": "0.1.0",
        "simulation_mode": settings.simulation_mode,
        "services": {
            "redis": redis_health,
            "llm": {
                "provider": provider,
                "model": {
                    "gemini": settings.gemini_model,
                    "anthropic": settings.anthropic_model,
                    "bedrock": settings.bedrock_model_id,
                    "mock": "MockBedrockLLM",
                }.get(provider, "unknown"),
            },
        },
    }
