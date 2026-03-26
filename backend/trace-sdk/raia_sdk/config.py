"""RAIA SDK Configuration - reads from environment variables."""

import os

from dotenv import load_dotenv


class RaiaConfig:
    """Holds all SDK configuration. Loaded from .env or passed explicitly."""

    def __init__(self):
        load_dotenv()

        # Authentication
        self.email = os.getenv("RAIA_EMAIL", "")
        self.password = os.getenv("RAIA_PASSWORD", "")

        # API
        self.api_base_url = os.getenv("RAIA_API_BASE_URL", "http://localhost:8000")

        # Tenant / Project
        self.tenant_name = os.getenv("RAIA_TENANT_NAME", "")
        self.username = os.getenv("RAIA_USERNAME", "")
        self.asset_type = os.getenv("RAIA_TYPE", "Agentic")
        self.project_name = os.getenv("RAIA_PROJECT_NAME", "")

        # Agent metadata
        self.app_id = os.getenv("RAIA_APP_ID", "")
        self.agent_version = os.getenv("RAIA_AGENT_VERSION", "0.1.0")
        self.model_version = os.getenv("RAIA_MODEL_VERSION", "")
        self.environment = os.getenv("RAIA_ENVIRONMENT", "dev")
        self.max_steps_allowed = int(os.getenv("RAIA_MAX_STEPS_ALLOWED", "20"))

        # Local fallback
        self.local_buffer_dir = os.getenv(
            "RAIA_LOCAL_BUFFER_DIR",
            os.path.join(os.path.expanduser("~"), ".raia", "buffer"),
        )

        # Debug
        self.debug = os.getenv("RAIA_DEBUG", "false").lower() == "true"

    def validate(self):
        """Check that required fields are set."""
        missing = []
        if not self.email:
            missing.append("RAIA_EMAIL")
        if not self.password:
            missing.append("RAIA_PASSWORD")
        if not self.tenant_name:
            missing.append("RAIA_TENANT_NAME")
        if not self.project_name:
            missing.append("RAIA_PROJECT_NAME")
        if not self.app_id:
            missing.append("RAIA_APP_ID")
        if missing:
            raise ValueError(f"Missing required RAIA config: {', '.join(missing)}")


# Singleton instance
_config = None


def get_config() -> RaiaConfig:
    global _config
    if _config is None:
        _config = RaiaConfig()
    return _config


def reset_config():
    """Reset config (useful for testing)."""
    global _config
    _config = None
