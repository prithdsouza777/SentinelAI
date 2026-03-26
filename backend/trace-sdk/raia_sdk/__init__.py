"""RAIA Trace SDK - Responsible AI Assessment trace logging for Agentic AI.

Works with ANY agent framework: LangGraph, LangChain, CrewAI, custom, etc.

1. Custom agents — decorator-based:

    from raia_sdk import trace, tool

    @tool
    def search_kb(query: str) -> str: ...

    @trace(task_description="Handle billing query")
    def my_agent(query: str):
        return search_kb(query)  # auto-logged

2. LangGraph / LangChain — one-line integration:

    from raia_sdk import AgentTrace
    from raia_sdk.integrations import log_langgraph_steps

    with AgentTrace(task_description="...") as t:
        result = agent.invoke({"messages": [HumanMessage(content=query)]})
        log_langgraph_steps(t, result["messages"])  # auto-logs all tool calls
        t.set_outcome("success")

3. Any framework — manual:

    with AgentTrace(task_description="...") as t:
        t.log_step(tool="my_tool", args={...}, result="...")
        t.set_outcome("success")
"""

from .auth import RaiaAuth, get_auth, reset_auth
from .config import RaiaConfig, get_config, reset_config
from .context import get_current_trace
from .decorators import tool, trace
from .trace import AgentTrace
from .uploader import upload_trace, upload_trace_async

__version__ = "0.1.0"
__all__ = [
    # Decorators (primary API)
    "trace",
    "tool",
    # Manual API
    "AgentTrace",
    "get_current_trace",
    # Config / Auth
    "RaiaConfig",
    "RaiaAuth",
    "get_config",
    "get_auth",
    "upload_trace",
    "upload_trace_async",
    "reset_config",
    "reset_auth",
]
