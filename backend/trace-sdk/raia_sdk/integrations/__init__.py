"""RAIA SDK integrations for popular agent frameworks.

Auto-captures steps from framework execution — no manual log_step() needed.

Usage:
    # LangGraph / LangChain
    from raia_sdk.integrations import log_langgraph_steps

    with AgentTrace(...) as trace:
        result = agent.invoke({"messages": [HumanMessage(content=query)]})
        log_langgraph_steps(trace, result["messages"])
        trace.set_outcome("success")
"""

from .langgraph import log_langgraph_steps

__all__ = ["log_langgraph_steps"]
