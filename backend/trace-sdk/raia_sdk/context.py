"""Thread-safe current trace tracking using contextvars.

This allows @tool decorators to find the active trace automatically,
regardless of framework (LangGraph, LangChain, CrewAI, custom).
"""

from contextvars import ContextVar

# The currently active AgentTrace for this execution context
_current_trace: ContextVar = ContextVar("raia_current_trace", default=None)


def get_current_trace():
    """Get the active trace for this context. Returns None if no trace is active."""
    return _current_trace.get()


def set_current_trace(trace):
    """Set the active trace for this context."""
    return _current_trace.set(trace)
