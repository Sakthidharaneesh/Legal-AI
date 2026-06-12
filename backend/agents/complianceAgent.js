/**
 * Compliance Agent — Upgraded
 * - Uses planner-detected frameworks (not just keywords)
 * - Cross-references retrieved KB chunks for evidence
 * - Covers: GDPR, HIPAA, CCPA, PCI-DSS, EU AI Act, SOC2, ISO 27001, NIST CSF
 * - LLM-enhanced gap analysis when API key is available
 */

const ALL_COMPLIANCE_RULES = {
  GDPR: [
    { id: "GDPR-ART5",  requirement: "Lawful Basis for Processing",          severity: "high",   details: "Establish and document a lawful basis (consent, contract, legal obligation, legitimate interest) for each category of personal data processed." },
    { id: "GDPR-ART17", requirement: "Right to Erasure (Right to be Forgotten)", severity: "high", details: "Implement a data deletion mechanism allowing users to request erasure of their personal data within 30 days." },
    { id: "GDPR-ART28", requirement: "Data Processing Agreements (DPA)",     severity: "high",   details: "Ensure signed DPAs exist with all third-party vendors that process personal data on your behalf." },
    { id: "GDPR-ART33", requirement: "72-Hour Breach Notification",           severity: "high",   details: "Maintain an incident response playbook that guarantees breach notification to supervisory authorities within 72 hours of discovery." },
    { id: "GDPR-ART25", requirement: "Privacy by Design & Default",           severity: "medium", details: "Data protection must be embedded into system design from inception, not bolted on. Default settings must be privacy-protective." },
    { id: "GDPR-ART83", requirement: "Fines & Penalties Awareness",           severity: "medium", details: "Non-compliance can result in fines up to €20M or 4% of global annual turnover. Document compliance efforts as evidence of good faith." },
  ],
  HIPAA: [
    { id: "HIPAA-BAA",  requirement: "Business Associate Agreements (BAA)",   severity: "high",   details: "Execute BAAs with all vendors that access, store, or transmit Protected Health Information (PHI) before sharing any PHI." },
    { id: "HIPAA-SEC",  requirement: "Technical Safeguards (Security Rule)",  severity: "high",   details: "Implement access controls, audit logging, data integrity controls, and transmission security (TLS 1.3+) for all ePHI." },
    { id: "HIPAA-BRN",  requirement: "Breach Notification Rule",              severity: "high",   details: "Notify affected individuals within 60 days of discovering a PHI breach. Notify HHS for breaches affecting >500 individuals." },
    { id: "HIPAA-MINX", requirement: "Minimum Necessary Standard",            severity: "medium", details: "Only access, use, or disclose the minimum PHI necessary to accomplish the intended purpose." },
    { id: "HIPAA-LOGS", requirement: "6-Year Audit Log Retention",            severity: "medium", details: "Retain all PHI access logs and security documentation for a minimum of 6 years." },
  ],
  CCPA: [
    { id: "CCPA-NOTICE", requirement: "Notice at Collection",                 severity: "high",   details: "Provide clear notice to California consumers at the point of data collection specifying categories collected and purposes." },
    { id: "CCPA-OPTOUT", requirement: "Right to Opt-Out of Sale/Sharing",     severity: "high",   details: "Implement a 'Do Not Sell or Share My Personal Information' mechanism on all consumer-facing interfaces." },
    { id: "CCPA-DELETE", requirement: "Right to Deletion",                    severity: "high",   details: "Respond to verified consumer deletion requests within 45 days. Instruct service providers to delete as well." },
    { id: "CCPA-ACCESS", requirement: "Right to Know / Access",               severity: "medium", details: "Disclose categories and specific pieces of personal information collected in the preceding 12 months upon verifiable request." },
  ],
  "PCI-DSS": [
    { id: "PCI-ENC",   requirement: "Cardholder Data Encryption",             severity: "high",   details: "Encrypt Primary Account Numbers (PAN) at rest using AES-256 and in transit using TLS 1.2+. Never store CVV/CVV2." },
    { id: "PCI-ACC",   requirement: "Access Control to Cardholder Data",       severity: "high",   details: "Restrict access to cardholder data on a need-to-know basis. Implement unique user IDs and strong authentication." },
    { id: "PCI-MON",   requirement: "Network Monitoring & Testing",            severity: "high",   details: "Log and monitor all access to cardholder data environments. Conduct quarterly vulnerability scans and annual penetration tests." },
    { id: "PCI-POL",   requirement: "Security Policy",                         severity: "medium", details: "Maintain a security policy addressing information security for all personnel, reviewed annually." },
  ],
  "EU AI Act": [
    { id: "EUAI-T50",  requirement: "AI Transparency Disclosure (Art. 50)",   severity: "high",   details: "Users must be notified when interacting with an AI system. AI-generated content (text, images, audio) must be labelled as machine-generated." },
    { id: "EUAI-RISK", requirement: "High-Risk AI System Assessment",          severity: "high",   details: "Conduct a conformity assessment if the AI system is used in employment, credit scoring, biometric ID, or critical infrastructure." },
    { id: "EUAI-DATA", requirement: "Training Data Governance",                severity: "medium", details: "Document training data sources, ensure data quality, and address biases. Maintain technical documentation." },
    { id: "EUAI-HUM",  requirement: "Human Oversight Mechanisms",              severity: "medium", details: "High-risk AI systems must incorporate human oversight enabling intervention and override of automated decisions." },
  ],
  SOC2: [
    { id: "SOC2-SEC",  requirement: "Security (CC6 — Common Criteria)",       severity: "high",   details: "Implement logical and physical access controls, encryption, and monitoring to protect system components." },
    { id: "SOC2-AVA",  requirement: "Availability SLA Commitments",            severity: "medium", details: "Define and monitor uptime commitments. Establish disaster recovery (RTO/RPO) procedures." },
    { id: "SOC2-CONF", requirement: "Confidentiality Controls",                severity: "medium", details: "Identify confidential information and implement controls (encryption, access limits, NDA enforcement) to protect it." },
  ],
  "ISO 27001": [
    { id: "ISO-ISMS",  requirement: "Information Security Management System", severity: "high",   details: "Establish, document, implement, and continually improve an ISMS covering all in-scope assets." },
    { id: "ISO-RISK",  requirement: "Risk Assessment & Treatment",             severity: "high",   details: "Conduct formal information security risk assessments and implement appropriate risk treatment plans." },
    { id: "ISO-AUDIT", requirement: "Internal Audit Programme",                severity: "medium", details: "Conduct internal audits of the ISMS at planned intervals to verify conformance." },
  ],
  "NIST CSF": [
    { id: "NIST-ID",   requirement: "Identify — Asset Management",             severity: "high",   details: "Maintain an inventory of all information assets (hardware, software, data) and their owners." },
    { id: "NIST-PRO",  requirement: "Protect — Access Control",                severity: "high",   details: "Implement identity management, access control, and security awareness training." },
    { id: "NIST-DET",  requirement: "Detect — Anomaly Detection",              severity: "medium", details: "Deploy continuous monitoring and detection processes to identify cybersecurity events promptly." },
    { id: "NIST-RES",  requirement: "Respond — Incident Response Plan",        severity: "medium", details: "Maintain and test an incident response plan covering communication, analysis, mitigation, and improvements." },
  ],
};

