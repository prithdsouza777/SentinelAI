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

    # Google Gemini API (preferred for demo — fast + cheap)
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash-lite"
    temperature: float = 0.01

    # Anthropic API (direct)
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-20250514"

    # Amazon Bedrock (fallback)
    bedrock_region: str = "us-east-1"
    bedrock_model_id: str = "us.anthropic.claude-sonnet-4-20250514-v1:0"

    # CORS
    cors_origins: str = "http://localhost:5173"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
