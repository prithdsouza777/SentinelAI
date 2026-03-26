"""OAuth authentication routes for Google and Microsoft login.

Flow:
  1. Frontend clicks "Continue with Google/Microsoft"
  2. Browser redirects to GET /api/auth/google (or /microsoft)
  3. Backend redirects to provider's authorization URL
  4. Provider redirects back to GET /api/auth/google/callback with ?code=...
  5. Backend exchanges code for tokens, fetches profile, creates/links user
  6. Backend generates JWT and redirects to frontend: /auth/callback?token=...
"""

import json
import logging
import secrets
import sqlite3
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse

from app.config import settings

logger = logging.getLogger("sentinelai.auth")

router = APIRouter()

# ── Database ──────────────────────────────────────────────────────────────────

_DB_PATH = Path(__file__).resolve().parents[3] / "users.db"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    email       TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL DEFAULT '',
    picture     TEXT NOT NULL DEFAULT '',
    role        TEXT NOT NULL DEFAULT 'Operator',
    google_sub  TEXT,
    microsoft_sub TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
"""


def _get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(str(_DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(_SCHEMA)
    return conn


def _find_or_create_user(
    email: str,
    name: str,
    picture: str,
    provider: str,
    provider_sub: str,
) -> dict:
    """Find existing user by email, or create a new one. Links provider sub."""
    db = _get_db()
    now = datetime.now(timezone.utc).isoformat()

    row = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()

    if row:
        # Update profile and link provider
        sub_col = f"{provider}_sub"
        db.execute(
            f"UPDATE users SET name = ?, picture = ?, {sub_col} = ?, updated_at = ? WHERE email = ?",
            (name or row["name"], picture or row["picture"], provider_sub, now, email),
        )
        db.commit()
        row = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    else:
        # New user
        user_id = secrets.token_hex(12)
        sub_col = f"{provider}_sub"
        other_col = "microsoft_sub" if provider == "google" else "google_sub"
        db.execute(
            f"""INSERT INTO users (id, email, name, picture, role, {sub_col}, {other_col}, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'Supervisor', ?, NULL, ?, ?)""",
            (user_id, email, name, picture, provider_sub, now, now),
        )
        db.commit()
        row = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()

    db.close()
    return dict(row)


# ── JWT helpers ───────────────────────────────────────────────────────────────

def _create_jwt(user: dict) -> str:
    payload = {
        "sub": user["id"],
        "email": user["email"],
        "name": user["name"],
        "picture": user["picture"],
        "role": user["role"],
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expiry_hours),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def _decode_jwt(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


# ── Error redirect helper ────────────────────────────────────────────────────

def _error_redirect(message: str) -> RedirectResponse:
    return RedirectResponse(
        f"{settings.frontend_url}/login?error={message}",
        status_code=302,
    )


# ══════════════════════════════════════════════════════════════════════════════
# GOOGLE OAuth 2.0
# ══════════════════════════════════════════════════════════════════════════════

_GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
_GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


@router.get("/auth/google")
async def google_login():
    """Redirect the user to Google's OAuth consent screen."""
    if not settings.google_client_id:
        raise HTTPException(status_code=400, detail="Google OAuth not configured")

    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
    }
    return RedirectResponse(f"{_GOOGLE_AUTH_URL}?{urlencode(params)}")


