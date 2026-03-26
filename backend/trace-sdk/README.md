# RAIA Trace SDK

Python SDK for logging agent trace data to the RAIA platform. Works with **any** agent framework — LangGraph, LangChain, CrewAI, or custom Python agents.

Trace logs are uploaded as JSON to S3 via the RAIA API and used by the evaluation service to compute metrics like latency, token usage, tool governance, safety, quality, and trust scores.

## Installation

```bash
pip install /path/to/raia-trace-sdk
```

## Configuration

Add these environment variables to your `.env` file:

```env
# Authentication
RAIA_EMAIL=your-email@example.com
RAIA_PASSWORD=your-password

# API
RAIA_API_BASE_URL=http://raia-dev.cirruslabs.io

# Tenant / Project
RAIA_TENANT_NAME=YourTenant
RAIA_USERNAME=your-username
RAIA_TYPE=Agentic
RAIA_PROJECT_NAME=my-project

# Agent metadata
RAIA_APP_ID=my-agent-app
RAIA_AGENT_VERSION=1.0.0
RAIA_MODEL_VERSION=claude-sonnet-4-6
RAIA_ENVIRONMENT=dev
RAIA_MAX_STEPS_ALLOWED=15

# Debug (optional)
RAIA_DEBUG=true
```

| Variable | Required | Description |
|---|---|---|
| `RAIA_EMAIL` | Yes | Login email for RAIA platform |
| `RAIA_PASSWORD` | Yes | Login password |
| `RAIA_API_BASE_URL` | Yes | RAIA API URL |
| `RAIA_TENANT_NAME` | Yes | Your tenant/organization name |
| `RAIA_USERNAME` | Yes | Your RAIA username |
| `RAIA_TYPE` | Yes | Analysis type (use `Agentic`) |
| `RAIA_PROJECT_NAME` | Yes | Project folder name in S3 |
| `RAIA_APP_ID` | Yes | Identifier for your agent app |
| `RAIA_AGENT_VERSION` | No | Agent version string |
| `RAIA_MODEL_VERSION` | No | LLM model identifier |
| `RAIA_ENVIRONMENT` | No | Environment (`dev`, `staging`, `prod`) |
| `RAIA_MAX_STEPS_ALLOWED` | No | Max tool steps allowed (default: 20) |
| `RAIA_DEBUG` | No | Enable debug logging (`true`/`false`) |

## Integration Options

### Option 1: LangGraph / LangChain (Recommended)

Use the built-in integration that auto-extracts tool calls, token usage, input/output, and thinking steps from LangGraph messages.

```python
from datetime import datetime, timezone
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.prebuilt import create_react_agent

from raia_sdk import AgentTrace
from raia_sdk.integrations import log_langgraph_steps

SYSTEM_PROMPT = "You are a helpful assistant..."
TOOL_REGISTRY = ["search_products", "get_order_details"]

# Configure once at startup (optional — sets defaults for all traces)
AgentTrace.configure(
    system_prompt=SYSTEM_PROMPT,
    tool_registry=TOOL_REGISTRY,
)

# Create your LangGraph agent
agent = create_react_agent(llm, tools, prompt=SystemMessage(content=SYSTEM_PROMPT))

# --- Per-call usage (one trace per request) ---
with AgentTrace(task_description="Customer support query") as trace:
    start_time = datetime.now(timezone.utc)
    result = agent.invoke({"messages": [HumanMessage(content="Show me laptops")]})
    end_time = datetime.now(timezone.utc)

    log_langgraph_steps(
        trace,
        result["messages"],
        user_input="Show me laptops",
        start_time=start_time,
        end_time=end_time,
    )
    trace.set_outcome("success")
# Trace auto-uploads to S3 on exit
```

### Option 2: Session-Based Tracing (Multi-Turn Chat)

For chat applications where one conversation = one trace file with multiple entries.