// Keyword triggers for each framework (backup if planner didn't detect)
const FRAMEWORK_TRIGGERS = {
  GDPR:        /\b(gdpr|data protection|privacy|personal data|dpa|dsar|right to erasure|data breach)\b/i,
  HIPAA:       /\b(hipaa|health|patient|phi|medical|ehr|ePHI|hospital|clinic)\b/i,
  CCPA:        /\b(ccpa|cpra|california|consumer privacy|opt.out|do not sell)\b/i,
  "PCI-DSS":   /\b(pci|payment card|cardholder|pan|card number|fintech|stripe|payment)\b/i,
  "EU AI Act": /\b(eu ai|ai act|artificial intelligence act|high.risk ai|transparency|ai system)\b/i,
  SOC2:        /\b(soc.?2|service organization|trust service|aicpa)\b/i,
  "ISO 27001": /\b(iso.?27001|isms|information security management)\b/i,
  "NIST CSF":  /\b(nist|cybersecurity framework|nist csf|asset management|incident response)\b/i,
};

class ComplianceAgent {
  async execute(state) {
    state.addThought("Compliance Agent", "Running framework-aware compliance gap analysis.");

    const q = state.query;
    const gaps = [];

    // Determine which frameworks to check
    let frameworksToCheck = [...(state.frameworks || [])];

    // Add any additionally triggered frameworks from query
    for (const [fw, pattern] of Object.entries(FRAMEWORK_TRIGGERS)) {
      if (pattern.test(q) && !frameworksToCheck.includes(fw)) {
        frameworksToCheck.push(fw);
      }
    }

    // If nothing specific detected, run a broad general check
    if (frameworksToCheck.length === 0) {
      frameworksToCheck = ["GDPR"]; // default
    }

    state.addThought("Compliance Agent", `Checking frameworks: ${frameworksToCheck.join(", ")}`);

    // Cross-reference retrieved context against rules
    const retrievedText = (state.retrievedNodes || []).map(n => n.text).join(" ").toLowerCase();

    for (const fw of frameworksToCheck) {
      const rules = ALL_COMPLIANCE_RULES[fw] || [];
      for (const rule of rules) {
        // Check if this requirement appears to be addressed in the retrieved context or query context
        const keywords = rule.requirement.toLowerCase().split(/\s+/).filter(w => w.length > 4);
        const mentionedInContext = keywords.some(kw => retrievedText.includes(kw) || q.toLowerCase().includes(kw));

        // Always include high-severity gaps; include medium only if not mentioned
        if (rule.severity === "high" || !mentionedInContext) {
          gaps.push({
            id: rule.id,
            framework: fw,
            severity: rule.severity,
            requirement: rule.requirement,
            status: mentionedInContext ? "review" : "pending",
            details: rule.details,
          });
        }
      }
    }

    // Try LLM-enhanced analysis if available and context is rich
    if (state.retrievedNodes?.length > 0 && (process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY)) {
      try {
        gaps.push(...(await this._llmEnhancedGaps(state, frameworksToCheck, gaps) || []));
      } catch (err) {
        console.warn("[ComplianceAgent] LLM enhancement failed (non-critical):", err.message);
      }
    }

    // Deduplicate by id
    const seen = new Set();
    const dedupedGaps = gaps.filter(g => {
      if (seen.has(g.id)) return false;
      seen.add(g.id);
      return true;
    });

    state.complianceGaps = dedupedGaps;
    state.addObservation("Compliance Agent",
      `Gap analysis complete. ${dedupedGaps.length} items across ${frameworksToCheck.join(", ")}. ` +
      `High: ${dedupedGaps.filter(g => g.severity === "high").length}, Medium: ${dedupedGaps.filter(g => g.severity === "medium").length}`
    );

    return state;
  }

