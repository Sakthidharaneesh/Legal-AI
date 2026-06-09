class AgentState {
  constructor(query, options = {}) {
    this.query = query;
    this.depth = options.depth || "deep";
    this.topK = options.topK || 3;
    this.verifyCitations = options.verifyCitations !== false;
    this.language = options.language || "en"; // 'en' or 'ta'

    // Outputs from nodes
    this.plan = [];
    this.retrievedNodes = [];
    this.complianceGaps = [];
    this.analysisResults = null;
    this.finalAnswer = "";

    // The live timeline of agent reasoning
    this.reasoningChain = [];
  }

  addThought(agentName, text) {
    this.reasoningChain.push({
      type: "thought",
      name: agentName,
      text,
      timestamp: new Date(),
    });
    console.log(`[🧠 THOUGHT][${agentName}]: ${text}`);
  }

  addToolCall(agentName, toolName, args) {
    this.reasoningChain.push({
      type: "tool",
      name: toolName,
      text: `Invoked with arguments: ${JSON.stringify(args)}`,
      timestamp: new Date(),
    });
    console.log(`[🛠️ TOOL CALL][${agentName} -> ${toolName}]: ${JSON.stringify(args)}`);
  }

  addObservation(agentName, text) {
    this.reasoningChain.push({
      type: "observation",
      name: agentName,
      text,
      timestamp: new Date(),
    });
    console.log(`[👀 OBSERVATION][${agentName}]: ${text}`);
  }
}

module.exports = AgentState;
