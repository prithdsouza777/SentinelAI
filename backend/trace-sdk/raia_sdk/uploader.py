"""RAIA SDK Uploader - uploads trace JSON files via /api/files_upload."""

import io
import json
import logging
import os
import threading
import uuid
from datetime import datetime

import requests

from .auth import get_auth
from .config import get_config

logger = logging.getLogger("raia_sdk.uploader")


def _save_to_local_buffer(trace_data, filename: str):
    """Save trace JSON to local disk as fallback."""
    config = get_config()
    buffer_dir = config.local_buffer_dir
    os.makedirs(buffer_dir, exist_ok=True)

    filepath = os.path.join(buffer_dir, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(trace_data, f, indent=2, default=str)

    logger.info("Trace saved to local buffer: %s", filepath)
    return filepath


def _get_trace_id(trace_data) -> str:
    """Extract trace_id from trace data (dict or list of entries)."""
    if isinstance(trace_data, dict):
        return trace_data.get("trace_id", str(uuid.uuid4())[:8])
    elif isinstance(trace_data, list) and trace_data:
        return trace_data[0].get("session_id", str(uuid.uuid4())[:8])
    return str(uuid.uuid4())[:8]


def upload_trace(trace_data):
    """Upload a trace JSON to RAIA API via /api/files_upload.

    Args:
        trace_data: dict (single trace) or list (array of entries).

    Sends as multipart form data with Bearer token auth.
    Falls back to local disk if upload fails.
    """
    config = get_config()
    auth = get_auth()

    trace_id = _get_trace_id(trace_data)
    filename = f"{trace_id}.json"

    # Serialize to JSON bytes
    trace_bytes = json.dumps(trace_data, indent=2, default=str).encode("utf-8")

    upload_url = f"{config.api_base_url}/api/files_upload"

    try:
        auth.ensure_authenticated()

        form_data = {
            "user_id": str(auth.user_id),
            "tenant_id": str(auth.tenant_id),
            "analysis_type": config.asset_type,
            "project_name": config.project_name,
        }

        files = [
            ("files", (filename, io.BytesIO(trace_bytes), "application/json")),
        ]

        logger.info(
            "Uploading trace %s to %s (project=%s)",
            trace_id,
            upload_url,
            config.project_name,
        )

        response = requests.post(
            upload_url,
            headers=auth.headers,
            data=form_data,
            files=files,
            timeout=60,
        )
        response.raise_for_status()

        result = response.json()
        logger.info("Trace %s uploaded successfully: %s", trace_id, result)
        return result

    except Exception as e:
        logger.warning("Upload failed for trace %s: %s. Saving to local buffer.", trace_id, e)
        _save_to_local_buffer(trace_data, filename)
        return None


def upload_trace_async(trace_data):
    """Upload trace in a background daemon thread (non-blocking)."""
    trace_id = _get_trace_id(trace_data)
    thread = threading.Thread(
        target=upload_trace,
        args=(trace_data,),
        daemon=True,
        name=f"raia-upload-{trace_id}",
    )
    thread.start()
    return thread
