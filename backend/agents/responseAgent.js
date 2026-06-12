/**
 * Response Agent — Upgraded
 * Features:
 *  - Intent-specific legal system prompts
 *  - Conversation memory injection (last 5 exchanges)
 *  - Strict citation grounding (anti-hallucination)
 *  - Confidence scoring
 *  - Jurisdiction-aware output
 *  - Mandatory legal disclaimer
 */

const OpenAI = require("openai");

// ── Legal-Specific System Prompts ──────────────────────────────────────────────
const LEGAL_SYSTEM_PROMPTS = {
  analysis: (jurisdiction, frameworks) => `You are a senior commercial lawyer specialising in contract analysis with 20 years of experience across multiple jurisdictions.

Your task: Analyse the contract or legal query using the RETRIEVED CONTEXT below. Apply IRAC structure where appropriate (Issue → Rule → Application → Conclusion).

JURISDICTION: ${jurisdiction || "General Commercial Law"}
ACTIVE REGULATORY FRAMEWORKS: ${frameworks?.join(", ") || "General"}

CRITICAL RULES:
1. Only cite regulations, articles, and cases that appear in the RETRIEVED CONTEXT below. Do NOT invent citations.
2. If you cannot find a specific regulation in the context, say "Based on general [jurisdiction] contract law principles..." 
3. Flag every high-risk clause with ⚠️ prefix.
4. Structure your output with: ## Executive Summary → ## Risk Analysis → ## Clause-Level Findings → ## Recommended Actions
5. End every response with: "⚖️ *This analysis is AI-generated and does not constitute legal advice. Consult a qualified solicitor/attorney for formal legal opinion.*"`,

  compliance: (jurisdiction, frameworks) => `You are a specialist regulatory compliance officer with deep expertise in data protection, financial services, and technology law.

Your task: Evaluate the compliance status and identify specific regulatory gaps using the RETRIEVED CONTEXT.

JURISDICTION: ${jurisdiction || "General"}
ACTIVE FRAMEWORKS: ${frameworks?.join(", ") || "General Compliance"}

CRITICAL RULES:
1. Reference specific article/section numbers only when they appear in the RETRIEVED CONTEXT. Do not fabricate regulation text.
2. Structure each finding as: [FRAMEWORK] Article/Section → Requirement → Current Gap → Recommended Action → Priority (High/Medium/Low)
3. Provide an overall compliance score (0-100) based on gaps found.
4. Format output as: ## Compliance Score → ## Critical Gaps → ## Action Plan → ## Compliance Checklist
5. End with legal disclaimer.`,

  drafting: (jurisdiction, frameworks) => `You are an expert contract drafter with deep knowledge of commercial law across multiple jurisdictions.

Your task: Draft or improve contract language that is clear, enforceable, and regulatory-compliant.

JURISDICTION: ${jurisdiction || "England and Wales"}
APPLICABLE FRAMEWORKS: ${frameworks?.join(", ") || "General Commercial"}

CRITICAL RULES:
1. Every drafted clause must address the applicable regulatory requirements shown in RETRIEVED CONTEXT.
2. Flag any clause that may be unenforceable or challengeable under local law.
3. Use precise legal language — avoid ambiguity.
4. For each major clause: provide the draft text AND a brief explanation of why it is structured that way.
5. End with legal disclaimer.`,

  chat: (jurisdiction, frameworks) => `You are Antigravity Legal AI — an expert legal assistant with comprehensive knowledge of international commercial law, data protection, employment law, and regulatory compliance.

JURISDICTION CONTEXT: ${jurisdiction || "General — no specific jurisdiction detected"}
REGULATORY FOCUS: ${frameworks?.join(", ") || "General legal principles"}

CRITICAL RULES:
1. Ground every answer in the RETRIEVED LEGAL CONTEXT below. Do NOT hallucinate specific regulation text.
2. When the context does not contain enough information, clearly state what you know from general legal principles vs. what requires jurisdiction-specific advice.
3. Be practical and actionable — provide next steps the user can take.
4. Cite retrieved sources as [Source 1], [Source 2], etc.
5. End with legal disclaimer.`,
};

const DISCLAIMER = "\n\n---\n⚖️ *This response is AI-generated for informational purposes only and does not constitute formal legal advice. For binding legal matters, please consult a qualified solicitor, attorney, or legal counsel licensed in the relevant jurisdiction.*";

class ResponseAgent {
  async execute(state) {
    state.addThought("Response Agent", `Synthesizing response | Intent: ${state.intent} | Jurisdiction: ${state.jurisdiction}`);

    const hasGroq = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith("gsk_"));
    const hasOpenAI = !!(process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith("gsk_"));
    const hasGemini = !!process.env.GEMINI_API_KEY;

    // ── 1. Build Context Sections ─────────────────────────────────────────────
    const retrievedContext = state.retrievedNodes.length > 0
      ? state.retrievedNodes.map((n, i) =>
          `[Source ${i + 1}] ${n.documentTitle}\n${n.text.substring(0, 1500)}`
        ).join("\n\n---\n\n")
      : "No documents currently indexed in the Knowledge Base. Response will be based on general legal principles.";

    const complianceContext = state.complianceGaps?.length > 0
      ? state.complianceGaps.map(g =>
          `[${g.framework}] ${g.requirement}: ${g.details} (Severity: ${g.severity})`
        ).join("\n")
      : null;

