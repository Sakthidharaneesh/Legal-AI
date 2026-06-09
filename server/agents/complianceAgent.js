class ComplianceAgent {
  async execute(state) {
    state.addThought("Compliance Agent", "Evaluating compliance parameters against target framework regulations.");

    const retrievedText = state.retrievedNodes.map(n => n.text).join("\n");
    const queryLower = state.query.toLowerCase();
    const gaps = [];

    // Simple rule-based compliance cross-referencing logic
    if (queryLower.includes("fintech") || queryLower.includes("payment") || queryLower.includes("card")) {
      gaps.push({
        id: "GAP-PCI",
        framework: "PCI-DSS",
        severity: "high",
        requirement: "Cardholder Data Encryption",
        status: "pending",
        details: "Ensure cardholder numbers (PAN) are hashed or tokenized during storage and transit.",
      });
    }

    if (queryLower.includes("health") || queryLower.includes("patient") || queryLower.includes("medical")) {
      gaps.push({
        id: "GAP-HIPAA-BAA",
        framework: "HIPAA",
        severity: "high",
        requirement: "Business Associate Agreements (BAA)",
        status: "pending",
        details: "Confirm signed BAAs exist with all cloud service vendors hosting Protected Health Information (PHI).",
      });
      gaps.push({
        id: "GAP-HIPAA-LOGS",
        framework: "HIPAA",
        severity: "medium",
        requirement: "Audit Logs",
        status: "completed",
        details: "Verify access monitoring logs are generated and retained for 6 years.",
      });
    }

    if (queryLower.includes("gdpr") || queryLower.includes("privacy") || queryLower.includes("user data")) {
      gaps.push({
        id: "GAP-GDPR-72H",
        framework: "GDPR",
        severity: "high",
        requirement: "72-Hour Breach Notification",
        status: "pending",
        details: "Ensure internal playbook enforces reporting data breaches to authorities within 72 hours of discovery.",
      });
      gaps.push({
        id: "GAP-GDPR-DPA",
        framework: "GDPR",
        severity: "medium",
        requirement: "Data Processing Agreement (DPA)",
        status: "pending",
        details: "Draft and append a clear DPA for all third-party user data processors.",
      });
    }

    if (queryLower.includes("ai") || queryLower.includes("model") || queryLower.includes("training")) {
      gaps.push({
        id: "GAP-EU-AI-50",
        framework: "EU AI Act",
        severity: "high",
        requirement: "Transparency Guidelines (Article 50)",
        status: "pending",
        details: "Users must be notified explicitly when they are interacting with an AI system or when outputs are generated dynamically.",
      });
    }

    state.complianceGaps = gaps;
    if (gaps.length > 0) {
      state.addObservation(
        "Compliance Agent",
        `Compliance audit complete. Identified ${gaps.length} potential compliance checkpoints or gaps.`
      );
    } else {
      state.addObservation("Compliance Agent", "No explicit compliance gaps found for query parameters.");
    }

    return state;
  }
}

module.exports = new ComplianceAgent();
