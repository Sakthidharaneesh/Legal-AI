/**
 * Planner Agent — Enhanced
 * - Deep intent classification (5 intents)
 * - Jurisdiction detection (EU, US, UK, India, etc.)
 * - Regulatory framework tagging
 * - Language detection
 * - Execution plan generation
 */

const JURISDICTION_PATTERNS = [
  { pattern: /\b(eu|european union|europe|gdpr|dsgvo)\b/i, jurisdiction: "EU" },
  { pattern: /\b(us|usa|united states|american|federal|california|ccpa|hipaa|flsa)\b/i, jurisdiction: "US" },
  { pattern: /\b(uk|united kingdom|england|wales|scotland|ico)\b/i, jurisdiction: "UK" },
  { pattern: /\b(india|indian|pdpb|it act|sebi|rbi)\b/i, jurisdiction: "India" },
  { pattern: /\b(singapore|pdpa|mas)\b/i, jurisdiction: "Singapore" },
  { pattern: /\b(australia|australian|oaic|privacy act)\b/i, jurisdiction: "Australia" },
];

const FRAMEWORK_PATTERNS = [
  { pattern: /\b(gdpr|general data protection|data protection regulation)\b/i, framework: "GDPR" },
  { pattern: /\b(hipaa|health insurance portability|phi|protected health)\b/i, framework: "HIPAA" },
  { pattern: /\b(soc\s?2|soc2|service organization control)\b/i, framework: "SOC2" },
  { pattern: /\b(eu ai act|ai act|eu ai|artificial intelligence act)\b/i, framework: "EU AI Act" },
  { pattern: /\b(ccpa|california consumer privacy|cpra)\b/i, framework: "CCPA" },
  { pattern: /\b(pci.?dss|payment card industry|cardholder data)\b/i, framework: "PCI-DSS" },
  { pattern: /\b(iso.?27001|information security management)\b/i, framework: "ISO 27001" },
  { pattern: /\b(nist|cybersecurity framework|nist csf)\b/i, framework: "NIST CSF" },
];

const INTENT_RULES = [
  // Analysis / Contract Review
  { pattern: /\b(analyze|analyse|review|audit|check|examine|assess|evaluate|scan)\b.*\b(contract|agreement|clause|document|nda|terms)\b/i, intent: "analysis", taskType: "contract_review" },
  { pattern: /\b(contract|agreement|nda|msa|sla|lease|employment)\b.*\b(risk|risky|dangerous|unfair|one.sided)\b/i, intent: "analysis", taskType: "contract_review" },
  // Compliance
  { pattern: /\b(comply|compliance|compliant|regulations?|rules?|requirements?|checklist|audit trail)\b/i, intent: "compliance", taskType: "compliance_check" },
  { pattern: /\b(am i|are we|is (my|our|this))\b.*(compliant|allowed|permitted|legal|required)\b/i, intent: "compliance", taskType: "compliance_check" },
  // Drafting
  { pattern: /\b(draft|create|generate|write|prepare|make)\b.*\b(contract|agreement|clause|nda|policy|terms)\b/i, intent: "drafting", taskType: "contract_draft" },
  // General QA / Research
  { pattern: /\b(what|how|when|where|who|why|explain|define|describe|tell me)\b/i, intent: "chat", taskType: "legal_qa" },
];

class PlannerAgent {
  async execute(state) {
    state.addThought("Planner Agent", `Classifying intent and jurisdiction for: "${state.query.substring(0, 80)}..."`);

    const q = state.query;
    const plan = [];

    // ── 1. Detect Jurisdiction ────────────────────────────────────────────────
    let jurisdiction = state.jurisdiction || "general";
    for (const { pattern, jurisdiction: jur } of JURISDICTION_PATTERNS) {
      if (pattern.test(q)) { jurisdiction = jur; break; }
    }
    state.jurisdiction = jurisdiction;
    state.addThought("Planner Agent", `Jurisdiction detected: ${jurisdiction}`);

    // ── 2. Detect Regulatory Frameworks ──────────────────────────────────────
    const frameworks = [];
    for (const { pattern, framework } of FRAMEWORK_PATTERNS) {
      if (pattern.test(q)) frameworks.push(framework);
    }
    // If jurisdiction implies a framework, add it
    if (jurisdiction === "EU" && !frameworks.includes("GDPR")) frameworks.push("GDPR");
    if (jurisdiction === "US" && q.toLowerCase().includes("health") && !frameworks.includes("HIPAA")) frameworks.push("HIPAA");
    state.frameworks = frameworks;
    if (frameworks.length > 0) {
      state.addThought("Planner Agent", `Regulatory frameworks identified: ${frameworks.join(", ")}`);
    }

    // ── 3. Classify Intent ────────────────────────────────────────────────────
    let intent = "chat";
    let taskType = "legal_qa";
    for (const rule of INTENT_RULES) {
      if (rule.pattern.test(q)) {
        intent = rule.intent;
        taskType = rule.taskType;
        break;
      }
    }
    state.intent = intent;
    state.addThought("Planner Agent", `Intent classified: ${intent} (${taskType})`);

    // ── 4. Detect Language ────────────────────────────────────────────────────
    const isTamil = /[\u0B80-\u0BFF]/.test(q) || /\btamil\b/i.test(q);
    const isHindi = /[\u0900-\u097F]/.test(q) || /\bhindi\b/i.test(q);
    if (isTamil || state.language === "ta") {
      state.language = "ta";
      state.addThought("Planner Agent", "Tamil language detected.");
      plan.push("Translate final response to Tamil");
    } else if (isHindi || state.language === "hi") {
      state.language = "hi";
      state.addThought("Planner Agent", "Hindi language detected.");
      plan.push("Translate final response to Hindi");
    }

    // ── 5. Build Execution Plan ───────────────────────────────────────────────
    plan.unshift(
      `Intent: ${taskType} | Jurisdiction: ${jurisdiction} | Frameworks: ${frameworks.join(", ") || "None specific"}`,
      "Expand query with legal synonyms for hybrid retrieval",
      "Run hybrid search (dense + BM25) with jurisdiction filter",
      "Re-rank retrieved chunks by cross-encoder relevance",
      "Run specialized agent pipeline based on intent",
      "Synthesize grounded response with citation verification",
      "Score confidence and flag any unverified claims"
    );

    state.plan = plan;
    state.addObservation("Planner Agent", `Plan ready: ${plan.length} steps | Intent: ${intent} | Jurisdiction: ${jurisdiction}`);
    return state;
  }
}

module.exports = new PlannerAgent();
