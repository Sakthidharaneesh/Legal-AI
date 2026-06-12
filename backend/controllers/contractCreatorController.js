/**
 * Contract Creator Controller
 * Uses LLM APIs (Gemini / Groq) to:
 *  1. Generate full contract drafts from type + parameters
 *  2. Suggest compliant clause rewrites for any given section
 *  3. Validate a drafted contract against major regulations
 */

// Regulation rules database used in heuristic fallback
const REGULATION_RULES = {
  NDA: [
    { id: "NDA-1", regulation: "Uniform Trade Secrets Act (UTSA)", clause: "Definition of Confidential Information", suggestion: "Explicitly define what constitutes confidential information, including but not limited to trade secrets, business strategies, financial data, and technical know-how.", severity: "high" },
    { id: "NDA-2", regulation: "GDPR Article 28", clause: "Data Protection Obligations", suggestion: "Include a clause specifying that any personal data shared under this NDA must be processed in compliance with applicable data protection laws, including GDPR.", severity: "high" },
    { id: "NDA-3", regulation: "Common Law", clause: "Permitted Disclosures", suggestion: "Specify permitted disclosures (e.g., legally compelled disclosure, disclosure to legal counsel) with a notice requirement to the disclosing party.", severity: "medium" },
    { id: "NDA-4", regulation: "UCC / Common Law", clause: "Term and Termination", suggestion: "Define the agreement term clearly. Note that obligations for trade secrets may survive termination indefinitely under UTSA.", severity: "medium" },
    { id: "NDA-5", regulation: "GDPR Article 17 / CCPA", clause: "Return or Destruction of Information", suggestion: "Include a data return/destruction clause specifying timelines and certification requirements upon termination.", severity: "high" },
  ],
  "Service Agreement": [
    { id: "SA-1", regulation: "EU AI Act Article 50", clause: "AI Transparency Disclosure", suggestion: "If AI-generated outputs are included in deliverables, disclose this explicitly. Users must be informed when interacting with AI systems.", severity: "high" },
    { id: "SA-2", regulation: "GDPR Article 28", clause: "Data Processing Terms", suggestion: "If the service involves processing personal data, include a Data Processing Agreement (DPA) or annex specifying controller/processor obligations.", severity: "high" },
    { id: "SA-3", regulation: "Consumer Protection Laws", clause: "Limitation of Liability", suggestion: "Mutual limitation of liability clauses capped at total contract value are generally enforceable; unilateral caps heavily favor one party and may be challenged.", severity: "medium" },
    { id: "SA-4", regulation: "IP Law / Work for Hire Doctrine", clause: "Intellectual Property Ownership", suggestion: "Clearly state whether deliverables are 'work for hire' (client owns IP) or whether the vendor retains underlying IP with a license granted to client.", severity: "high" },
    { id: "SA-5", regulation: "Payment Services Regulations", clause: "Payment Terms", suggestion: "Specify payment milestones, late payment interest rates (check local law limits), and currency. Include dispute resolution for payment disagreements.", severity: "medium" },
  ],
  "Employment Contract": [
    { id: "EC-1", regulation: "Labor Standards Act / FLSA", clause: "Compensation and Classification", suggestion: "Clearly distinguish between exempt/non-exempt employees. Specify overtime entitlements. Misclassification of workers carries significant legal risk.", severity: "high" },
    { id: "EC-2", regulation: "GDPR / CCPA", clause: "Employee Data Privacy", suggestion: "Include a privacy notice explaining what employee personal data is collected, how it is used, and employees' rights under applicable data protection law.", severity: "high" },
    { id: "EC-3", regulation: "NLRA (National Labor Relations Act)", clause: "Non-Compete / Non-Solicitation", suggestion: "Non-compete clauses are heavily regulated. Many US states (e.g., California) ban them outright. Ensure geographic scope and duration are reasonable and jurisdiction-appropriate.", severity: "high" },
    { id: "EC-4", regulation: "Equal Employment Opportunity (EEO)", clause: "Anti-Discrimination Policy", suggestion: "Reference the company's equal employment policy. Ensure termination provisions do not create grounds for discriminatory dismissal claims.", severity: "medium" },
    { id: "EC-5", regulation: "FMLA / Local Leave Laws", clause: "Leave Entitlements", suggestion: "Specify leave entitlements (annual, sick, parental) and ensure compliance with applicable federal and state leave laws.", severity: "medium" },
  ],
  "SaaS Agreement": [
    { id: "SAAS-1", regulation: "EU AI Act / GDPR", clause: "Data Processing and AI Usage", suggestion: "Specify if the SaaS platform uses AI/ML. Disclose data training practices. Include a GDPR-compliant DPA as a schedule.", severity: "high" },
    { id: "SAAS-2", regulation: "GDPR Article 32", clause: "Security Standards", suggestion: "Specify security standards (e.g., SOC 2 Type II, ISO 27001, encryption at rest AES-256 and in transit TLS 1.3) as contractual obligations.", severity: "high" },
    { id: "SAAS-3", regulation: "PCI-DSS (if applicable)", clause: "Payment Data Handling", suggestion: "If the SaaS handles payment card data, explicitly reference PCI-DSS compliance obligations and tokenization requirements.", severity: "high" },
    { id: "SAAS-4", regulation: "Consumer Protection / UCTA", clause: "Service Level Agreement (SLA)", suggestion: "Define uptime commitments (e.g., 99.9%), remedies for downtime (service credits), and exclusions. One-sided SLAs may be unenforceable.", severity: "medium" },
    { id: "SAAS-5", regulation: "CCPA / GDPR", clause: "Data Portability and Deletion", suggestion: "Include provisions for data export (portability) and deletion upon contract termination, with defined timelines.", severity: "high" },
  ],
  "Lease Agreement": [
    { id: "LA-1", regulation: "Local Residential Tenancy Laws", clause: "Security Deposit", suggestion: "Specify security deposit amount, allowable deductions, and return timeline. Many jurisdictions cap deposits and mandate interest accrual.", severity: "high" },
    { id: "LA-2", regulation: "Fair Housing Act (USA)", clause: "Non-Discrimination", suggestion: "Include an explicit non-discrimination clause complying with the Fair Housing Act or equivalent local law.", severity: "high" },
    { id: "LA-3", regulation: "Habitability Standards", clause: "Landlord Repair Obligations", suggestion: "Specify landlord obligations to maintain habitable premises and repair timelines. Breach may give tenants right to withhold rent under local law.", severity: "high" },
    { id: "LA-4", regulation: "Local Tenancy Law", clause: "Early Termination", suggestion: "Define early termination conditions, notice periods, and penalties. Unilateral termination rights heavily favoring the landlord may be unenforceable.", severity: "medium" },
    { id: "LA-5", regulation: "GDPR / Privacy Laws", clause: "Tenant Data Processing", suggestion: "Specify what personal data of tenants is collected and for what purposes (e.g., credit checks, maintenance records).", severity: "medium" },
  ],
};