@router.get("/auth/google/callback")
async def google_callback(code: str = "", error: str = ""):
    """Handle Google OAuth callback — exchange code for tokens, fetch profile."""
    if error or not code:
        return _error_redirect(error or "google_auth_denied")

    try:
        # Exchange authorization code for tokens
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(
                _GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "redirect_uri": settings.google_redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            if token_resp.status_code != 200:
                logger.error("Google token exchange failed: %s", token_resp.text)
                return _error_redirect("google_token_failed")
            tokens = token_resp.json()

            # Fetch user profile
            userinfo_resp = await client.get(
                _GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {tokens['access_token']}"},
            )
            if userinfo_resp.status_code != 200:
                return _error_redirect("google_profile_failed")
            profile = userinfo_resp.json()

        user = _find_or_create_user(
            email=profile["email"],
            name=profile.get("name", ""),
            picture=profile.get("picture", ""),
            provider="google",
            provider_sub=profile["id"],
        )

        token = _create_jwt(user)
        return RedirectResponse(
            f"{settings.frontend_url}/auth/callback?token={token}",
            status_code=302,
        )

    except Exception as e:
        logger.exception("Google OAuth error: %s", e)
        return _error_redirect("google_auth_error")


# ══════════════════════════════════════════════════════════════════════════════
# MICROSOFT OAuth 2.0 (Azure AD / Entra ID)
# ══════════════════════════════════════════════════════════════════════════════

def _ms_auth_url() -> str:
    return f"https://login.microsoftonline.com/{settings.microsoft_tenant_id}/oauth2/v2.0/authorize"

def _ms_token_url() -> str:
    return f"https://login.microsoftonline.com/{settings.microsoft_tenant_id}/oauth2/v2.0/token"

_MS_GRAPH_ME = "https://graph.microsoft.com/v1.0/me"


@router.get("/auth/microsoft")
async def microsoft_login():
    """Redirect the user to Microsoft's OAuth consent screen."""
    if not settings.microsoft_client_id:
        raise HTTPException(status_code=400, detail="Microsoft OAuth not configured")

    params = {
        "client_id": settings.microsoft_client_id,
        "redirect_uri": settings.microsoft_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile User.Read",
        "response_mode": "query",
        "prompt": "select_account",
    }
    return RedirectResponse(f"{_ms_auth_url()}?{urlencode(params)}")


@router.get("/auth/microsoft/callback")
async def microsoft_callback(code: str = "", error: str = "", error_description: str = ""):
    """Handle Microsoft OAuth callback — exchange code for tokens, fetch profile."""
    if error or not code:
        logger.error("Microsoft OAuth error: %s — %s", error, error_description)
        return _error_redirect(error or "microsoft_auth_denied")

    try:
        async with httpx.AsyncClient() as client:
            # Exchange authorization code for tokens
            token_resp = await client.post(
                _ms_token_url(),
                data={
                    "code": code,
                    "client_id": settings.microsoft_client_id,
                    "client_secret": settings.microsoft_client_secret,
                    "redirect_uri": settings.microsoft_redirect_uri,
                    "grant_type": "authorization_code",
                    "scope": "openid email profile User.Read",
                },
            )
            if token_resp.status_code != 200:
                logger.error("Microsoft token exchange failed: %s", token_resp.text)
                return _error_redirect("microsoft_token_failed")
            tokens = token_resp.json()

            # Fetch user profile from Microsoft Graph
            me_resp = await client.get(
                _MS_GRAPH_ME,
                headers={"Authorization": f"Bearer {tokens['access_token']}"},
            )
            if me_resp.status_code != 200:
                return _error_redirect("microsoft_profile_failed")
            profile = me_resp.json()

        email = profile.get("mail") or profile.get("userPrincipalName", "")
        name = profile.get("displayName", "")
        ms_id = profile.get("id", "")

        if not email:
            return _error_redirect("microsoft_no_email")

        user = _find_or_create_user(
            email=email,
            name=name,
            picture="",  # Microsoft Graph photo requires separate request
            provider="microsoft",
            provider_sub=ms_id,
        )

        token = _create_jwt(user)
        return RedirectResponse(
            f"{settings.frontend_url}/auth/callback?token={token}",
            status_code=302,
        )

    except Exception as e:
        logger.exception("Microsoft OAuth error: %s", e)
        return _error_redirect("microsoft_auth_error")


# ══════════════════════════════════════════════════════════════════════════════
# USER ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/auth/me")
async def get_current_user(request: Request):
    """Return the current user profile from the JWT token."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")

    payload = _decode_jwt(auth_header[7:])
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return {
        "id": payload["sub"],
        "email": payload["email"],
        "name": payload["name"],
        "picture": payload["picture"],
        "role": payload["role"],
    }


@router.post("/auth/logout")
async def logout():
    """Logout endpoint — frontend clears the token. This is a no-op for stateless JWT."""
    return {"status": "ok"}