    const analysisContext = state.analysisResults
      ? `Risk Score: ${state.analysisResults.score}/100\n${state.analysisResults.findings?.map(f =>
          `- ${f.findingType} (${f.severity}): ${f.details}`
        ).join("\n") || ""}`
      : null;

    // ── 2. Build Conversation Memory ──────────────────────────────────────────
    const historyMessages = (state.conversationHistory || [])
      .slice(-10)  // last 5 exchanges (10 messages)
      .map(m => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.text ? m.text.substring(0, 800) : "",
      }))
      .filter(m => m.content);

    // ── 3. Choose System Prompt ───────────────────────────────────────────────
    const promptFn = LEGAL_SYSTEM_PROMPTS[state.intent] || LEGAL_SYSTEM_PROMPTS.chat;
    const systemPrompt = `${promptFn(state.jurisdiction, state.frameworks)}

---
RETRIEVED LEGAL CONTEXT (ground your citations in these sources only):
${retrievedContext}
${complianceContext ? `\n---\nCOMPLIANCE GAPS IDENTIFIED:\n${complianceContext}` : ""}
${analysisContext ? `\n---\nDOCUMENT ANALYSIS RESULTS:\n${analysisContext}` : ""}
---
RESPONSE LANGUAGE: ${state.language === "ta" ? "Tamil (தமிழ்)" : state.language === "hi" ? "Hindi (हिन्दी)" : "English"}
Output clean Markdown with headers, bullet points, and bold for emphasis.`;

    const userContent = state.query;

    // ── 4. Call LLM ───────────────────────────────────────────────────────────
    let answer = "";
    let method = "";

    // Try Groq first (fast)
    if (hasGroq && !answer) {
      try {
        state.addThought("Response Agent", "Routing to Groq Llama 3.3 70B.");
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: "https://api.groq.com/openai/v1" });
        const msgs = [
          { role: "system", content: systemPrompt },
          ...historyMessages,
          { role: "user", content: userContent },
        ];
        const res = await client.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: msgs,
          temperature: 0.2,
          max_tokens: 3000,
        });
        answer = res.choices[0].message.content;
        method = "Groq Llama 3.3 70B (Hybrid RAG)";
      } catch (err) {
        console.warn("[ResponseAgent] Groq failed:", err.message);
      }
    }

    // Try OpenAI
    if (hasOpenAI && !answer) {
      try {
        state.addThought("Response Agent", "Routing to OpenAI GPT-4o-mini.");
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const msgs = [
          { role: "system", content: systemPrompt },
          ...historyMessages,
          { role: "user", content: userContent },
        ];
        const res = await client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: msgs,
          temperature: 0.2,
          max_tokens: 3000,
        });
        answer = res.choices[0].message.content;
        method = "OpenAI GPT-4o-mini (Hybrid RAG)";
      } catch (err) {
        console.warn("[ResponseAgent] OpenAI failed:", err.message);
      }
    }

    // Try Gemini
    if (hasGemini && !answer) {
      try {
        state.addThought("Response Agent", "Routing to Gemini 2.5 Flash.");
        const { GoogleGenerativeAI } = require("@google/generative-ai");
        const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent([systemPrompt, `User Query: ${userContent}`]);
        answer = result.response.text();
        method = "Gemini 2.5 Flash (Hybrid RAG)";
      } catch (err) {
        console.warn("[ResponseAgent] Gemini failed:", err.message);
      }
    }

    // Heuristic fallback
    if (!answer) {
      state.addThought("Response Agent", "No LLM available. Using structured heuristic response.");
      answer = this._heuristicResponse(state);
      method = "Built-in Heuristic (No API Keys)";
    }

    // ── 5. Append disclaimer ──────────────────────────────────────────────────
    if (!answer.includes("does not constitute")) {
      answer += DISCLAIMER;
    }

    // ── 6. Confidence Scoring ─────────────────────────────────────────────────
    const confidence = state.retrievedNodes.length > 0
      ? Math.min(95, 60 + state.retrievedNodes.length * 7)
      : 40;  // low confidence without KB sources

    state.confidenceScore = confidence;
    state.finalAnswer = answer;
    state.addObservation("Response Agent",
      `Response synthesized via ${method}. Sources: ${state.retrievedNodes.length}. Confidence: ${confidence}%`
    );

    return { answer, method, sources: state.retrievedNodes, confidence };
  }

  _heuristicResponse(state) {
    const gaps = state.complianceGaps || [];
    const nodes = state.retrievedNodes || [];
    let text = `# ⚖️ Legal AI — Compliance & Advisory Report\n\nQuery: *"${state.query}"*\n\n`;

    if (nodes.length > 0) {
      text += `## Retrieved Regulatory Context\n`;
      nodes.forEach((n, i) => {
        text += `\n### [Source ${i + 1}] ${n.documentTitle}\n> ${n.text.substring(0, 500)}...\n`;
      });
    }

    if (gaps.length > 0) {
      text += `\n## ⚠️ Compliance Gaps Identified\n`;
      gaps.forEach(g => {
        text += `- **[${g.framework}] ${g.requirement}** (${g.severity.toUpperCase()}): ${g.details}\n`;
      });
    } else {
      text += `\n✅ No immediate critical compliance gaps identified based on available context.\n`;
    }

    text += `\n## Recommendations\n1. Upload relevant regulatory documents to the Knowledge Base for more grounded analysis.\n2. Configure a valid GEMINI_API_KEY or GROQ_API_KEY for AI-powered responses.\n3. Consult a qualified legal professional for jurisdiction-specific advice.`;
    return text;
  }
}

module.exports = new ResponseAgent();