  async _llmEnhancedGaps(state, frameworks, existingGaps) {
    const contextSnippet = state.retrievedNodes.slice(0, 3).map(n => n.text.substring(0, 400)).join("\n\n");
    const prompt = `You are a compliance auditor. Based on this context and query, identify any ADDITIONAL compliance gaps not already listed.
Query: "${state.query.substring(0, 200)}"
Frameworks: ${frameworks.join(", ")}
Already identified: ${existingGaps.map(g => g.requirement).join(", ")}
Context: ${contextSnippet}
Return ONLY a JSON array (max 3 items): [{"id":"LLM-1","framework":"...","severity":"high|medium","requirement":"...","details":"...","status":"pending"}]
If no additional gaps, return [].`;

    let response = null;

    if (process.env.OPENAI_API_KEY) {
      const openaiModule = require("openai");
      const OpenAIClass = openaiModule.OpenAI || openaiModule.default || openaiModule;
      const isGroq = process.env.OPENAI_API_KEY.startsWith("gsk_");
      const client = new OpenAIClass({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: isGroq ? "https://api.groq.com/openai/v1" : undefined,
      });
      const res = await client.chat.completions.create({
        model: isGroq ? "llama-3.1-8b-instant" : "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 500,
      });
      response = res.choices[0].message.content;
    }

    if (response) {
      const match = response.match(/\[[\s\S]*?\]/);
      if (match) return JSON.parse(match[0]);
    }
    return [];
  }
}

module.exports = new ComplianceAgent();
