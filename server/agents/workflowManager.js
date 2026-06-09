const { StateGraph, START, END } = require("@langchain/langgraph");
const AgentState = require("./agentState");
const plannerAgent = require("./plannerAgent");
const retrieverAgent = require("./retrieverAgent");
const complianceAgent = require("./complianceAgent");
const analyzerAgent = require("./analyzerAgent");
const responseAgent = require("./responseAgent");

// Define state channels structure
const stateChannels = {
  query: { value: (x, y) => y ?? x, default: () => "" },
  options: { value: (x, y) => y ?? x, default: () => ({}) },
  plan: { value: (x, y) => y ?? x, default: () => [] },
  retrievedNodes: { value: (x, y) => y ?? x, default: () => [] },
  complianceGaps: { value: (x, y) => y ?? x, default: () => [] },
  analysisResults: { value: (x, y) => y ?? x, default: () => null },
  finalAnswer: { value: (x, y) => y ?? x, default: () => "" },
  reasoningChain: { value: (x, y) => x.concat(y), default: () => [] },
  language: { value: (x, y) => y ?? x, default: () => "en" },
  intent: { value: (x, y) => y ?? x, default: () => "chat" }
};

// Node wrapper functions to adapt LangGraph state to existing agents
const plannerNode = async (state) => {
  const tempState = new AgentState(state.query, state.options);
  Object.assign(tempState, state);
  await plannerAgent.execute(tempState);
  return {
    plan: tempState.plan,
    language: tempState.language,
    reasoningChain: tempState.reasoningChain.slice(state.reasoningChain.length),
    intent: tempState.intent || "chat"
  };
};

const retrieverNode = async (state) => {
  const tempState = new AgentState(state.query, state.options);
  Object.assign(tempState, state);
  await retrieverAgent.execute(tempState);
  return {
    retrievedNodes: tempState.retrievedNodes,
    reasoningChain: tempState.reasoningChain.slice(state.reasoningChain.length)
  };
};

const complianceNode = async (state) => {
  const tempState = new AgentState(state.query, state.options);
  Object.assign(tempState, state);
  await complianceAgent.execute(tempState);
  return {
    complianceGaps: tempState.complianceGaps,
    reasoningChain: tempState.reasoningChain.slice(state.reasoningChain.length)
  };
};

const analyzerNode = async (state) => {
  const tempState = new AgentState(state.query, state.options);
  Object.assign(tempState, state);
  await analyzerAgent.execute(tempState);
  return {
    analysisResults: tempState.analysisResults,
    reasoningChain: tempState.reasoningChain.slice(state.reasoningChain.length)
  };
};

const responseNode = async (state) => {
  const tempState = new AgentState(state.query, state.options);
  Object.assign(tempState, state);
  const result = await responseAgent.execute(tempState);
  return {
    finalAnswer: result.answer,
    reasoningChain: tempState.reasoningChain.slice(state.reasoningChain.length)
  };
};

// Routing condition based on intent
const routeIntent = (state) => {
  console.log(`[LangGraph Router] Routing intent: "${state.intent}"`);
  if (state.intent === "compliance") {
    return "compliance";
  } else if (state.intent === "analysis") {
    return "analyzer";
  } else {
    return "retriever";
  }
};

// Build the LangGraph StateGraph
const workflow = new StateGraph({ channels: stateChannels })
  .addNode("planner", plannerNode)
  .addNode("retriever", retrieverNode)
  .addNode("compliance", complianceNode)
  .addNode("analyzer", analyzerNode)
  .addNode("response", responseNode)
  .addEdge(START, "planner")
  .addConditionalEdges("planner", routeIntent, {
    compliance: "compliance",
    analyzer: "analyzer",
    retriever: "retriever"
  })
  .addEdge("retriever", "response")
  .addEdge("compliance", "response")
  .addEdge("analyzer", "response")
  .addEdge("response", END);

// Compile the graph
const compiledGraph = workflow.compile();

class WorkflowManager {
  /**
   * Orchestrates the agent execution pipeline using LangGraph
   * @param {string} query The user's prompt or legal input
   * @param {Object} options Configuration parameters (depth, topK, language, etc.)
   */
  async runWorkflow(query, options = {}) {
    console.log(`[LangGraph] Running graph execution for query: "${query}"`);
    
    // Initial state
    const initialState = {
      query,
      options,
      plan: [],
      retrievedNodes: [],
      complianceGaps: [],
      analysisResults: null,
      finalAnswer: "",
      reasoningChain: [{
        type: "thought",
        name: "Orchestrator",
        text: "Initializing LangGraph agentic workflow execution.",
        timestamp: new Date()
      }],
      language: options.language || "en",
      intent: "chat"
    };

    try {
      const result = await compiledGraph.invoke(initialState);
      
      console.log(`[LangGraph] Completed graph execution. Final Answer length: ${result.finalAnswer.length}`);
      
      return {
        answer: result.finalAnswer,
        verdict: result.complianceGaps.length > 0 ? "warning" : "compliant",
        sources: result.retrievedNodes,
        reasoningChain: result.reasoningChain,
        complianceGaps: result.complianceGaps,
        analysisResults: result.analysisResults,
        language: result.language
      };

    } catch (err) {
      console.error("[LangGraph] Exception during graph execution:", err);
      
      return {
        answer: "Error: The LangGraph Multi-Agent cluster encountered a runtime exception while processing your query.",
        verdict: "warning",
        sources: [],
        reasoningChain: [{
          type: "thought",
          name: "Orchestrator",
          text: `CRITICAL LANGGRAPH EXCEPTION: ${err.message}`,
          timestamp: new Date()
        }],
        complianceGaps: [],
        analysisResults: null,
        language: "en"
      };
    }
  }
}

module.exports = new WorkflowManager();