```python
from raia_sdk import AgentTrace
from raia_sdk.integrations import log_langgraph_steps

# Create a session-level trace (lives for the entire conversation)
trace = AgentTrace(
    task_description="Customer support session",
    session_id="unique-session-id",
)
trace._async_upload = False   # Synchronous uploads (reliable)
trace._auto_upload = True     # Auto-upload after each message
trace.start()

# Each user message adds an entry to the same trace
def handle_message(user_input: str):
    start_time = datetime.now(timezone.utc)
    result = agent.invoke({"messages": [HumanMessage(content=user_input)]})
    end_time = datetime.now(timezone.utc)

    log_langgraph_steps(
        trace,
        result["messages"],
        user_input=user_input,
        start_time=start_time,
        end_time=end_time,
    )
    # With _auto_upload=True, the trace JSON is uploaded to S3 after each call

# When the session ends
trace.set_outcome("success")
trace.finish()  # Final upload
```

### Option 3: Decorator-Based (Custom Agents)

For custom Python agents without a framework. Use `@trace` on the agent entry point and `@tool` on tool functions.

```python
from raia_sdk import trace, tool

@tool
def search_products(query: str) -> str:
    """Search the product catalog."""
    # your implementation
    return results

@tool
def get_order(order_id: str) -> dict:
    """Look up an order."""
    return {"order_id": order_id, "status": "delivered"}

@trace(task_description="Handle customer query")
def my_agent(query: str) -> str:
    results = search_products(query)
    return f"Found: {results}"

# Just call the function — tracing happens automatically
my_agent("Show me laptops under $500")
# Trace auto-created, all @tool calls logged, uploaded to S3
```

The `@tool` decorator auto-captures: tool name, arguments, result, latency, and errors. It requires an active `@trace` context — if no trace is active, the function runs normally.

### Option 4: Manual Logging (Any Framework)

For full control over what gets logged. Works with any agent framework.

```python
from raia_sdk import AgentTrace

with AgentTrace(task_description="My agent task") as trace:
    trace.log_interaction(
        input_text="What laptops do you have?",
        output_text="Here are our top laptops...",
        model="claude-sonnet-4-6",
        prompt_tokens=150,
        completion_tokens=200,
        total_tokens=350,
        success=True,
        tool_calls=[
            {"name": "search_products", "arguments": {"query": "laptops"}, "is_authorized": True}
        ],
        tool_results=[
            {"name": "search_products", "result": "Found 5 laptops..."}
        ],
    )
    trace.set_outcome("success")
```

## API Reference

### `AgentTrace`

The core tracing class.

#### Class Method

```python
AgentTrace.configure(
    tenant_id=None,        # Override tenant from .env
    app_id=None,           # Override app_id from .env
    agent_version=None,    # Override agent_version from .env
    model_version=None,    # Override model_version from .env
    environment=None,      # Override environment from .env
    system_prompt=None,    # Default system prompt for all traces
    tool_registry=None,    # List of authorized tool names
)
```

#### Constructor

```python
trace = AgentTrace(
    app_id=None,               # Agent application ID
    task_description="",       # What this trace is about
    session_id=None,           # Session ID (auto-generated if omitted)
    max_steps_allowed=None,    # Max tool steps
    metadata=None,             # Extra metadata dict
    system_prompt=None,        # System prompt text
    tool_registry=None,        # List of authorized tool names
    expected_outcome=None,     # Ground truth for evaluation
)
```

#### Methods

| Method | Description |
|---|---|
| `start()` | Start the trace timer. Called automatically when using `with`. |
| `finish()` | Finalize and upload the trace. Called automatically when using `with`. |
| `log_interaction(...)` | Log a single user-agent interaction (message pair). |
| `log_step(...)` | Log a single tool invocation (used by `@tool` decorator). |
| `set_outcome(outcome, escalation_reason=None)` | Set outcome: `"success"`, `"failure"`, `"partial"`, `"escalated"`. |
| `log_boundary_violation(action, rule_violated)` | Record a policy constraint violation. |
| `to_dict()` | Serialize trace as list of entry dicts. |