const CONTRACT_TEMPLATES = {
  NDA: `NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into as of [DATE] by and between:

Disclosing Party: [PARTY_A_NAME], a [STATE] [ENTITY_TYPE] ("Disclosing Party")
Receiving Party: [PARTY_B_NAME], a [STATE] [ENTITY_TYPE] ("Receiving Party")

RECITALS
WHEREAS, the Disclosing Party possesses certain confidential and proprietary information; and
WHEREAS, the Receiving Party desires to receive such information for the purpose of [PURPOSE];

NOW, THEREFORE, in consideration of the mutual covenants herein, the parties agree as follows:

1. DEFINITION OF CONFIDENTIAL INFORMATION
"Confidential Information" means any and all non-public information disclosed by the Disclosing Party to the Receiving Party, whether orally, in writing, or by any other means, including but not limited to trade secrets, business plans, financial data, technical specifications, and customer data.

Confidential Information shall not include information that: (a) is or becomes publicly known through no breach of this Agreement; (b) was rightfully known to the Receiving Party prior to disclosure; (c) is independently developed by the Receiving Party without use of Confidential Information; or (d) is required to be disclosed by law or court order, provided the Receiving Party gives prompt written notice to the Disclosing Party.

2. OBLIGATIONS OF RECEIVING PARTY
The Receiving Party agrees to: (a) hold all Confidential Information in strict confidence; (b) not disclose Confidential Information to any third party without prior written consent; (c) use Confidential Information solely for [PURPOSE]; (d) protect Confidential Information with at least the same degree of care used to protect its own confidential information, but no less than reasonable care.

3. DATA PROTECTION COMPLIANCE
Both parties agree to process any personal data shared under this Agreement in compliance with applicable data protection regulations, including the General Data Protection Regulation (GDPR) and applicable local data protection laws.

4. PERMITTED DISCLOSURES
The Receiving Party may disclose Confidential Information to its employees and professional advisors on a need-to-know basis, provided such persons are bound by confidentiality obligations at least as restrictive as those herein.

5. TERM
This Agreement shall commence on the date first written above and continue for a period of [TERM_YEARS] years. Obligations with respect to trade secrets shall survive termination indefinitely.

6. RETURN OR DESTRUCTION OF INFORMATION
Upon request or termination, the Receiving Party shall promptly return or destroy all Confidential Information and certify such destruction in writing within [DESTRUCTION_DAYS] days.

7. REMEDIES
The Receiving Party acknowledges that breach of this Agreement would cause irreparable harm and that monetary damages would be inadequate. The Disclosing Party shall be entitled to seek injunctive relief without bond or other security.

8. GOVERNING LAW
This Agreement shall be governed by the laws of [GOVERNING_LAW_JURISDICTION], without regard to conflicts of law principles.

9. ENTIRE AGREEMENT
This Agreement constitutes the entire agreement between the parties regarding its subject matter and supersedes all prior negotiations.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.

DISCLOSING PARTY:                    RECEIVING PARTY:

____________________________         ____________________________
[PARTY_A_NAME]                       [PARTY_B_NAME]
By: ________________________         By: ________________________
Name: ______________________         Name: ______________________
Title: _____________________         Title: _____________________
Date: ______________________         Date: ______________________`,

  "Service Agreement": `PROFESSIONAL SERVICES AGREEMENT

This Professional Services Agreement ("Agreement") is entered into as of [DATE] between:

Client: [CLIENT_NAME] ("Client")
Service Provider: [PROVIDER_NAME] ("Provider")

1. SERVICES
Provider agrees to perform the following services: [SERVICE_DESCRIPTION] ("Services"), as further detailed in any Statement of Work (SOW) attached hereto.

2. PAYMENT TERMS
Client shall pay Provider [RATE] [PAYMENT_FREQUENCY]. Invoices are due within [PAYMENT_DAYS] days. Late payments shall accrue interest at [INTEREST_RATE]% per month.

3. INTELLECTUAL PROPERTY
All work product created by Provider under this Agreement shall be considered work-for-hire and ownership shall vest in [IP_OWNER]. Provider retains ownership of pre-existing tools and methodologies.

4. DATA PROTECTION
To the extent Services involve personal data processing, Provider agrees to act as a data processor and comply with all applicable data protection laws including GDPR Article 28 obligations.

5. AI TRANSPARENCY
Where deliverables incorporate AI-generated content, Provider shall disclose such use to Client and ensure compliance with applicable AI regulations including EU AI Act Article 50.

6. LIMITATION OF LIABILITY
Each party's liability is limited to the total fees paid in the [LIABILITY_PERIOD] preceding the claim. Neither party shall be liable for indirect, incidental, or consequential damages.

7. TERM AND TERMINATION
This Agreement commences on [DATE] and continues until [END_DATE] or completion of Services. Either party may terminate with [NOTICE_DAYS] days written notice.

8. GOVERNING LAW
This Agreement shall be governed by [JURISDICTION] law.

SIGNATURES:
Client: ___________________________  Date: __________
Provider: _________________________  Date: __________`,
};

