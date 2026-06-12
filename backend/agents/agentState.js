class AgentState {
  constructor(query, options = {}) {
    this.query = query;
    this.depth = options.depth || "deep";
    this.topK = options.topK || 8;               // ↑ from 3 → 8
    this.verifyCitations = options.verifyCitations !== false;
    this.language = options.language || "en";
    this.images = options.images || [];
    this.useKnowledgeBase = options.useKnowledgeBase !== false;

    // NEW: Conversation memory injected from session history
    this.conversationHistory = options.conversationHistory || [];

    // Planner outputs
    this.plan = [];
    this.intent = "chat";
    this.jurisdiction = options.jurisdiction || "general";
    this.frameworks = [];                        // ["GDPR", "HIPAA", ...]
    this.expandedQueries = [];                   // Query expansion variants

    // Retriever outputs
    this.retrievedNodes = [];
    this.rerankScores = {};                      // chunk id → rerank score

    // Agent outputs
    this.complianceGaps = [];
    this.analysisResults = null;
    this.finalAnswer = "";
    this.confidenceScore = 100;                  // 0–100
    this.unverifiedCitations = [];               // Hallucination flag list

    this.reasoningChain = [];
  }

  addThought(agentName, text) {
    this.reasoningChain.push({ type: "thought", name: agentName, text, timestamp: new Date() });
    console.log(`[🧠 THOUGHT][${agentName}]: ${text}`);
  }

  addToolCall(agentName, toolName, args) {
    this.reasoningChain.push({ type: "tool", name: toolName, text: `Args: ${JSON.stringify(args)}`, timestamp: new Date() });
    console.log(`[🛠️ TOOL][${agentName} → ${toolName}]: ${JSON.stringify(args)}`);
  }

  addObservation(agentName, text) {
    this.reasoningChain.push({ type: "observation", name: agentName, text, timestamp: new Date() });
    console.log(`[👀 OBS][${agentName}]: ${text}`);
  }
}

module.exports = AgentState;
