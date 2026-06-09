class PlannerAgent {
  async execute(state) {
    state.addThought("Planner Agent", `Analyzing query: "${state.query}"`);

    const queryLower = state.query.toLowerCase();
    const plan = [];

    // Check target frameworks
    let frameworks = [];
    if (queryLower.includes("gdpr") || queryLower.includes("general data protection")) {
      frameworks.push("GDPR");
    }
    if (queryLower.includes("hipaa") || queryLower.includes("health insurance")) {
      frameworks.push("HIPAA");
    }
    if (queryLower.includes("soc2") || queryLower.includes("soc 2")) {
      frameworks.push("SOC2");
    }
    if (queryLower.includes("ai act") || queryLower.includes("eu ai")) {
      frameworks.push("EU AI Act");
    }

    if (frameworks.length > 0) {
      state.addThought("Planner Agent", `Identified frameworks: ${frameworks.join(", ")}`);
    } else {
      state.addThought("Planner Agent", "No specific framework mentioned. Planning global legal context search.");
    }

    // Determine query type
    let taskType = "general_qa";
    let intent = "chat";
    if (queryLower.includes("audit") || queryLower.includes("review") || queryLower.includes("contract")) {
      taskType = "audit_request";
      intent = "analysis";
    } else if (queryLower.includes("compliance") || queryLower.includes("checklist") || queryLower.includes("rules")) {
      taskType = "compliance_checklist";
      intent = "compliance";
    }
    state.intent = intent;

    plan.push(`Determine query intent: ${taskType}`);
    plan.push("Retrieve relevant legal documentation nodes via vector search");
    plan.push("Analyze rules and extract active regulatory boundaries");

    if (taskType === "compliance_checklist") {
      plan.push("Cross-reference business parameters to generate custom checklists");
    }

    plan.push("Synthesize findings and compile references");

    // Detect language preference
    const isTamil = /[\u0B80-\u0BFF]/.test(state.query) || queryLower.includes("tamil");
    if (isTamil) {
      state.language = "ta";
      state.addThought("Planner Agent", "Tamil language preference detected. Final output will include bilingual explanations.");
      plan.push("Translate final response to Tamil");
    }

    state.plan = plan;
    state.addObservation("Planner Agent", `Plan finalized: ${JSON.stringify(plan)}`);
    return state;
  }
}

module.exports = new PlannerAgent();
