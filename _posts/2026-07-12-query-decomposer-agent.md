---
layout: post
title: "Query Decomposer Agents: Dynamic Self-Ask with Search"
date: 2026-07-12
categories: ai python langchain
tags: [AI Agents, Self-Ask, Query Decomposer, LangGraph, Tutorial, Search]
---

## Introduction

In our [previous post on Planner-Executor agents](https://krishnamohan-seelam.github.io/my-blog/ai/python/langchain/2026/06/13/planner-executor-agents.html), we explored how splitting strategy from action helps solve goal drift and reduce token costs in complex tasks. However, that pattern assumes the planning phase can map out every single step **upfront**. What if the next step depends entirely on what we discover in the previous step?

For example, if you ask: *"Who invented the Python programming language, and what university did they study at?"*, the agent first needs to find out *who* invented Python before it can even formulate a query about that person's alma mater. Upfront planning fails here because the second sub-question's target (the university) can't be formulated until the first sub-question's answer (the inventor's name) is known.

To handle these dynamic dependencies, we turn to the **Query Decomposer** pattern, inspired by the classic **Self-Ask with Search** paradigm. Instead of building a static plan first, a Query Decomposer agent works iteratively:

1. **Decomposer** — analyzes the original question and the current findings to decide the next sub-question.
2. **Research** — executes a focused tool (search, wikipedia, or calculator) to answer the sub-question.
3. **Loop** — feeds the result back to the scratchpad and returns to the Decomposer until no more information is needed.
4. **Synthesizer** — compiles the scratchpad history into a comprehensive final answer.

This architecture offers a useful middle ground: the flexibility of ReAct combined with the structured control, traceability, and state predictability of LangGraph.

---

## ReAct vs. Planner-Executor vs. Query Decomposer

Understanding when to use each agent pattern is crucial for building robust AI systems:

| Aspect | ReAct Agent | Planner-Executor | Query Decomposer (Self-Ask) |
|---|---|---|---|
| **Planning style** | Reactive (step-by-step) | Static (entire plan upfront) | Dynamic, but constrained to a strict `Follow-up` / `Final Answer` output contract |
| **Tool Execution** | LLM decides tool call on the fly | Iterates through predefined plan | Runs a dedicated Research node based on the parsed sub-question |
| **Goal Tracking** | Implicit in message history | Explicit plan in state | Explicit scratchpad of Q&A pairs |
| **Best For** | Conversational, highly unpredictable tasks | Multi-task workflows with known structures | Multi-hop reasoning, research, and factual search |

The key difference between ReAct and Query Decomposer isn't just "reactive vs. dynamic" — it's that Query Decomposer forces the LLM into two rigid output formats that a deterministic parser can route on, trading some of ReAct's freedom for predictability and easier debugging.

---

## The Query Decomposer Architecture

The Query Decomposer workflow in LangGraph is structured around four primary components:

```
                  ┌────────────────────────┐
                  │      User Question     │
                  └───────────┬────────────┘
                              │
                              ▼
                  ┌────────────────────────┐
                  │    DECOMPOSER (LLM)    │◀──────────────────┐
                  └───────────┬────────────┘                   │
                              │                                │
                              ▼                                │
                        ┌───────────┐                          │
                        │   ROUTER  │                          │
                        └─────┬─────┘                          │
                              │                                │
                  Follow-up   ├────────────────▶ [ RESEARCH ] ─┘
                  question    │                  (Wikipedia / Web Search)
                              │
                  Final       ▼
                  Answer  ┌────────────────────────┐
                          │   SYNTHESIZER (LLM)    │
                          └───────────┬────────────┘
                                      │
                                      ▼
                          ┌────────────────────────┐
                          │     Final Response     │
                          └────────────────────────┘
```

### 1. The Decomposer Node
The Decomposer receives the original question and a growing **scratchpad** (a list of sub-questions and their respective answers). Its job is to decide whether it has enough information to answer the user.
- If it needs more information, it outputs: `Follow-up [tool_name]: <sub-question>`.
- If it has enough information, it outputs: `Final Answer: <answer>`.

### 2. The Router (Conditional Edge)
A deterministic parser checks the Decomposer's response:
- If it matches `Follow-up`, it routes to the **Research Node**.
- If it matches `Final Answer`, it routes to the **Synthesizer Node**.
- If the response matches neither pattern (the LLM didn't follow instructions), the router falls back to `synthesize` so the graph still terminates gracefully with whatever has been gathered so far.

### 3. The Research Node
This node parses the chosen tool and the sub-question, selects the right tool (falling back to a keyword heuristic if the LLM didn't specify one), invokes it, and appends a `Q: <sub-question> \n A: <answer>` pair to the scratchpad before looping back to the Decomposer.

### 4. The Synthesizer Node
The Synthesizer has two modes. On the normal path, the Decomposer's own `Final Answer:` text is used directly — no extra LLM call is needed. Only if the agent hits the iteration safety limit without producing a clean `Final Answer:` does the Synthesizer make a dedicated call to compile the scratchpad into a response. This two-path design avoids a redundant LLM call on the common case, which is part of what keeps the pattern cheap to run.

---

## Hands-On: Building the Query Decomposer with LangGraph

Let's build a production-grade Query Decomposer agent that can answer complex multi-hop questions using free APIs.

### Step 1: Install Dependencies

Create a virtual environment and install the required libraries:

```bash
pip install langgraph langchain langchain-groq langchain-community \
            duckduckgo-search wikipedia requests python-dotenv pydantic rich
```

### Step 2: Define the Graph State

Unlike Planner-Executor which tracks an execution index, our state tracks the growing `scratchpad` using LangGraph's `operator.add` reducer, allowing us to seamlessly append new Q&A pairs.

```python
import operator
from typing import Annotated, List, TypedDict

class AgentState(TypedDict):
    question: str                                    # Original user question
    scratchpad: Annotated[List[str], operator.add]   # Accumulated Q->A pairs
    final_answer: str                                # Synthesized response
    iterations: int                                  # Loop safety counter
```

### Step 3: Define the System Prompts

We instruct the Decomposer to strictly output one of the two formats: `Follow-up [tool_name]: <question>` or `Final Answer: <text>`. A short set of rules backs this up — in particular, telling the model never to repeat a sub-question already in the scratchpad. That rule, combined with the strict output format and a hard iteration cap, forms a three-layer defense against the agent looping forever on the same question.

```python
DECOMPOSER_SYSTEM = """You are an expert research agent that answers complex questions
by breaking them into focused sub-questions and looking them up one at a time.

You have access to these tools (do NOT call them yourself — just name the right one):
  - web_search      → DuckDuckGo: current events, news, general queries
  - wikipedia_lookup → Wikipedia: encyclopedic facts, history, biographies, science
  - calculator      → Arithmetic: percentages, comparisons, unit conversions

At each step you will receive:
  - The original question
  - A scratchpad showing every sub-question asked so far and its answer

You MUST respond with EXACTLY ONE of these two formats (no other text):

  Follow-up [tool_name]: <a specific, searchable sub-question>

  Final Answer: <your complete, well-structured answer>

Rules:
  1. Use "Follow-up:" when you still need information to fully answer the question.
  2. Use "Final Answer:" only when the scratchpad contains enough information.
  3. Each Follow-up must be a single, focused question answerable by one tool call.
  4. Never repeat a sub-question already in the scratchpad.
  5. For calculator, write the Follow-up as: Follow-up [calculator]: <expression>
  6. The Final Answer must directly address the original question using facts from the scratchpad.
"""

DECOMPOSER_HUMAN_TEMPLATE = """Original question: {question}

Scratchpad:
{scratchpad}

What is your next step?"""
```

### Step 4: Define the Agent Nodes and Router

Here is the implementation of the nodes and the conditional router. Note that `response.content` isn't always a plain string — some providers return a list of content blocks — so we pass it through `_coerce_text` before calling `.strip()`:

```python
import re
from query_decomposer.utils.tools import web_search, wikipedia_lookup, calculator, pick_tool
from query_decomposer.utils.text import _coerce_text, format_scratchpad, WIKI_KEYWORDS

MAX_ITERATIONS = 5
_FOLLOWUP_RE = re.compile(r"Follow-up\s*(?:\[([^\]]+)\])?\s*:\s*(.+)", re.IGNORECASE)
_FINAL_RE = re.compile(r"Final Answer\s*:\s*(.+)", re.IGNORECASE)

TOOLS = {t.name: t for t in [web_search, wikipedia_lookup, calculator]}

def decomposer_node(state: AgentState) -> dict:
    iters = state.get("iterations", 0)
    if iters >= MAX_ITERATIONS:
        return {"iterations": iters + 1, "final_answer": "__synthesize__"}

    llm = get_llm()
    scratch_text = format_scratchpad(state["scratchpad"])
    response = llm.invoke([
        SystemMessage(content=DECOMPOSER_SYSTEM),
        HumanMessage(content=DECOMPOSER_HUMAN_TEMPLATE.format(
            question=state["question"],
            scratchpad=scratch_text,
        ))
    ])

    return {
        "iterations": iters + 1,
        "final_answer": _coerce_text(response.content).strip()
    }

def router(state: AgentState) -> str:
    decision = state["final_answer"]
    if decision == "__synthesize__" or _FINAL_RE.search(decision):
        return "synthesize"
    if _FOLLOWUP_RE.search(decision):
        return "research"
    return "synthesize"

def research_node(state: AgentState) -> dict:
    decision = state["final_answer"]
    match = _FOLLOWUP_RE.search(decision)

    if not match:
        return {"scratchpad": ["Q: (parse error)\nA: Could not parse sub-question."]}

    tool_hint = match.group(1)
    sub_question = match.group(2).strip()

    # pick_tool trusts the LLM's [tool_name] hint when present, and otherwise
    # falls back to a keyword heuristic (WIKI_KEYWORDS) so a missing hint
    # doesn't break routing.
    tool_name = pick_tool(tool_hint, sub_question, WIKI_KEYWORDS, TOOLS)
    tool_fn = TOOLS[tool_name]

    # Each tool expects a differently named argument, so dispatch has to
    # branch on tool_name rather than calling every tool the same way.
    if tool_name == "wikipedia_lookup":
        answer = tool_fn.invoke({"topic": sub_question})
    elif tool_name == "calculator":
        answer = tool_fn.invoke({"expression": sub_question})
    else:  # web_search
        answer = tool_fn.invoke({"query": sub_question})

    # Truncate long results so the scratchpad doesn't bloat the context
    # window across many iterations.
    if len(answer) > 800:
        answer = answer[:800] + "... [truncated]"

    return {
        "scratchpad": [f"Q: {sub_question}\nA: {answer}"]
    }

def synthesizer_node(state: AgentState) -> dict:
    decision = state.get("final_answer", "")

    # Case 1: the Decomposer already produced "Final Answer: ..." — use it
    # as-is, no extra LLM call needed.
    final_match = _FINAL_RE.search(decision)
    if final_match and decision != "__synthesize__":
        return {"final_answer": final_match.group(1).strip()}

    # Case 2: safety limit was hit without a clean answer — synthesize
    # from the scratchpad with a dedicated LLM call.
    llm = get_llm()
    scratch_text = format_scratchpad(state.get("scratchpad", []))
    response = llm.invoke([
        HumanMessage(content=SYNTHESIZER_PROMPT.format(
            question=state["question"],
            scratchpad=scratch_text,
        ))
    ])
    return {"final_answer": _coerce_text(response.content).strip()}
```

### Step 5: Build and Compile the Graph

We connect the nodes into a looping `StateGraph`:

```python
from langgraph.graph import StateGraph, END

def build_graph():
    graph = StateGraph(AgentState)

    # Register Nodes
    graph.add_node("decomposer", decomposer_node)
    graph.add_node("research", research_node)
    graph.add_node("synthesizer", synthesizer_node)

    # Set entry point
    graph.set_entry_point("decomposer")

    # Add conditional router
    graph.add_conditional_edges(
        "decomposer",
        router,
        {
            "research": "research",
            "synthesize": "synthesizer"
        }
    )

    # Loop back to decomposer after research
    graph.add_edge("research", "decomposer")
    graph.add_edge("synthesizer", END)

    return graph.compile()
```

### Step 6: Run It

```python
def run_agent(question: str) -> str:
    app = build_graph()
    final_state = app.invoke({
        "question": question,
        "scratchpad": [],
        "final_answer": "",
        "iterations": 0,
    })
    return final_state["final_answer"]

if __name__ == "__main__":
    answer = run_agent(
        "Who invented the Python programming language, "
        "and what university did they study at?"
    )
    print(answer)
```

---

## State Management in Action

Watch how the state dynamically changes during a run for the query: *"Who invented Python, and what university did they attend?"*

| Iteration | `scratchpad` | Decomposer Decision |
|---|---|---|
| **0** | `[]` | `Follow-up [web_search]: Who invented Python?` |
| **1** | `["Q: Who invented Python? \n A: Guido van Rossum."]` | `Follow-up [web_search]: Where did Guido van Rossum attend university?` |
| **2** | `["...", "Q: Where did Guido... \n A: University of Amsterdam."]` | `Final Answer: Guido van Rossum invented Python and attended the University of Amsterdam.` |

LangGraph handles this state evolution gracefully, maintaining auditability at every hop. Because Iteration 2 produced a clean `Final Answer:`, the Synthesizer uses it directly — the LLM is never called a third time just to reformat text it already wrote.

---

## Advantages of the Query Decomposer Pattern

1. **Focused Tool Calls**: Each Research step operates on a single, isolated sub-question rather than the full conversation history, keeping individual tool invocations cheap. The scratchpad itself is still resent to the Decomposer on every loop, so very long multi-hop chains will eventually see rising token costs too — this pattern trades some context growth for much tighter, more targeted tool calls than a general-purpose ReAct loop.
2. **Strict Structure**: Restricting the LLM to output precise formats ensures deterministic routing.
3. **Traceability**: The scratchpad acts as an explicit log of what sub-questions were asked and answered, making the agent's logic perfectly auditable. In the full implementation, every node transition, LLM call (with latency and token usage), and tool invocation is also logged as structured JSON — useful if you want to debug a run after the fact rather than just watching it stream by.

## Summary

The Query Decomposer is a powerful agentic pattern that dynamically breaks down complex research tasks step-by-step. By combining **LangGraph**'s state loops with structured formats, you get a system that is transparent, cheap to run, and highly capable of multi-hop reasoning.

## Additional Resources
- [Full Source Code — Query Decomposer](https://github.com/krishnamohan-seelam/building_agents/tree/main/query_decomposer)
