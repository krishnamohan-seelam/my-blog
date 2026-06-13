---
layout: post
title: "Planner-Executor Agents: Separating Strategy from Action"
date: 2026-06-13
categories: ai python langchain
tags: [AI Agents, Planner, Executor, LangGraph, Tutorial, Trip Planner]
---

## Introduction

In the [previous blog post](https://krishnamohan-seelam.github.io/my-blog/ai/python/langchain/2026/05/30/langgraph-workflow-agents.html), we built a production-ready Financial Analyst agent using **LangGraph**. That post showed how graph-based workflows give you explicit control over state, nodes, and edges—making your agent observable and maintainable. But even LangGraph ReAct agents have a weakness: they reason and act simultaneously, one tool call at a time, making them prone to losing sight of the original goal in long, multi-step tasks.

In this post, we take the next step: the **Planner-Executor** agent pattern. This architecture draws a hard line between *strategic thinking* and *tactical action*:

1. **Planner** — a high-reasoning LLM creates a full multi-step plan before any tool is invoked.
2. **Executor** — a focused agent executes each step using tools, one at a time.
3. **Synthesizer** — a final layer compiles all execution results into a polished response.

This separation lets each component do what it does best, reducing costs, improving debuggability, and making the system far easier to audit.

<img src="{{ site.baseurl }}/assets/planner_executor_architecture.svg" alt="Planner Executor Architecture" style="width: 80vw; max-width: 700px; position: relative; left: 50%; transform: translateX(-50%); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />

---

## From ReAct to Planner-Executor

The ReAct loop works well for tasks where the next action depends heavily on the previous result. However, as tasks grow in complexity—spanning multiple tools, external APIs, and long reasoning chains—a purely reactive approach begins to show its limits:

- **Goal drift**: After several tool calls, the agent may lose track of the original objective.
- **Token cost**: Each iteration re-sends the full conversation history to an expensive LLM.
- **Opacity**: There is no explicit roadmap, making it hard to audit what the agent intended to do.

The Planner-Executor model directly addresses these issues by generating an explicit plan **before** any execution begins.

### ReAct vs. Planner-Executor

Aspect | ReAct Agent | Planner-Executor Agent
--- | --- | ---
**Reasoning style** | Interleaved (think → act → observe) | Separated (plan first, execute after)
**Goal tracking** | Implicit, can drift | Explicit plan anchors every step
**Debuggability** | Hard to pinpoint failure step | Each step is labeled and traceable
**Cost model** | Large LLM used every loop iteration | Large LLM only for planning; smaller for execution
**Auditability** | Low (no upfront plan artifact) | High (plan can be logged or approved)
**Best for** | Dynamic tasks needing live adaptation | Multi-step, structured, auditable workflows

---

## The Planner-Executor Architecture

At its heart, a Planner-Executor system has four major components that operate in sequence:

### 1. The Planner — The Strategic Brain

The Planner receives the user's raw request and uses a high-capability LLM to decompose it into a structured, ordered list of actionable sub-tasks. Crucially, **the Planner never touches tools or APIs**—it only produces the blueprint. This separation means you can swap planning models independently of execution models.

The output is a serializable artifact (typically a JSON list or Pydantic model), which can be logged, reviewed, or even subject to a human-in-the-loop approval gate before execution begins.

### 2. The Executor — The Operational Workhorse

The Executor receives individual steps from the plan, one at a time. For each step, it:
- Focuses exclusively on the current sub-task (narrow context window)
- Maps the step to one or more tools
- Reports the result back to the system state

Because the Executor operates with a focused, pruned context, it can use a smaller, faster, cheaper model than the Planner—delivering significant cost savings at scale.

### 3. The Supervisor — The Traffic Controller

A lightweight decision function checks whether the plan is complete after each executed step. If more steps remain, it routes back to the Executor. When all steps are done, it routes to the Synthesizer. This pattern naturally supports **dynamic re-planning**: if a step fails, the Supervisor can optionally route back to the Planner to regenerate the remaining steps.

### 4. The Synthesizer — The Final Voice

Once all steps are executed, the Synthesizer collects the accumulated results from the global state and compiles them into a coherent, well-formatted final response for the user.

### The Workflow Lifecycle

```
[ User Request ]
       │
       ▼
  ┌─────────┐        ┌─────────────────────┐
  │ PLANNER │───────▶│  Structured Plan    │
  └─────────┘        │  (list of steps)    │
                     └──────────┬──────────┘
                                │
                     ┌──────────▼──────────┐
                     │     EXECUTOR        │◀──────────┐
                     │  (one step at time) │           │
                     └──────────┬──────────┘           │
                                │                      │
                     ┌──────────▼──────────┐    ┌──────┴──────┐
                     │     SUPERVISOR      │───▶│  Continue?  │
                     └──────────┬──────────┘    └─────────────┘
                                │ done
                     ┌──────────▼──────────┐
                     │    SYNTHESIZER      │
                     └──────────┬──────────┘
                                │
                     ┌──────────▼──────────┐
                     │   Final Response    │
                     └─────────────────────┘
```

---

## Hands-On: Trip Planner Agent with LangGraph

Let's build a concrete, production-quality Planner-Executor agent: a **Trip Advisor Chatbot**. The user provides a travel request (e.g., *"Plan a 5-day trip to Rajasthan"*), and the agent:

1. **Plans** a sequence of research steps (attractions, weather, travel tips)
2. **Executes** each step using web search, Wikipedia, and a weather API
3. **Synthesizes** all findings into a personalized travel itinerary

The implementation uses Groq (free tier), LangGraph, and LangChain community tools—no paid APIs required for the core functionality.

### Step 1: Install Dependencies

```bash
pip install langgraph langchain langchain-groq langchain-community \
            duckduckgo-search wikipedia requests python-dotenv \
            pydantic rich
```

Or use the requirements file directly:

```bash
pip install -r requirements.txt
```

**`requirements.txt`**:
```
langgraph
langchain
langchain-groq
langchain-community
duckduckgo-search
wikipedia
requests
python-dotenv
pydantic
rich
langchain-google-genai
langchain-openai
```

### Step 2: Set Environment Variables

The agent is designed to work with any of three LLM providers (it tries them in order):

```bash
# Option 1: Groq (free tier — recommended for getting started)
export GROQ_API_KEY=your_groq_api_key_here

# Option 2: Google Gemini (free tier)
export GOOGLE_API_KEY=your_google_api_key_here

# Option 3: OpenAI
export OPENAI_API_KEY=your_openai_api_key_here

# Optional: for real weather data
export OPENWEATHER_API_KEY=your_openweather_key_here
```

Or create a `.env` file in the project directory:
```
GROQ_API_KEY=your_groq_api_key_here
OPENWEATHER_API_KEY=your_openweather_key_here
```

---

### Step 3: Define the Graph State

The `AgentState` is the single source of truth that flows through every node. Unlike the ReAct agent (which only carried `messages`), the Planner-Executor state is richer—it explicitly tracks the plan, the current execution index, and accumulated results.

```python
import operator
from typing import Annotated, List, TypedDict

class AgentState(TypedDict):
    goal: str                                        # The original user request
    plan: List[str]                                  # Ordered list of steps from Planner
    current_step_index: int                          # Which step we're executing now
    results: Annotated[List[str], operator.add]      # Accumulated results (append-only)
    final_answer: str                                # Set when synthesis is complete
```

#### Key Design Decisions

- `goal`: Immutable after creation—the planner and synthesizer both reference this.
- `plan`: The explicit blueprint. Having this as a first-class field means you can log it, display it, or gate it behind a human approval before execution begins.
- `current_step_index`: A simple integer cursor. The Supervisor uses this to decide whether to continue or finish.
- `results`: Annotated with `operator.add`—LangGraph will **append** new results rather than overwrite, making the accumulation automatic and safe.
- `final_answer`: Written only by the Synthesizer, read by the runner.

---

### Step 4: Define the Tools

The Executor has access to three tools covering the most common travel research needs:

```python
import os, json, requests, wikipedia
from langchain_community.tools import DuckDuckGoSearchRun
from langchain_core.tools import tool

_ddg = DuckDuckGoSearchRun()

@tool
def web_search(query: str) -> str:
    """Search the web using DuckDuckGo. Returns a brief summary of results.
    Useful for finding travel blogs, hotel prices, and current events."""
    try:
        return _ddg.run(query)
    except Exception as e:
        return f"Search failed: {e}"


@tool
def wikipedia_lookup(topic: str) -> str:
    """Look up a topic on Wikipedia and return a 3-sentence summary.
    Useful for destination history and cultural facts."""
    try:
        return wikipedia.summary(topic, sentences=3, auto_suggest=True)
    except wikipedia.exceptions.DisambiguationError as e:
        options_str = ", ".join(e.options[:3]) if e.options else "none"
        return f"Ambiguous topic. Did you mean: {options_str}?"
    except wikipedia.exceptions.PageError:
        return f"Wikipedia page '{topic}' does not exist."
    except Exception as e:
        return f"Wikipedia lookup failed: {e}"


@tool
def get_weather(city: str) -> str:
    """Get current weather for a city.
    Requires OPENWEATHER_API_KEY (free tier). Falls back to mock if key is missing."""
    api_key = os.getenv("OPENWEATHER_API_KEY")
    if not api_key:
        return (
            f"[Mock weather — set OPENWEATHER_API_KEY for real data] "
            f"Weather in {city}: 22°C, partly cloudy, humidity 60%."
        )
    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {"q": city, "appid": api_key, "units": "metric"}
    try:
        r = requests.get(url, params=params, timeout=10)
        data = r.json()
        if r.status_code != 200:
            return f"Weather API error: {data.get('message', 'unknown error')}"
        desc = data["weather"][0]["description"]
        temp = data["main"]["temp"]
        feels = data["main"]["feels_like"]
        humid = data["main"]["humidity"]
        return f"Weather in {city}: {desc}, {temp}°C (feels like {feels}°C), humidity {humid}%."
    except Exception as e:
        return f"Weather fetch failed: {e}"


TOOLS = [web_search, wikipedia_lookup, get_weather]
```

#### Tool Design Principles

- Each tool has a **clear, single responsibility** and a docstring the LLM can read.
- Tools include **graceful fallbacks** (mock weather when API key is absent, disambiguation for Wikipedia).
- Tools are **stateless**—they take input, return output, with no side effects.

---

### Step 5: LLM Setup with Multi-Provider Fallback

A key strength of this design is provider flexibility—you can use Groq for free development and switch to OpenAI for production without changing any other code:

```python
from langchain_groq import ChatGroq
from langgraph.prebuilt import ToolNode

TOOL_NODE = ToolNode(TOOLS)

def get_llm(bind_tools: bool = False):
    groq_api_key    = os.getenv("GROQ_API_KEY")
    google_api_key  = os.getenv("GOOGLE_API_KEY")
    openai_api_key  = os.getenv("OPENAI_API_KEY")

    if groq_api_key:
        llm = ChatGroq(model="llama-3.1-8b-instant", temperature=0.2, api_key=groq_api_key)
    elif google_api_key:
        from langchain_google_genai import ChatGoogleGenerativeAI
        llm = ChatGoogleGenerativeAI(model="gemini-flash-latest", temperature=0.2, api_key=google_api_key)
    elif openai_api_key:
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2, api_key=openai_api_key)
    else:
        raise ValueError(
            "No API key found. Set GROQ_API_KEY, GOOGLE_API_KEY, or OPENAI_API_KEY."
        )

    if bind_tools:
        return llm.bind_tools(TOOLS)   # Executor needs tool-calling capability
    return llm                         # Planner and Synthesizer do not
```

> **Note**: `bind_tools=True` is passed only to the Executor. The Planner uses **structured output** (`with_structured_output`) instead, which produces a validated Pydantic object rather than tool calls.

---

### Step 6: The Planner Node

The Planner is the strategic brain. It uses `with_structured_output` to enforce a validated, typed plan—eliminating the need for fragile string parsing:

```python
from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage, SystemMessage

class Plan(BaseModel):
    name: str = Field(description="A brief name for the travel plan.", default="")
    steps: List[str] = Field(
        description="Ordered list of concise, actionable steps to research the travel request."
    )

PLANNER_PROMPT = SystemMessage(content="""You are a world-class Trip Advisor planning agent.
Given a user's travel request, produce a list of concise, actionable research steps.
Each step should be specific enough for another agent to execute using these tools:
  - web_search(query)       → Find attractions, hotels, travel tips
  - wikipedia_lookup(topic) → Get history and cultural facts
  - get_weather(city)       → Check current weather for packing advice

RESTRICTION: You are strictly restricted to answering questions about trip planning and travel advice.
If a user asks about anything else, produce a single step that tells the executor to politely decline.
""")


def planner_node(state: AgentState) -> dict:
    llm = get_llm().with_structured_output(Plan)

    try:
        response = llm.invoke([
            PLANNER_PROMPT,
            HumanMessage(content=f"Request: {state['goal']}")
        ])
        plan = response.steps
    except Exception as e:
        plan = []

    # Safety net: if planner fails, create a minimal fallback plan
    if not plan:
        plan = [f"Address the user travel request directly: {state['goal']}"]

    return {
        "plan": plan,
        "current_step_index": 0,
        "results": [],
    }
```

#### Why Structured Output?

Using `.with_structured_output(Plan)` instead of a raw LLM call gives us:

- **Type safety**: The response is a validated Pydantic `Plan` object, not an unparsed string.
- **Reliability**: The LLM is constrained to produce valid JSON matching the schema.
- **Inspectability**: You can log `response.steps` directly—no regex or JSON parsing required.

---

### Step 7: The Executor Node

The Executor is the operational workhorse. For each plan step, it receives a focused prompt containing only the current step, the goal, and a summary of previously completed work:

```python
EXECUTOR_PROMPT = """You are a diligent Travel Research agent. Your job is to complete ONE specific step.

Overall travel request: {goal}
Completed research so far:
{completed}

Current task to execute: {step}

Use the available tools to complete this task.
After using tools, provide a concise result summary (2-3 sentences max), focusing on useful travel information.
"""

def executor_node(state: AgentState) -> dict:
    idx   = state["current_step_index"]
    step  = state["plan"][idx]
    goal  = state["goal"]

    # Build a summary of what has been completed so far
    completed_summary = ""
    for i, r in enumerate(state.get("results", [])):
        completed_summary += f"  Step {i+1}: {r}\n"
    if not completed_summary:
        completed_summary = "  None yet.\n"

    llm = get_llm(bind_tools=True)
    messages = [
        SystemMessage(content=EXECUTOR_PROMPT.format(
            goal=goal, completed=completed_summary, step=step
        )),
        HumanMessage(content=f"Execute this task: {step}")
    ]

    # Inner tool-use loop (max 3 iterations per step)
    max_iterations = 3
    iterations = 0
    while iterations < max_iterations:
        response = llm.invoke(messages)
        messages.append(response)

        if not response.tool_calls:
            break                                     # No more tools needed for this step

        tool_results = TOOL_NODE.invoke({"messages": messages})
        messages.extend(tool_results["messages"])
        iterations += 1

    # Extract text content from the final response
    content = response.content
    if isinstance(content, list):
        content = " ".join(
            c.get("text", "") if isinstance(c, dict) else str(c)
            for c in content
        )
    result_text = content.strip() if content else f"Completed: {step}"

    return {
        "results": [f"Step {idx + 1} ({step}): {result_text}"],
        "current_step_index": idx + 1,
    }
```

#### Context Window Management

A key advantage over the ReAct pattern: the Executor's context is **refreshed for each step**. The `EXECUTOR_PROMPT` only includes:
- The original goal (immutable anchor)
- A brief summary of previous results (not the full raw tool outputs)
- The specific current step

This prevents context window bloat as the number of steps grows—a critical advantage for long workflows.

---

### Step 8: The Synthesizer Node

Once all research steps are complete, the Synthesizer compiles the findings into an engaging, well-formatted travel itinerary:

```python
SYNTHESIZER_PROMPT = """You are an expert Trip Advisor and Travel Agent.
The user submitted a travel request, and your research team gathered information.

User Request: {goal}

Research Results:
{results}

Write an engaging, well-structured travel itinerary or advice response using Markdown.
Include:
- A warm greeting as a Trip Advisor.
- Cultural/Historical context (if gathered).
- Top recommendations (attractions, food, accommodation, etc.).
- Weather advice and packing tips (if gathered).
Make it exciting and helpful!

RESTRICTION: If the request is not travel-related, state that you are a Trip Advisor only.
"""

def synthesizer_node(state: AgentState) -> dict:
    llm = get_llm()
    results_text = "\n".join(state["results"])
    response = llm.invoke([
        HumanMessage(content=SYNTHESIZER_PROMPT.format(
            goal=state["goal"],
            results=results_text
        ))
    ])
    content = response.content
    if isinstance(content, list):
        content = " ".join(
            c.get("text", "") if isinstance(c, dict) else str(c)
            for c in content
        )
    return {"final_answer": content.strip() if content else ""}
```

---

### Step 9: The Supervisor Decision Function

The Supervisor is a simple conditional function—not an LLM call—that decides whether to continue execution or hand off to the Synthesizer:

```python
def supervisor_decision(state: AgentState) -> str:
    if state["current_step_index"] < len(state["plan"]):
        return "continue"    # More steps remain
    return "done"            # All steps complete → synthesize
```

This is intentionally deterministic. The Supervisor checks a simple integer comparison: no LLM reasoning, no token cost, no latency. The power comes from the graph routing, not from another model call.

---

### Step 10: Build the LangGraph

Now we wire all components together into a `StateGraph`. The graph defines **what** runs and **in what order**:

```python
from langgraph.graph import END, StateGraph

def build_graph() -> StateGraph:
    graph = StateGraph(AgentState)

    # Register nodes
    graph.add_node("planner",     planner_node)
    graph.add_node("executor",    executor_node)
    graph.add_node("synthesizer", synthesizer_node)

    # Set the entry point
    graph.set_entry_point("planner")

    # Planner always feeds into the first executor step
    graph.add_edge("planner", "executor")

    # After each executor step, the supervisor decides: continue or done
    graph.add_conditional_edges(
        "executor",
        supervisor_decision,
        {
            "continue": "executor",     # Loop back for next step
            "done":     "synthesizer",  # Hand off when all steps done
        }
    )

    # Synthesizer always ends the graph
    graph.add_edge("synthesizer", END)

    return graph.compile()
```

#### Graph Structure Summary

```
START → planner → executor ──(continue)──▶ executor (loop)
                      │
                   (done)
                      │
                      ▼
                 synthesizer → END
```

The self-loop on `executor` is the heart of the pattern. The Supervisor's conditional edge routes back to the same executor node for the next step, with `current_step_index` automatically incremented in the state.

---

### Step 11: The Main Runner

The runner wires everything together for interactive use:

```python
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from dotenv import load_dotenv

load_dotenv()
console = Console()

def run_trip_advisor(goal: str, app: StateGraph) -> str:
    console.print(Panel(
        f"[bold]TRAVEL REQUEST:[/bold] {goal}",
        title="[bold yellow]Trip Advisor Agent[/bold yellow]",
        expand=False
    ))

    final_state = app.invoke({
        "goal":               goal,
        "plan":               [],
        "current_step_index": 0,
        "results":            [],
        "final_answer":       "",
    })

    console.print(Panel(
        Markdown(final_state["final_answer"]),
        title="[bold green]YOUR TRIP ADVISOR PLAN[/bold green]",
        expand=False
    ))
    return final_state["final_answer"]


def main():
    app = build_graph()
    console.print("[bold green]Welcome to the Trip Advisor Chat Bot! (Type 'exit' to end)[/bold green]")

    while True:
        try:
            user_input = input("\nYou: ")
            if user_input.strip().lower() in ("exit", "quit"):
                break
            if not user_input.strip():
                continue
            run_trip_advisor(user_input, app)
        except (KeyboardInterrupt, EOFError):
            break

    console.print("\n[bold green]Safe travels! Goodbye![/bold green]")


if __name__ == "__main__":
    main()
```

---

## How to Run

### 1. Clone / Download the Code

```bash
git clone https://github.com/krishnamohan-seelam/building_agents.git
cd building_agents/learning_langchain/planner_executor
```

### 2. Create and Activate a Virtual Environment

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables

```bash
# Copy the sample env file
cp .env.example .env
# Add your GROQ_API_KEY (free at https://console.groq.com)
```

### 5. Run the Agent

```bash
python trip_planner.py
```

### 6. Example Interactions

**Query 1 — Domestic Trip:**
```text
You: Plan a 4-day trip to Hampi, Karnataka for a history enthusiast
```

**What happens internally:**

```
[TRAVEL PLANNER] Analyzing request: Plan a 4-day trip to Hampi...
[TRAVEL PLANNER] Formulated 5 research steps:
  1. Search top historical monuments and attractions in Hampi
  2. Look up Hampi's history on Wikipedia
  3. Search best budget hotels and guesthouses in Hampi
  4. Get current weather for Hampi
  5. Search travel tips, best time to visit, and how to reach Hampi

[RESEARCHER] Executing step 1/5: Search top historical monuments...
[RESEARCHER] Found: Hampi, a UNESCO World Heritage Site, features the Virupaksha Temple...

[RESEARCHER] Executing step 2/5: Look up Hampi's history...
...

[SUPERVISOR] Research complete. Handing over to Trip Advisor.

[TRIP ADVISOR] Crafting the final travel itinerary...
```

**Query 2 — International Trip:**
```text
You: I want to visit Kyoto, Japan during cherry blossom season. What should I know?
```

**Query 3 — Off-Topic Rejection:**
```text
You: Can you help me write a Python function?
```
```
Sorry, I'm a specialized Trip Advisor and can only assist with travel planning and trip recommendations.
```

---

## State Management: The Key to Reliability

The `AgentState` TypedDict is what makes this pattern robust. Here's how state evolves through a typical 3-step plan:

| Phase | `plan` | `current_step_index` | `results` | `final_answer` |
|-------|--------|----------------------|-----------|----------------|
| After Planner | `["step1", "step2", "step3"]` | `0` | `[]` | `""` |
| After Executor (step 1) | unchanged | `1` | `["Step 1: ..."]` | `""` |
| After Executor (step 2) | unchanged | `2` | `["Step 1: ...", "Step 2: ..."]` | `""` |
| After Executor (step 3) | unchanged | `3` | `["Step 1: ...", "Step 2: ...", "Step 3: ..."]` | `""` |
| After Synthesizer | unchanged | `3` | unchanged | `"Full travel plan..."` |

The `Annotated[List[str], operator.add]` annotation on `results` is a LangGraph feature: instead of overwriting the list on each state update, it **appends** the new entries. This ensures accumulated research is never lost.

---

## Comparison: ReAct vs. Planner-Executor in Practice

The best way to understand the difference is to compare how each approach would handle the same trip planning request:

### ReAct Agent Approach

```
User: Plan a trip to Goa
  → Thought: I should search for Goa attractions
  → Action: web_search("Goa attractions")
  → Observation: [results]
  → Thought: I should check the weather
  → Action: get_weather("Goa")
  → Observation: [weather]
  → Thought: Now I have enough information
  → Final Answer: [synthesized response]
```

*Every "Thought" is a full LLM call with growing context.*

### Planner-Executor Approach

```
User: Plan a trip to Goa
  → [Planner LLM call — once]
     Plan: ["Search Goa beaches", "Wikipedia Goa history", "Get Goa weather", "Find hotels"]

  → [Executor step 1]: web_search("Goa best beaches")
  → [Executor step 2]: wikipedia_lookup("Goa")
  → [Executor step 3]: get_weather("Goa")
  → [Executor step 4]: web_search("Goa budget hotels")

  → [Synthesizer LLM call — once]
     Final Answer: [well-structured itinerary]
```

*Heavy LLM used only twice (Planner + Synthesizer). Executor steps use a smaller, cheaper model.*

---

## Production Considerations

### Dynamic Re-Planning

For resilient production systems, extend the Supervisor to support re-planning when a step fails:

```python
def supervisor_decision(state: AgentState) -> str:
    last_result = state["results"][-1] if state["results"] else ""

    # Detect failure in last result
    if "failed" in last_result.lower() or "error" in last_result.lower():
        # Option 1: Skip and continue
        # Option 2: Route back to planner for regeneration
        return "replan"   # Add a "replan" edge back to planner_node

    if state["current_step_index"] < len(state["plan"]):
        return "continue"
    return "done"
```

### Parallel Execution

If the Planner generates a DAG (Directed Acyclic Graph) instead of a linear list, independent steps can run concurrently. LangGraph's `Send` API supports fan-out execution for this pattern—spinning up multiple executor instances simultaneously, then joining results.

### Human-in-the-Loop Plan Approval

Because the plan is an explicit artifact in the state, you can inject a human approval gate between the Planner and Executor:

```python
graph.add_edge("planner", "human_approval")   # Show plan, wait for user confirmation
graph.add_conditional_edges("human_approval", check_approval, {
    "approved": "executor",
    "rejected": "planner"    # Replann based on user feedback
})
```

---

## Advantages of the Planner-Executor Pattern

1. **Predictability & Auditability** — The plan is a first-class artifact. You can log it, display it, or gate it behind human approval before any action is taken.

2. **Cost & Latency Efficiency** — The expensive high-reasoning model (e.g., GPT-4o, Claude 3.5) is used only for planning. Execution can run on smaller, faster, cheaper models (e.g., Llama 3.1-8b on Groq for free).

3. **Context Window Management** — The Executor's context is refreshed each step. You never pass the full accumulated tool history to the model, avoiding token bloat.

4. **Debuggability** — Failures are always associated with a specific, labeled plan step. You know exactly where to retry, re-plan, or add error handling.

5. **Composability** — The Planner, Executor, and Synthesizer are independent components. You can swap them, scale them separately, or run them on different infrastructure.

6. **Parallelism** — A Planner producing a DAG enables parallel execution of independent steps, dramatically reducing wall-clock time for multi-tool workflows.

---

## When to Use Planner-Executor

✅ **Good fit when:**
- The task has a natural, predictable multi-step structure
- You need the plan to be auditable or subject to human review
- Execution steps are expensive (API calls, database queries, code runs)
- You want to minimize total LLM token cost
- The system must be observable and debuggable in production

❌ **Not a good fit when:**
- The task is simple and benefits from dynamic, reactive adaptation
- Each step's action depends heavily on the *exact* outcome of the previous step (use ReAct)
- Planning overhead exceeds the benefit (e.g., single tool calls)
- The number of steps is unknown or highly variable at plan time

---

## Conclusion

The Planner-Executor pattern represents a natural evolution from the ReAct loop. By separating the strategic brain (Planner) from the operational hands (Executor), you gain a system that is cheaper to run, easier to debug, and far more auditable—all critical properties for production AI agents.

The Trip Advisor example demonstrates how naturally this pattern maps onto real-world workflows: one LLM call generates a complete research agenda; focused executor steps carry it out tool by tool; and a final synthesis pass delivers a polished output. The whole system is observable, cost-efficient, and easy to extend.

**Key takeaways:**
- Use **structured output** in the Planner for type-safe, validated plans
- Keep the **Executor context focused**—only the current step plus a brief summary of past results
- Use the **Supervisor as a deterministic router**—not another LLM call
- Store execution state in **LangGraph's `AgentState`**—`operator.add` for append-only result accumulation
- The plan artifact enables **human-in-the-loop gates** and **dynamic re-planning** for production resilience

Ready to build your own? Start with the Trip Planner, swap out the tools for your domain, and swap the travel restriction prompt for your use case.

## Additional Resources

- [Full Source Code — Trip Planner](https://github.com/krishnamohan-seelam/building_agents/blob/main/learning_langchain/planner_executor/trip_planner.py)
- [Previous Blog: LangGraph Workflow Agents](https://krishnamohan-seelam.github.io/my-blog/ai/python/langchain/2026/05/30/langgraph-workflow-agents.html)
- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [LangGraph — Plan-and-Execute Agent Guide](https://langchain-ai.github.io/langgraph/tutorials/plan-and-execute/plan-and-execute/)
- [Groq — Free LLM API](https://console.groq.com)
- [LangChain Documentation](https://python.langchain.com/)
