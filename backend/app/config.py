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

    # AWS Bedrock (primary LLM)
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-east-1"
    bedrock_model_id: str = "us.anthropic.claude-sonnet-4-6"

    # Anthropic API (fallback)
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-20250514"
    temperature: float = 0.01

    # Notifications — Microsoft Teams
    teams_webhook_url: str = ""
    teams_notify_on: str = "critical"  # "critical", "warning", "all", "none"

    # Notifications — Gmail SMTP email
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_to: str = ""  # comma-separated recipient emails
    email_notify_on: str = "critical"  # "critical", "warning", "all", "none"

    # Notification cooldown (seconds) — prevents spam for repeated alerts
    notification_cooldown: int = 60

    # CORS
    cors_origins: str = "http://localhost:5173"

    model_config = {
        "env_file": [".env", "../.env"],
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
