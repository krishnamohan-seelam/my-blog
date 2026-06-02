---
layout: post
title: "From ReAct to LangGraph: Building Production-Ready Workflow Agents"
date: 2026-05-30
categories: ai python langchain
tags: [AI Agents, ReAct, Tutorial, Finance, LangGraph]
---

## Introduction

In the [previous blog post](https://krishnamohan-seelam.github.io/my-blog/ai/python/langchain/2026/05/09/financial-analyst-react-agent.html), we built a Financial Analyst ReAct agent using LangChain's high-level `create_agent` wrapper. This approach was excellent for rapid prototyping and demonstrating the ReAct pattern:

1. **Thought**: The agent reasons about the user's request and decides which tool to use.
2. **Action**: The agent calls the selected tool with the appropriate inputs.
3. **Observation**: The agent receives the output from the tool.
4. **Cycle repeats** until the agent has enough information to provide a final Answer.

However, when transitioning from prototyping to production, we encounter new requirements:

- **Error Handling**: Gracefully recover from tool failures
- **Rate Limiting**: Throttle requests to respect API limits
- **Observability**: Log and monitor agent behavior
- **State Persistence**: Save conversation history across sessions
- **Complex Workflows**: Orchestrate multi-step processes with conditional logic

To address these production requirements, we need a more explicit, flexible approach: **LangGraph**.

<img src="{{ site.baseurl }}/assets/langgraph_financial_analyst_workflow.png" alt="LangGraph Financial Analyst Workflow" style="width: 80vw; max-width: 600px; position: relative; left: 50%; transform: translateX(-50%); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />

## What is LangGraph?

**LangGraph** is a framework for building stateful, multi-actor applications with LLMs. It represents agent workflows as **directed graphs** where:

- **Nodes** are functions that encode the logic of an agent (e.g., reasoning, tool execution)
- **Edges** define the flow of control and data between nodes (e.g., "if tool is called, go to tool executor")
- **State** is a shared data structure that persists information across the entire workflow

This graph-based approach provides unprecedented control over agent behavior, making it ideal for production systems.

## Key Differences: `create_agent` vs `LangGraph`

Aspect | `create_agent` | `LangGraph`
--- | --- | ---
**Complexity** | Simple, high-level API | More verbose, explicit
**Control** | Limited customization | Full control over workflow
**Error Handling** | Basic exception handling | Custom error handling per node
**State Management** | In-memory chat history | Flexible state with checkpointing
**Observability** | Limited | Full visibility into graph execution
**Best For** | Prototyping, MVPs | Production systems, complex workflows

## LangGraph Core Components

### 1. State

The **State** is a TypedDict that defines what data flows through your graph. It's shared across all nodes and persists throughout the workflow.

```python
from typing import TypedDict, Annotated, List
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    messages: Annotated[List[BaseMessage], add_messages]
```

#### Key Points

- `messages`: List of all messages in the conversation
- `add_messages`: Utility function that intelligently merges new messages with existing ones
- `Annotated`: Allows customization of how state updates are merged

### 2. Nodes

**Nodes** are functions that perform work. They receive the current state, process it, and return updates to the state. Each node encapsulates a specific piece of logic.

```python
class AgentState(TypedDict):
    messages: Annotated[list, add_messages]

class AssistantNode:
    """LLM node that processes messages and generates responses."""
    def __init__(self, llm_with_tools, system_prompt=None):
        self.llm_with_tools = llm_with_tools
        self.system_prompt = system_prompt

    def __call__(self, state: AgentState) -> dict:
        messages = state["messages"]
        
        # Inject system prompt at the beginning if provided
        if self.system_prompt:
            messages = [SystemMessage(content=self.system_prompt)] + messages
        
        # Call the LLM with tools
        response = self.llm_with_tools.invoke(messages)
        
        # Return updated state with the assistant's response
        return {"messages": [response]}
```

#### Anatomy of a Node

1. **Input**: Receives the current `AgentState`
2. **Processing**: Performs work (LLM inference, tool execution, etc.)
3. **Output**: Returns a dictionary with state updates

#### Special Nodes

##### START Node

The entry point of your graph. Automatically created.

##### END Node

The exit point of your graph. Automatically created.

##### ToolNode

A pre-built node from LangGraph that executes tools based on LLM function calls.

```python
from langgraph.prebuilt import ToolNode

tools = [get_duckduckgo_results, get_stock_price_results]
tool_node = ToolNode(tools)
```

### 3. Edges

**Edges** define the flow of control between nodes. They determine which node executes next based on the current state.

```python
from langgraph.graph import StateGraph

builder = StateGraph(AgentState)

# Add nodes
builder.add_node("assistant", AssistantNode(llm_with_tools, system_prompt))
builder.add_node("tools", ToolNode(tools))

# Add edges
builder.add_edge("tools", "assistant")  # After tools run, go back to assistant
builder.set_entry_point("assistant")    # Start at the assistant node
```

#### Types of Edges

##### 1. Normal Edges

Direct, unconditional transitions from one node to another.

```python
builder.add_edge("tools", "assistant")  # Always go from tools to assistant
```

##### 2. Conditional Edges

Use a function to determine the next node based on state.

```python
from langgraph.prebuilt import tools_condition

builder.add_conditional_edges("assistant", tools_condition)
```

The `tools_condition` function checks if the LLM returned tool calls:

- If yes → route to "tools" node
- If no → route to END (finish)

##### 3. Conditional Entry Points

Determine the starting node based on initial state.

```python
def route_entry_point(state: AgentState) -> str:
    if len(state["messages"]) > 5:
        return "cache_check"  # Check cache first if conversation is long
    return "assistant"

builder.add_conditional_edges(START, route_entry_point)
```

## Building a Production-Ready Financial Analyst with LangGraph

Now let's implement the Financial Analyst agent using LangGraph, adding state persistence via SQLite checkpointing.

### Step 1: Import Dependencies

```python
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from langchain_community.tools import DuckDuckGoSearchRun
from langchain_community.utilities import DuckDuckGoSearchAPIWrapper
from langgraph.graph.message import add_messages
from langgraph.graph import StateGraph
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.checkpoint.sqlite import SqliteSaver
from langchain_core.messages import SystemMessage, HumanMessage
import yfinance as yf
from typing import Literal, TypedDict, Annotated
import os
```

### Step 2: Define the State

```python
class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
```

This simple state holds all messages in the conversation. The `add_messages` function ensures new messages are intelligently merged with existing ones.

### Step 3: Define Tools

```python
@tool
def get_stock_price_results(
    ticker_symbol: str, 
    period: Literal["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"] = "1mo"
) -> dict:
    """
    Fetch historical stock price data using Yahoo Finance.
    For Indian stocks, append '.NS' to the symbol (e.g., 'RELIANCE.NS' or 'TCS.NS').
    Useful for when you need to get stock prices and trends.
    """
    try:
        stock = yf.Ticker(ticker_symbol)
        history = stock.history(period=period)
        
        if history.empty:
            return {"error": "No data found for this ticker."}
            
        return {str(k.date()): v for k, v in history['Close'].tail(5).to_dict().items()}
    except Exception as e:
        return {"error": f"Error fetching historical data: {e}"}

@tool
def get_duckduckgo_results(query: str, num_results: int = 5) -> str:
    """
    Fetch search results from DuckDuckGo.
    Useful for when you need to answer questions about current events or general knowledge.
    """
    try:
        wrapper = DuckDuckGoSearchAPIWrapper(max_results=num_results)
        search_tool = DuckDuckGoSearchRun(api_wrapper=wrapper)
        results = search_tool.invoke(query)
        return results
    except Exception as e:
        return f"Failed to fetch results: {e}"

def get_tools():
    return [get_duckduckgo_results, get_stock_price_results]
```

### Step 4: Create the AssistantNode

```python
class AssistantNode:
    """
    Chatbot node that processes messages and generates responses.
    This is where the LLM reasoning happens.
    """
    def __init__(self, llm_with_tools, system_prompt=None):
        self.llm_with_tools = llm_with_tools
        self.system_prompt = system_prompt

    def __call__(self, state: AgentState) -> dict:
        messages = state["messages"]
        
        # Inject system prompt at the beginning
        if self.system_prompt:
            messages = [SystemMessage(content=self.system_prompt)] + messages
        
        # Call the LLM (which has tools bound to it)
        response = self.llm_with_tools.invoke(messages)
        
        # Return the response as a new message in the state
        return {"messages": [response]}
```

### Step 5: Build the Agent Graph

```python
def build_agent_graph(llm, tools, system_prompt=None, checkpointer=None):
    """
    Build the LangGraph workflow for the Financial Analyst agent.
    
    Args:
        llm: Language model (ChatOpenAI)
        tools: List of tools the agent can use
        system_prompt: Instructions for the agent
        checkpointer: Optional persistence layer (e.g., SqliteSaver)
    
    Returns:
        Compiled graph ready for invocation
    """
    
    # Bind tools to the LLM so it knows how to call them
    llm_with_tools = llm.bind_tools(tools)
    
    # Create the state graph
    builder = StateGraph(AgentState)
    
    # Add nodes
    builder.add_node("assistant", AssistantNode(llm_with_tools, system_prompt))
    builder.add_node("tools", ToolNode(tools))
    
    # Add edges
    # From assistant, conditionally route: if tool call → "tools", else → END
    builder.add_conditional_edges("assistant", tools_condition)
    
    # After tools execute, always go back to assistant for reasoning
    builder.add_edge("tools", "assistant")
    
    # Set the starting point
    builder.set_entry_point("assistant")
    
    # Compile with optional checkpointing for persistence
    return builder.compile(checkpointer=checkpointer)
```

### Step 6: Implement Checkpointing

The key innovation here is **SqliteSaver**, which persists the conversation state across sessions:

```python
from langgraph.checkpoint.sqlite import SqliteSaver

# Create a checkpointer that saves to a SQLite database
with SqliteSaver.from_conn_string("financial_analyst_workflow.sqlite3") as memory:
    # Build the agent with persistence
    agent = build_agent_graph(llm, tools, system_prompt, checkpointer=memory)
    
    # Use a fixed thread_id to tie all turns to the same conversation
    config = {"configurable": {"thread_id": "session_1"}}
    
    # Invoke the agent - state is automatically loaded and saved
    result = agent.invoke(
        {"messages": [HumanMessage(content=user_input)]},
        config=config,
    )
```

#### Key Benefits

- **Persistence**: Conversation state survives process restarts
- **Multi-threading**: Different thread IDs can maintain separate conversations
- **Debugging**: Full history of state transitions is logged

### Step 7: Complete Main Function

```python
def main():
    configure_environment()
    
    if sys.stdout.encoding != 'utf-8':
        sys.stdout.reconfigure(encoding='utf-8')

    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        raise ValueError("OpenAI API key is not set")

    llm = ChatOpenAI(model="gpt-4o", temperature=0, api_key=openai_api_key)
    tools = get_tools()

    system_prompt = """You are an expert financial analyst assistant.
You have access to financial data tools and a websearch tool.
When analyzing stocks, ALWAYS search for recent news to understand market context.
TRANSPARENCY: Cite your sources—clearly distinguish between Yahoo Finance data and web search insights.
RESTRICTION: Answer only financial questions about stock prices and performance."""

    # Use SqliteSaver for persistent cross-session memory
    with SqliteSaver.from_conn_string("financial_analyst_workflow.sqlite3") as memory:
        agent = build_agent_graph(llm, tools, system_prompt, checkpointer=memory)

        console = Console()
        welcome_text = (
            "Welcome to the **Financial Analyst Agent**!\n\n"
            "This agent now persists conversation history across sessions.\n"
            "Type **'exit'** or **'quit'** to end."
        )
        console.print(Panel(Markdown(welcome_text), title="[bold green]AI Assistant[/bold green]"))

        config = {"configurable": {"thread_id": "financial_analyst_workflow_session_1"}}

        while True:
            try:
                console.print()
                user_input = Prompt.ask("[bold blue]You[/bold blue]")
                
                if user_input.lower() in ['quit', 'exit']:
                    console.print("[bold red]Goodbye![/bold red]")
                    break
                
                if not user_input.strip():
                    continue

                with console.status("[bold yellow]Agent is thinking...[/bold yellow]"):
                    # State is automatically loaded from checkpoint and saved after invocation
                    result = agent.invoke(
                        {"messages": [HumanMessage(content=user_input)]},
                        config=config,
                    )
                
                agent_response = result["messages"][-1].content
                console.print()
                console.print(Panel(Markdown(agent_response), title="[bold green]Financial Analyst[/bold green]"))
                
            except KeyboardInterrupt:
                console.print("\n[bold red]Goodbye![/bold red]")
                break
            except Exception as e:
                console.print(f"\n[bold red]Error: {e}[/bold red]\n")

if __name__ == "__main__":
    main()
```

## How to Test

### 1. Install Dependencies

```bash
pip install langchain langchain-openai langchain-community yfinance duckduckgo-search rich python-dotenv langgraph
```

### 2. Set Environment Variable

```bash
export OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Run the Agent

```bash
python financial_analyst_workflow.py --thread-id session_1
```

### 4. Example Interactions

**Query 1:**

```text
You: What is the current stock price of DIVIS and why is it performing that way?
```

**Expected Output:**

- Agent fetches historical stock data from Yahoo Finance
- Agent searches for recent news about DIVIS
- Agent synthesizes analysis with proper source attribution

**Query 2 (Session Persistence):**
Close the agent and restart:

```bash
python financial_analyst_workflow.py --thread-id session_1
```

The agent will remember your entire conversation history!

<img src="{{ site.baseurl }}/assets/Financial_Analyst_workflow.png" alt="Financial Analyst Agent" style="width: 100vw; max-width: 900px; position: relative; left: 50%; transform: translateX(-50%); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />


## Advantages of LangGraph Approach

1. **Production-Ready**: Explicit control over error handling and state management
2. **Persistent State**: Checkpointing enables cross-session memory
3. **Scalability**: Easy to add new nodes for caching, validation, logging
4. **Debugging**: Full visibility into graph execution and state transitions
5. **Flexibility**: Conditional edges support complex workflows
6. **Monitoring**: Every node execution can be logged and monitored

## Next Steps

This workflow pattern can be extended with:

- **Input Validation Node**: Validate user queries before processing
- **Cache Node**: Check cache before making expensive API calls
- **Error Recovery Node**: Gracefully handle tool failures
- **Rate Limiting**: Use conditional edges to throttle requests
- **Multi-Agent Orchestration**: Coordinate multiple specialized agents

## Conclusion

LangGraph transforms agent development from a simple wrapper (`create_agent`) into a powerful, production-grade framework. By explicitly defining state, nodes, and edges, you gain unprecedented control over your agent's behavior, making it suitable for enterprise applications.

The Financial Analyst agent we built demonstrates:

- **Graph-based workflow design** for complex agent logic
- **State persistence** across sessions via SQLite checkpointing
- **Conditional routing** to handle dynamic agent behavior
- **Tool integration** with error handling

Ready to build your own graph-based agents? Start with simple workflows and progressively add nodes for validation, caching, and monitoring as your system scales.

## Additional Resources

- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [Full Source Code](https://github.com/krishnamohan-seelam/building_agents/blob/main/learning_langchain/financial_analyst_workflow.py)
- [Previous Blog: Building a Financial Analyst ReAct Agent](https://krishnamohan-seelam.github.io/my-blog/ai/python/langchain/2026/05/09/financial-analyst-react-agent.html)
- [LangChain Documentation](https://python.langchain.com/)
