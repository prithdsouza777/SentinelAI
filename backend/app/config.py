from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Mode
    simulation_mode: bool = True

    # Redis
    redis_url: str = "redis://localhost:6379"

    # DynamoDB
    dynamodb_endpoint: str = "http://localhost:8042"
    dynamodb_region: str = "us-east-1"

    # AWS Connect
    connect_instance_id: str = ""
    connect_region: str = "us-east-1"

    # Anthropic API
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-20250514"
    temperature: float = 0.01

    # CORS
    cors_origins: str = "http://localhost:5173"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
