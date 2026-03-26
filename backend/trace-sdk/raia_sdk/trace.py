"""RAIA Trace SDK - Core tracing.

Outputs JSON matching the RAIA agent_evaluation service field expectations.
Supports both per-call and session-based (multi-message) tracing.

Session trace output format: array of entries, one per user interaction.
Each entry has ALL fields required by the evaluation service:
  - Timing: start_time, end_time, latency
  - Status: success, error_type, error_message
  - Tokens: prompt_tokens, completion_tokens, total_tokens, model
  - Content: input, output, system_prompt, task_description, expected_outcome
  - Tools: tool_calls (with is_authorized per call), tool_results, tool_registry
  - Safety: boundary_violations, escalation_events, escalation_reason
  - Trace: trace_id, session_id, span_id, parent_span_id
"""

import logging
import time
import uuid
from datetime import datetime, timezone

from .config import get_config
from .uploader import upload_trace, upload_trace_async

logger = logging.getLogger("raia_sdk.trace")

SCHEMA_VERSION = "1.0"


class AgentTrace:
    """Wraps agent execution and emits trace JSON for RAIA evaluation.

    Per-call usage (context manager):
        with AgentTrace(task_description="...") as trace:
            trace.log_interaction(input_text="query", output_text="response", ...)
            trace.set_outcome("success")

    Session-based usage (long-lived):
        trace = AgentTrace(task_description="session")
        trace.start()
        trace.log_interaction(input_text="q1", output_text="r1", ...)
        trace.log_interaction(input_text="q2", output_text="r2", ...)
        trace.set_outcome("success")
        trace.finish()
    """

    # Class-level config set by configure()
    _tenant_id = None
    _app_id = None
    _agent_version = None
    _model_version = None
    _environment = None
    _system_prompt = None
    _tool_registry = None

    @classmethod
    def configure(
        cls,
        tenant_id: str = None,
        app_id: str = None,
        agent_version: str = None,
        model_version: str = None,
        environment: str = None,
        system_prompt: str = None,
        tool_registry: list = None,
    ):
        """Call once at app startup. Values can also come from .env."""
        config = get_config()
        cls._tenant_id = tenant_id or config.tenant_name
        cls._app_id = app_id or config.app_id
        cls._agent_version = agent_version or config.agent_version
        cls._model_version = model_version or config.model_version
        cls._environment = environment or config.environment
        cls._system_prompt = system_prompt
        cls._tool_registry = tool_registry

    def __init__(
        self,
        app_id: str = None,
        task_description: str = "",
        session_id: str = None,
        max_steps_allowed: int = None,
        metadata: dict = None,
        system_prompt: str = None,
        tool_registry: list = None,
        expected_outcome: str = None,
    ):
        config = get_config()

        self.trace_id = str(uuid.uuid4())
        self.tenant_id = self._tenant_id or config.tenant_name
        self.app_id = app_id or self._app_id or config.app_id
        self.session_id = session_id or str(uuid.uuid4())
        self.task_description = task_description
        self.max_steps_allowed = (
            max_steps_allowed
            if max_steps_allowed is not None
            else config.max_steps_allowed
        )
        self.metadata = metadata or {}

        # Content context for LLM evaluation
        self.system_prompt = system_prompt or self._system_prompt
        self.tool_registry = tool_registry or self._tool_registry or []
        self.expected_outcome = expected_outcome

        # Timing
        self.start_time = None
        self.end_time = None

        # Entries (one per user interaction / message)
        self.entries = []

        # Legacy steps (for backward compat with @tool decorator)
        self.steps = []
        self._step_counter = 0

        # Outcome
        self.task_outcome = "failure"

        # Safety fields
        self.escalation_events = []
        self.boundary_violations = []

        # Upload control
        self._async_upload = True
        self._auto_upload = False  # When True, upload after each log_interaction()

    # ── Context manager (per-call traces) ──

    def __enter__(self):
        self.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None and self.task_outcome == "failure":
            logger.warning(
                "Trace %s exiting with exception: %s", self.trace_id, exc_val
            )
        self.finish()
        return False

    # ── Session-based API (long-lived traces) ──

    def start(self):
        """Start the trace. Called automatically by __enter__, or manually for session traces."""
        self.start_time = datetime.now(timezone.utc).isoformat()
        logger.debug("Trace %s started at %s", self.trace_id, self.start_time)

    def finish(self):
        """Finalize and upload the trace. Called automatically by __exit__, or manually for session traces."""
        self.end_time = datetime.now(timezone.utc).isoformat()

        # If there are legacy steps but no entries, auto-convert steps to a single entry
        if self.steps and not self.entries:
            self._convert_steps_to_entry()

        trace_data = self.to_dict()

        if self._async_upload:
            upload_trace_async(trace_data)
        else:
            upload_trace(trace_data)

        logger.info(
            "Trace %s completed: outcome=%s, entries=%d",
            self.trace_id,
            self.task_outcome,
            len(self.entries),
        )

    # ── Primary API: log_interaction (one per user message) ──

    def log_interaction(
        self,
        input_text: str,
        output_text: str,
        start_time: datetime = None,
        end_time: datetime = None,
        model: str = None,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        total_tokens: int = 0,
        success: bool = True,
        error_type: str = None,
        error_message: str = None,
        tool_calls: list = None,
        tool_results: list = None,
        agent_thinking: list = None,
        num_steps: int = None,
        task_description: str = None,
        system_prompt: str = None,
        expected_outcome: str = None,
        boundary_violations: list = None,
        escalation_events: list = None,
        escalation_reason: str = None,
    ):
        """Log a single user interaction (one message-response pair).

        Each call adds one entry to the trace with ALL fields the
        RAIA agent_evaluation service needs for metric computation.

        Args:
            input_text: User query / prompt.
            output_text: Agent response / completion.
            start_time: When the interaction started.
            end_time: When the interaction ended.
            model: LLM model name/ID used.
            prompt_tokens: Input token count.
            completion_tokens: Output token count.
            total_tokens: Total token count.
            success: Whether the interaction succeeded.
            error_type: Exception class name if failed.
            error_message: Error details if failed.
            tool_calls: List of {name, arguments, is_authorized} dicts.
            tool_results: List of {name, result} dicts.
            agent_thinking: List of thinking/reasoning steps.
            num_steps: Number of agent steps taken.
            task_description: Per-interaction task description.
            system_prompt: System instructions (for quality/safety eval).
            expected_outcome: Ground truth (for goal completion metric).
            boundary_violations: List of boundary violations for this interaction.
            escalation_events: List of escalation events for this interaction.
            escalation_reason: Escalation reason text.
        """
        config = get_config()
        now = datetime.now(timezone.utc)
        _start = start_time or now
        _end = end_time or now

        if hasattr(_start, 'isoformat'):
            _start_iso = _start.astimezone(timezone.utc).isoformat()
        else:
            _start_iso = str(_start)

        if hasattr(_end, 'isoformat'):
            _end_iso = _end.astimezone(timezone.utc).isoformat()
        else:
            _end_iso = str(_end)

        # Calculate latency
        if hasattr(_start, 'timestamp') and hasattr(_end, 'timestamp'):
            latency_ms = round((_end.timestamp() - _start.timestamp()) * 1000, 2)
        else:
            latency_ms = 0

        _tool_calls = tool_calls or []
        _num_steps = num_steps if num_steps is not None else len(_tool_calls)

        # Merge interaction-level boundary violations with trace-level ones
        _boundary_violations = boundary_violations or []

        # Merge interaction-level escalation events
        _escalation_events = escalation_events or []

        entry = {
            # Trace identification
            "trace_id": str(uuid.uuid4()),
            "session_id": self.session_id,

            # Timing
            "start_time": _start_iso,
            "end_time": _end_iso,
            "latency": latency_ms,

            # Content (input/output for LLM evaluation)
            "input": input_text,
            "output": output_text,
            "system_prompt": system_prompt or self.system_prompt,
            "task_description": task_description or self.task_description,
            "expected_outcome": expected_outcome or self.expected_outcome,

            # Model
            "model": model or self._model_version or config.model_version,

            # Token usage
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens or (prompt_tokens + completion_tokens),

            # Status
            "success": success,
            "status": "success" if success else "error",
            "error_type": error_type,
            "error_message": error_message,

            # Tool calls (each dict should have: name, arguments, is_authorized)
            "tool_calls": _tool_calls,
            "tool_results": tool_results or [],
            "tool_registry": self.tool_registry,

            # Agent reasoning
            "agent_thinking": agent_thinking or [],
            "num_steps": _num_steps,

            # Safety & governance
            "boundary_violations": _boundary_violations,
            "escalation_events": _escalation_events,
            "escalation_reason": escalation_reason,

            # Context
            "app_id": self.app_id,
            "tenant_id": self.tenant_id,
            "agent_version": self._agent_version or config.agent_version,
            "environment": self._environment or config.environment,
        }

        self.entries.append(entry)

        if config.debug:
            logger.debug(
                "Interaction logged: input=%s, tools=%d, tokens=%d, success=%s",
                input_text[:50],
                len(_tool_calls),
                entry["total_tokens"],
                success,
            )

        # Auto-upload: push the full entries array to S3 after each interaction
        if self._auto_upload:
            self._upload_current()

    def _upload_current(self):
        """Upload the current entries array to S3 (overwrites same file)."""
        trace_data = self.to_dict()
        if self._async_upload:
            upload_trace_async(trace_data)
        else:
            upload_trace(trace_data)
        logger.debug("Auto-uploaded %d entries for session %s", len(self.entries), self.session_id)

    # ── Legacy step-based API (for @tool decorator) ──

    def log_step(
        self,
        tool: str,
        args: dict = None,
        result=None,
        is_retry: bool = False,
        is_authorized: bool = True,
        error: str = None,
        latency_ms: int = None,
    ):
        """Log a single tool invocation step (legacy API, used by @tool decorator)."""
        self._step_counter += 1

        step = {
            "step_id": self._step_counter,
            "tool_name": tool,
            "tool_args": args or {},
            "tool_result": result,
            "latency_ms": latency_ms,
            "is_retry": is_retry,
            "is_authorized": is_authorized,
            "error": error,
        }

        self.steps.append(step)

        if get_config().debug:
            logger.debug(
                "Step %d: tool=%s, authorized=%s, error=%s",
                self._step_counter,
                tool,
                is_authorized,
                error,
            )

    def timed_step(self, tool: str, args: dict = None, is_retry: bool = False, is_authorized: bool = True):
        """Return a context manager that auto-measures latency for a step."""
        return _TimedStep(self, tool, args, is_retry, is_authorized)

    def set_outcome(self, outcome: str, escalation_reason: str = None):
        """Set the task outcome.

        Args:
            outcome: "success" | "failure" | "partial" | "escalated"
            escalation_reason: Required if outcome is "escalated".
        """
        valid = {"success", "failure", "partial", "escalated"}
        if outcome not in valid:
            raise ValueError(f"Invalid outcome '{outcome}'. Must be one of: {valid}")

        if outcome == "escalated" and not escalation_reason:
            raise ValueError("escalation_reason is required when outcome is 'escalated'")

        self.task_outcome = outcome

        if outcome == "escalated" and escalation_reason:
            self.escalation_events.append(
                {
                    "reason": escalation_reason,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            )

    def log_boundary_violation(self, action: str, rule_violated: str):
        """Record a policy constraint violation."""
        self.boundary_violations.append(
            {
                "action": action,
                "rule_violated": rule_violated,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )

    def _convert_steps_to_entry(self):
        """Convert legacy steps into a single entry (for @tool decorator compat)."""
        config = get_config()

        tool_calls = []
        tool_results = []
        total_latency = 0

        for step in self.steps:
            tool_calls.append({
                "name": step["tool_name"],
                "arguments": step["tool_args"],
                "is_authorized": step.get("is_authorized", True),
            })
            tool_results.append({
                "name": step["tool_name"],
                "result": str(step["tool_result"]) if step["tool_result"] is not None else None,
            })
            if step.get("latency_ms"):
                total_latency += step["latency_ms"]

        first_error = next((s for s in self.steps if s.get("error")), None)

        entry = {
            "trace_id": self.trace_id,
            "session_id": self.session_id,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "latency": total_latency or 0,
            "input": self.task_description,
            "output": str(self.steps[-1]["tool_result"]) if self.steps else "",
            "system_prompt": self.system_prompt,
            "task_description": self.task_description,
            "expected_outcome": self.expected_outcome,
            "model": self._model_version or config.model_version,
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
            "success": self.task_outcome == "success",
            "status": "success" if self.task_outcome == "success" else "error",
            "error_type": first_error["error"].split(":")[0] if first_error and first_error.get("error") else None,
            "error_message": first_error["error"] if first_error and first_error.get("error") else None,
            "tool_calls": tool_calls,
            "tool_results": tool_results,
            "tool_registry": self.tool_registry,
            "agent_thinking": [],
            "num_steps": len(self.steps),
            "boundary_violations": self.boundary_violations,
            "escalation_events": self.escalation_events,
            "escalation_reason": self.escalation_events[-1]["reason"] if self.escalation_events else None,
            "app_id": self.app_id,
            "tenant_id": self.tenant_id,
            "agent_version": self._agent_version or config.agent_version,
            "environment": self._environment or config.environment,
        }

        self.entries.append(entry)

    def to_dict(self):
        """Serialize as array of entries — the format RAIA agent_evaluation expects."""
        return self.entries


class _TimedStep:
    """Helper context manager for auto-measuring step latency."""

    def __init__(self, trace: AgentTrace, tool, args, is_retry, is_authorized):
        self._trace = trace
        self._tool = tool
        self._args = args
        self._is_retry = is_retry
        self._is_authorized = is_authorized
        self._result = None
        self._error = None
        self._start = None

    def set_result(self, result):
        self._result = result

    def set_error(self, error: str):
        self._error = error

    def __enter__(self):
        self._start = time.perf_counter()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        elapsed_ms = int((time.perf_counter() - self._start) * 1000)

        if exc_type is not None and self._error is None:
            self._error = str(exc_val)

        self._trace.log_step(
            tool=self._tool,
            args=self._args,
            result=self._result,
            is_retry=self._is_retry,
            is_authorized=self._is_authorized,
            error=self._error,
            latency_ms=elapsed_ms,
        )

        return False
