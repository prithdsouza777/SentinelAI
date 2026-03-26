"""RAIA SDK Decorators — zero-code instrumentation for any Python agent.

Two decorators:
    @trace  — wraps the agent entry point, creates a trace, uploads on completion
    @tool   — wraps any tool/function, auto-logs step (args, result, latency, errors)

Works with LangGraph, LangChain, CrewAI, or any custom agent framework.

Usage:
    from raia_sdk.decorators import trace, tool

    @tool
    def search_kb(query: str) -> str:
        return "results..."

    @tool(name="custom_name")
    def my_func(x):
        return x * 2

    @trace(task_description="Handle customer query")
    def run_agent(query: str):
        result = search_kb(query)
        return result

    run_agent("refund please")
    # Trace auto-created, steps auto-logged, uploaded to S3
"""

import functools
import logging
import time

from .context import get_current_trace, set_current_trace
from .trace import AgentTrace

logger = logging.getLogger("raia_sdk.decorators")


def trace(
    _func=None,
    *,
    task_description: str = "",
    app_id: str = None,
    session_id: str = None,
    max_steps_allowed: int = None,
    metadata: dict = None,
    sync_upload: bool = False,
):
    """Decorator that wraps a function in an AgentTrace context.

    Auto-creates the trace, sets outcome based on success/exception,
    and uploads to S3 on completion.

    Can be used with or without arguments:
        @trace
        def my_agent(...): ...

        @trace(task_description="Handle billing")
        def my_agent(...): ...
    """

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Build task description — use provided or derive from function + args
            desc = task_description
            if not desc:
                desc = f"{func.__name__}({', '.join(repr(a) for a in args[:3])})"

            with AgentTrace(
                app_id=app_id,
                task_description=desc,
                session_id=session_id,
                max_steps_allowed=max_steps_allowed,
                metadata=metadata or {},
            ) as t:
                t._async_upload = not sync_upload

                # Set this trace as the active context so @tool can find it
                token = set_current_trace(t)

                try:
                    result = func(*args, **kwargs)
                    # Auto-set outcome to success if not already set
                    if t.task_outcome == "failure":
                        t.set_outcome("success")
                    return result
                except Exception as e:
                    t.set_outcome("failure")
                    raise
                finally:
                    # Restore previous trace context (supports nesting)
                    set_current_trace(None)

        return wrapper

    # Support both @trace and @trace(...)
    if _func is not None:
        return decorator(_func)
    return decorator


def tool(
    _func=None,
    *,
    name: str = None,
    capture_args: bool = True,
    capture_result: bool = True,
    is_authorized: bool = True,
):
    """Decorator that auto-logs a function as a trace step.

    Automatically captures: tool name, args, result, latency_ms, errors.
    Requires an active @trace context — if no trace is active, the function
    runs normally without logging.

    Can be used with or without arguments:
        @tool
        def search_kb(query): ...

        @tool(name="knowledge_search", capture_args=False)
        def search_kb(query): ...
    """

    def decorator(func):
        tool_name = name or func.__name__

        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            current_trace = get_current_trace()

            # No active trace — just run the function normally
            if current_trace is None:
                return func(*args, **kwargs)

            # Build args dict for logging
            step_args = {}
            if capture_args:
                # Map positional args to parameter names
                import inspect
                sig = inspect.signature(func)
                params = list(sig.parameters.keys())
                for i, arg in enumerate(args):
                    key = params[i] if i < len(params) else f"arg_{i}"
                    step_args[key] = _safe_repr(arg)
                for k, v in kwargs.items():
                    step_args[k] = _safe_repr(v)

            # Execute and measure
            start = time.perf_counter()
            error_msg = None
            result = None

            try:
                result = func(*args, **kwargs)
                return result
            except Exception as e:
                error_msg = f"{type(e).__name__}: {e}"
                raise
            finally:
                elapsed_ms = int((time.perf_counter() - start) * 1000)

                current_trace.log_step(
                    tool=tool_name,
                    args=step_args if capture_args else {},
                    result=_safe_repr(result) if capture_result else None,
                    latency_ms=elapsed_ms,
                    is_authorized=is_authorized,
                    error=error_msg,
                )

        return wrapper

    # Support both @tool and @tool(...)
    if _func is not None:
        return decorator(_func)
    return decorator


def _safe_repr(value, max_length: int = 1000) -> str:
    """Safely convert a value to string, truncating if too long."""
    if value is None:
        return None
    try:
        s = str(value)
        if len(s) > max_length:
            return s[:max_length] + "...[truncated]"
        return s
    except Exception:
        return "<unserializable>"