#### `log_interaction()` Parameters

```python
trace.log_interaction(
    input_text="user query",           # User message
    output_text="agent response",      # Agent response
    start_time=None,                   # datetime (defaults to now)
    end_time=None,                     # datetime (defaults to now)
    model=None,                        # LLM model used
    prompt_tokens=0,                   # Input token count
    completion_tokens=0,               # Output token count
    total_tokens=0,                    # Total tokens
    success=True,                      # Whether interaction succeeded
    error_type=None,                   # Exception class name
    error_message=None,                # Error details
    tool_calls=None,                   # List of {name, arguments, is_authorized}
    tool_results=None,                 # List of {name, result}
    agent_thinking=None,               # List of reasoning steps
    num_steps=None,                    # Number of agent steps
    task_description=None,             # Per-interaction task description
    system_prompt=None,                # System prompt override
    expected_outcome=None,             # Ground truth override
    boundary_violations=None,          # List of violations
    escalation_events=None,            # List of escalation events
    escalation_reason=None,            # Escalation reason text
)
```

### `log_langgraph_steps()`

One-line integration for LangGraph/LangChain agents.

```python
from raia_sdk.integrations import log_langgraph_steps

log_langgraph_steps(
    trace,                  # Active AgentTrace instance
    messages,               # List of LangChain message objects from agent.invoke()
    user_input=None,        # Original user query (auto-detected if omitted)
    start_time=None,        # When the invocation started
    end_time=None,          # When the invocation ended
)
```

Auto-extracts from messages:
- **Input/Output**: First `HumanMessage` and last `AIMessage`
- **Tool calls**: From `AIMessage.tool_calls` with `is_authorized=True`
- **Tool results**: From `ToolMessage` objects, paired by `tool_call_id`
- **Token usage**: From `AIMessage.usage_metadata` (`input_tokens`, `output_tokens`)
- **System prompt**: From `SystemMessage` if present
- **Model**: From `AIMessage.response_metadata`
- **Thinking steps**: Reconstructed from AI message + tool call sequence

## Trace Output Format

Each trace is a JSON array of entries (one per user interaction):

```json
[
  {
    "trace_id": "uuid",
    "session_id": "uuid",
    "start_time": "2024-01-01T00:00:00+00:00",
    "end_time": "2024-01-01T00:00:01+00:00",
    "latency": 1000.0,
    "input": "Show me laptops",
    "output": "Here are our top laptops...",
    "system_prompt": "You are a helpful assistant...",
    "task_description": "Customer support query",
    "expected_outcome": null,
    "model": "claude-sonnet-4-6",
    "prompt_tokens": 150,
    "completion_tokens": 200,
    "total_tokens": 350,
    "success": true,
    "status": "success",
    "error_type": null,
    "error_message": null,
    "tool_calls": [
      {"name": "search_products", "arguments": {"query": "laptops"}, "is_authorized": true}
    ],
    "tool_results": [
      {"name": "search_products", "result": "Found 5 laptops..."}
    ],
    "tool_registry": ["search_products", "get_order_details"],
    "agent_thinking": [
      {"step": 1, "thought": "User wants laptop recommendations", "action": "search_products"}
    ],
    "num_steps": 1,
    "boundary_violations": [],
    "escalation_events": [],
    "escalation_reason": null,
    "app_id": "my-agent-app",
    "tenant_id": "MyTenant",
    "agent_version": "1.0.0",
    "environment": "dev"
  }
]
```

## S3 Upload Path

Traces are uploaded to:

```
{tenant_name}/{username}/Agentic/{project_name}/files/{session_id}.json
```

- With `_auto_upload=True`, the file is overwritten after each message (growing array)
- On `finish()`, a final upload is done with the complete trace

## Error Handling

- If the RAIA API is unreachable, traces are saved to `~/.raia/buffer/` as local JSON files
- Authentication errors raise immediately so you can fix credentials
- Individual interaction errors are captured in the trace (`success=false`, `error_type`, `error_message`)
