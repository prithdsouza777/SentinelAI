"""RAIA SDK Authentication - login via /api/login to obtain JWT token."""

import logging
import time

import requests

from .config import get_config

logger = logging.getLogger("raia_sdk.auth")


class RaiaAuth:
    """Handles JWT authentication against the RAIA API."""

    def __init__(self):
        self._token = None
        self._token_type = None
        self._user_id = None
        self._tenant_id = None
        self._user_profile = None
        self._token_obtained_at = 0

    @property
    def is_authenticated(self) -> bool:
        return self._token is not None

    @property
    def token(self) -> str:
        if not self._token:
            self.login()
        return self._token

    @property
    def user_id(self) -> int:
        if self._user_id is None:
            self.login()
        return self._user_id

    @property
    def tenant_id(self) -> int:
        if self._tenant_id is None:
            self.login()
        return self._tenant_id

    @property
    def headers(self) -> dict:
        return {"Authorization": f"Bearer {self.token}"}

    def login(self):
        """Authenticate with RAIA API using email/password. Gets JWT token."""
        config = get_config()
        config.validate()

        login_url = f"{config.api_base_url}/api/login"

        logger.info("Authenticating with RAIA API at %s", login_url)

        try:
            response = requests.post(
                login_url,
                data={
                    "username": config.email,
                    "password": config.password,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=30,
            )
            response.raise_for_status()
        except requests.exceptions.ConnectionError:
            raise ConnectionError(
                f"Cannot connect to RAIA API at {login_url}. "
                "Is the server running?"
            )
        except requests.exceptions.HTTPError as e:
            if response.status_code == 400:
                raise ValueError(
                    f"Login failed: {response.json().get('detail', 'Invalid credentials')}"
                )
            raise RuntimeError(f"Login failed with status {response.status_code}: {e}")

        data = response.json()

        self._token = data["access_token"]
        self._token_type = data.get("token_type", "Bearer")
        self._token_obtained_at = time.time()

        profile = data.get("user_profile", {})
        self._user_id = profile.get("user_id")
        self._tenant_id = profile.get("tenant_id")
        self._user_profile = profile

        logger.info(
            "Authenticated as %s (user_id=%s, tenant_id=%s)",
            profile.get("email"),
            self._user_id,
            self._tenant_id,
        )

    def ensure_authenticated(self):
        """Login if not already authenticated."""
        if not self.is_authenticated:
            self.login()


# Singleton
_auth = None


def get_auth() -> RaiaAuth:
    global _auth
    if _auth is None:
        _auth = RaiaAuth()
    return _auth


def reset_auth():
    global _auth
    _auth = None
