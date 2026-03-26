"""RAIA SDK integration for LangGraph / LangChain agents.

Auto-extracts tool calls, results, tokens, input/output from LangGraph messages
and logs a complete interaction entry matching RAIA agent_evaluation format.

Usage:
    from raia_sdk.integrations import log_langgraph_steps

    # Session-based: one trace, multiple messages
    trace = AgentTrace(...)
    trace.start()

    result = agent.invoke({"messages": [HumanMessage(content=query)]})
    log_langgraph_steps(trace, result["messages"], user_input=query)

    trace.set_outcome("success")
    trace.finish()  # uploads ONE JSON with all interactions
"""

import logging
from datetime import datetime, timezone

logger = logging.getLogger("raia_sdk.integrations.langgraph")


def log_langgraph_steps(
    trace,
    messages: list,
    user_input: str = None,
    start_time: datetime = None,
    end_time: datetime = None,
):
    """Extract data from LangGraph messages and log as a single interaction entry.

    Automatically extracts: input, output, tool_calls, tool_results,
    token usage, thinking steps — everything the RAIA evaluation service needs.

    Args:
        trace: Active AgentTrace instance (or None — safely no-ops).
        messages: List of LangChain/LangGraph message objects from agent.invoke().
        user_input: The original user query (auto-detected from messages if omitted).
        start_time: When the agent invocation started (defaults to now).
        end_time: When the agent invocation ended (defaults to now).
    """
    if trace is None:
        return

    now = datetime.now(timezone.utc)
    _start = start_time or now
    _end = end_time or now

    # Extract all components from messages
    _input = user_input or _extract_user_input(messages)
    _output = _extract_final_output(messages)
    _tool_calls, _tool_results, _thinking = _extract_tool_data(messages)
    _tokens = _extract_token_usage(messages)

    # Detect errors
    has_error = any(
        getattr(msg, "status", None) == "error"
        for msg in messages
        if _is_tool_message(msg)
    )

    # Extract system prompt if present
    _system_prompt = _extract_system_prompt(messages)

    trace.log_interaction(
        input_text=_input,
        output_text=_output,
        start_time=_start,
        end_time=_end,
        model=_extract_model(messages),
        prompt_tokens=_tokens["prompt_tokens"],
        completion_tokens=_tokens["completion_tokens"],
        total_tokens=_tokens["total_tokens"],
        success=not has_error,
        error_type=None,
        error_message=None,
        tool_calls=_tool_calls,
        tool_results=_tool_results,
        agent_thinking=_thinking,
        num_steps=len(_thinking) if _thinking else len(_tool_calls),
        system_prompt=_system_prompt,
    )


def _extract_user_input(messages: list) -> str:
    """Find the first HumanMessage content."""
    for msg in messages:
        if type(msg).__name__ == "HumanMessage":
            content = getattr(msg, "content", "")
            return content if isinstance(content, str) else str(content)
    return ""


def _extract_final_output(messages: list) -> str:
    """Find the last AIMessage content (final response)."""
    for msg in reversed(messages):
        if _is_ai_message(msg):
            content = getattr(msg, "content", "")
            if content:
                return content if isinstance(content, str) else str(content)
    return ""


def _extract_tool_data(messages: list):
    """Extract tool_calls, tool_results, and thinking steps from messages.

    Returns:
        Tuple of (tool_calls, tool_results, thinking_steps)
    """
    # Build a map of tool_call_id -> ToolMessage for result pairing
    tool_result_map = {}
    for msg in messages:
        if _is_tool_message(msg):
            call_id = getattr(msg, "tool_call_id", None)
            if call_id:
                tool_result_map[call_id] = msg

    tool_calls = []
    tool_results = []
    thinking_steps = []
    step_num = 0

    for msg in messages:
        if not _is_ai_message(msg):
            continue

        step_num += 1
        content = getattr(msg, "content", "")
        thought = content if isinstance(content, str) else str(content)

        msg_tool_calls = getattr(msg, "tool_calls", None)
        if msg_tool_calls:
            for tc in msg_tool_calls:
                tool_name = tc.get("name", "unknown_tool")
                tool_args = tc.get("args", {})
                call_id = tc.get("id")

                tool_calls.append({
                    "name": tool_name,
                    "arguments": _safe_args(tool_args),
                    "is_authorized": True,
                })

                thinking_steps.append({
                    "step": step_num,
                    "thought": thought[:200] if thought else f"Calling tool: {tool_name}",
                    "action": tool_name,
                })

                # Find paired result
                result_msg = tool_result_map.get(call_id)
                if result_msg:
                    result_content = getattr(result_msg, "content", "")
                    result_str = result_content if isinstance(result_content, str) else str(result_content)
                    tool_results.append({
                        "name": getattr(result_msg, "name", tool_name),
                        "result": result_str[:500],
                    })
        else:
            # Final answer step (no tool calls)
            if thought:
                thinking_steps.append({
                    "step": step_num,
                    "thought": thought[:200],
                    "action": "final_answer",
                })

    return tool_calls, tool_results, thinking_steps


def _extract_system_prompt(messages: list) -> str:
    """Find SystemMessage content if present."""
    for msg in messages:
        if type(msg).__name__ == "SystemMessage":
            content = getattr(msg, "content", "")
            return content if isinstance(content, str) else str(content)
    return None


def _extract_model(messages: list) -> str:
    """Try to extract model name from AI message metadata."""
    for msg in messages:
        if _is_ai_message(msg):
            # Some frameworks store model info in response_metadata
            meta = getattr(msg, "response_metadata", {})
            if isinstance(meta, dict):
                model = meta.get("model", meta.get("model_id", meta.get("model_name", "")))
                if model:
                    return str(model)
    return None


def _extract_token_usage(messages: list) -> dict:
    """Sum token usage from all AI messages."""
    prompt_tokens = 0
    completion_tokens = 0

    for msg in messages:
        if _is_ai_message(msg):
            usage = getattr(msg, "usage_metadata", None)
            if usage and isinstance(usage, dict):
                prompt_tokens += usage.get("input_tokens", 0)
                completion_tokens += usage.get("output_tokens", 0)

    return {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": prompt_tokens + completion_tokens,
    }


def _is_ai_message(msg) -> bool:
    return type(msg).__name__ == "AIMessage"


def _is_tool_message(msg) -> bool:
    return type(msg).__name__ == "ToolMessage"


def _safe_args(args: dict, max_value_len: int = 500) -> dict:
    safe = {}
    for k, v in args.items():
        s = str(v)
        safe[k] = s[:max_value_len] + "..." if len(s) > max_value_len else s
    return safe