// ─── LLM Helper ──────────────────────────────────────────────────────────────
async function callLLM(systemPrompt, userPrompt) {
  // Try Groq/OpenAI first
  if (process.env.OPENAI_API_KEY) {
    try {
      const OpenAI = require("openai");
      const isGroq = process.env.OPENAI_API_KEY.startsWith("gsk_");
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: isGroq ? "https://api.groq.com/openai/v1" : undefined,
      });
      const model = isGroq ? "llama-3.3-70b-versatile" : "gpt-4o-mini";
      const res = await openai.chat.completions.create({
        model,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        temperature: 0.3,
        max_tokens: 4000,
      });
      return res.choices[0].message.content;
    } catch (err) {
      console.warn("[ContractCreator] OpenAI/Groq failed:", err.message);
    }
  }

  // Try Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      const { GoogleGenerativeAI } = require("@google/generative-ai");
      const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent([systemPrompt, userPrompt]);
      return result.response.text();
    } catch (err) {
      console.warn("[ContractCreator] Gemini failed:", err.message);
    }
  }

  return null; // signal to use heuristic fallback
}

// ─── 1. Generate Contract ─────────────────────────────────────────────────────
exports.generateContract = async (req, res) => {
  try {
    const { contractType, partyA, partyB, purpose, jurisdiction, duration, additionalTerms, industry } = req.body;

    if (!contractType) return res.status(400).json({ error: "Contract type is required." });

    const regulations = REGULATION_RULES[contractType] || [];
    const regulationSummary = regulations.map(r => `- ${r.regulation}: ${r.suggestion}`).join("\n");

    const systemPrompt = `You are an expert legal drafting AI specializing in commercial contracts. You draft clear, professional, and regulation-compliant contracts.

When drafting, you MUST incorporate these regulatory requirements for a ${contractType}:
${regulationSummary || "Apply general best practices for commercial contracts."}

Format the contract in clean, professional legal prose with numbered sections. Use [PLACEHOLDER] format for specific values not provided.`;

    const userPrompt = `Draft a complete, professional ${contractType} with the following parameters:
- Party A (${partyA?.role || "Party A"}): ${partyA?.name || "[PARTY A NAME]"}
- Party B (${partyB?.role || "Party B"}): ${partyB?.name || "[PARTY B NAME]"}
- Purpose: ${purpose || "as mutually agreed"}
- Jurisdiction: ${jurisdiction || "England and Wales"}
- Duration: ${duration || "1 year"}
- Industry: ${industry || "General"}
- Additional Terms: ${additionalTerms || "None specified"}

Include all standard sections for this type of contract and ensure all regulatory requirements are addressed.`;

    let contractText = await callLLM(systemPrompt, userPrompt);

    // Heuristic fallback
    if (!contractText) {
      contractText = CONTRACT_TEMPLATES[contractType] || `[AI generation unavailable. Please configure GEMINI_API_KEY or OPENAI_API_KEY in your .env file to use AI contract generation.]\n\n${contractType.toUpperCase()}\n\nParty A: ${partyA?.name || "N/A"}\nParty B: ${partyB?.name || "N/A"}\nPurpose: ${purpose || "N/A"}\nJurisdiction: ${jurisdiction || "N/A"}`;
    }

    res.json({
      contractText,
      contractType,
      regulations: REGULATION_RULES[contractType] || [],
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[ContractCreator] generateContract error:", err);
    res.status(500).json({ error: "Failed to generate contract." });
  }
};

// ─── 2. Suggest Clause ────────────────────────────────────────────────────────
exports.suggestClause = async (req, res) => {
  try {
    const { clauseTitle, currentText, contractType, jurisdiction } = req.body;
    if (!clauseTitle) return res.status(400).json({ error: "Clause title is required." });

    const relatedReg = (REGULATION_RULES[contractType] || []).find(r =>
      r.clause.toLowerCase().includes(clauseTitle.toLowerCase()) ||
      clauseTitle.toLowerCase().includes(r.clause.toLowerCase())
    );

    const systemPrompt = `You are a specialist legal AI drafting assistant. You provide concise, regulation-compliant clause suggestions.
${relatedReg ? `Key regulation for this clause: ${relatedReg.regulation} — ${relatedReg.suggestion}` : "Apply general legal best practices."}
Return ONLY the improved clause text, no commentary.`;

    const userPrompt = `Suggest an improved, legally sound version of the following clause from a ${contractType || "commercial contract"} governed by ${jurisdiction || "England and Wales"} law:

Clause: "${clauseTitle}"
Current Text: "${currentText || "No current text provided — draft from scratch."}"

Provide a clear, professional, and regulation-compliant clause.`;

    let suggestion = await callLLM(systemPrompt, userPrompt);

    if (!suggestion && relatedReg) {
      suggestion = relatedReg.suggestion;
    } else if (!suggestion) {
      suggestion = `[AI unavailable] Standard ${clauseTitle} clause: The parties agree to comply with all applicable laws and regulations related to ${clauseTitle} in the jurisdiction of ${jurisdiction || "the governing jurisdiction"}.`;
    }

    res.json({
      clauseTitle,
      suggestion,
      regulation: relatedReg || null,
    });
  } catch (err) {
    console.error("[ContractCreator] suggestClause error:", err);
    res.status(500).json({ error: "Failed to generate clause suggestion." });
  }
};

// ─── 3. Validate Contract ─────────────────────────────────────────────────────
exports.validateContract = async (req, res) => {
  try {
    const { contractText, contractType, jurisdiction } = req.body;
    if (!contractText) return res.status(400).json({ error: "Contract text is required." });

    const regulations = REGULATION_RULES[contractType] || [];

    const systemPrompt = `You are an expert legal compliance AI. Analyze the provided contract and identify:
1. Missing regulatory compliance clauses
2. Risk areas (scored high/medium/low)
3. Specific improvement suggestions

Respond in JSON format:
{
  "overallScore": 0-100,
  "issues": [{ "title": "...", "severity": "high|medium|low", "regulation": "...", "description": "...", "suggestion": "..." }],
  "strengths": ["..."],
  "summary": "..."
}`;

    const userPrompt = `Validate this ${contractType || "commercial contract"} for jurisdiction: ${jurisdiction || "England and Wales"}

Regulatory focus areas:
${regulations.map(r => `- ${r.regulation}: ${r.clause}`).join("\n") || "General commercial contract standards"}

CONTRACT TEXT:
${contractText.substring(0, 6000)}`;

    let validationResult = null;
    const llmResponse = await callLLM(systemPrompt, userPrompt);

    if (llmResponse) {
      try {
        const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) validationResult = JSON.parse(jsonMatch[0]);
      } catch (_) {
        // JSON parse failed, use heuristic
      }
    }

    // Heuristic fallback validation
    if (!validationResult) {
      const textLower = contractText.toLowerCase();
      const issues = [];
      let score = 100;

      for (const rule of regulations) {
        const keywords = rule.clause.toLowerCase().split(" ");
        const found = keywords.some(kw => kw.length > 4 && textLower.includes(kw));
        if (!found) {
          issues.push({
            title: `Missing: ${rule.clause}`,
            severity: rule.severity,
            regulation: rule.regulation,
            description: `This contract appears to be missing adequate provisions for ${rule.clause}.`,
            suggestion: rule.suggestion,
          });
          score -= rule.severity === "high" ? 15 : rule.severity === "medium" ? 8 : 4;
        }
      }

      validationResult = {
        overallScore: Math.max(score, 10),
        issues,
        strengths: issues.length === 0 ? ["All key regulatory requirements appear to be addressed."] : ["Some standard clauses identified."],
        summary: `Heuristic analysis found ${issues.length} potential compliance gaps in this ${contractType}.`,
      };
    }

    res.json({ ...validationResult, contractType, jurisdiction });
  } catch (err) {
    console.error("[ContractCreator] validateContract error:", err);
    res.status(500).json({ error: "Failed to validate contract." });
  }
};
