"""Data sanitizer — DLP / PII protection before Bedrock calls.

Strips sensitive identifiers (agent IDs, phone numbers, emails) from any
dict/string before it is sent to the LLM, preventing accidental data leakage.
"""

import re

# ── PII replacement patterns ─────────────────────────────────────────────────

_PII_PATTERNS: list[tuple[str, str, str]] = [
    # (name, regex, replacement)
    ("agent_ids",     r"agent-[a-z0-9]+",            "AGENT_REF"),
    ("phone_numbers", r"\+?[\d][\d\s\-\(\)]{8,}[\d]", "[PHONE]"),
    ("emails",        r"[\w.+\-]+@[\w.\-]+\.\w+",    "[EMAIL]"),
    ("queue_ids",     r"queue-[a-z0-9\-]+",           "QUEUE_REF"),
    ("aws_account",   r"\b\d{12}\b",                  "[AWS_ACCOUNT]"),
    ("arn",           r"arn:aws:[^\s]+",               "[ARN]"),
]

_COMPILED = [(name, re.compile(pattern, re.IGNORECASE), repl)
             for name, pattern, repl in _PII_PATTERNS]


def sanitize_string(text: str) -> str:
    """Apply all PII patterns to a single string."""
    for _name, pattern, replacement in _COMPILED:
        text = pattern.sub(replacement, text)
    return text


def sanitize_for_llm(data: object) -> object:
    """Recursively redact PII from any JSON-serialisable object.

    Handles dicts, lists, and strings. Other types are returned unchanged.
    """
    if isinstance(data, str):
        return sanitize_string(data)
    if isinstance(data, dict):
        return {k: sanitize_for_llm(v) for k, v in data.items()}
    if isinstance(data, list):
        return [sanitize_for_llm(item) for item in data]
    return data
