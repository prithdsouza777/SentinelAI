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

    # Amazon Bedrock
    bedrock_region: str = "us-east-1"
    bedrock_model_id: str = "anthropic.claude-3-5-sonnet-20241022-v2:0"

    # CORS
    cors_origins: str = "http://localhost:5173"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
