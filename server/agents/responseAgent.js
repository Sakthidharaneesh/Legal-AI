const OpenAI = require("openai");

class ResponseAgent {
  async execute(state) {
    state.addThought("Response Agent", "Synthesizing retrieved nodes and auditor findings into final counsel report.");

    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasGemini = !!process.env.GEMINI_API_KEY;

    let answer = "";
    let generationMethod = "";

    // 1. Compile Context
    const retrievedContext = state.retrievedNodes.map((node, i) => 
      `Source [${i+1}]: ${node.documentTitle}\nContent: ${node.text}`
    ).join("\n\n");

    const gapsContext = state.complianceGaps.map((g, i) =>
      `- [${g.framework}] ${g.requirement}: ${g.details} (Severity: ${g.severity})`
    ).join("\n");

    const analysisContext = state.analysisResults 
      ? `Audit Score: ${state.analysisResults.score}/100\nFindings:\n${state.analysisResults.findings.map(f => `- ${f.findingType} (Severity: ${f.severity}): ${f.details}`).join("\n")}`
      : "No document file uploaded.";

    const systemPrompt = `You are Antigravity Legal AI, an expert corporate counsel and compliance officer.
Your task is to answer the user's legal/compliance query based on the retrieved context, compliance gaps, and document audits provided below.

---
RETRIEVED LEGAL CONTEXT:
${retrievedContext || "No records retrieved from vector database."}

---
IDENTIFIED COMPLIANCE GAPS:
${gapsContext || "No immediate compliance gaps flagged."}

---
DOCUMENT AUDIT RESULTS:
${analysisContext}

---
INSTRUCTIONS:
1. Provide a professional, thorough, and structured legal assessment.
2. Cite the provided sources (e.g., "[Source 1]", "[GDPR Article 33]") clearly.
3. Highlight high-risk items in a clear summary.
4. Output in clean Markdown format with bold text, headings, and lists.
5. If the language configuration is "ta", write the entire answer in Tamil (அல்லது ஆங்கிலம் மற்றும் தமிழ் ஆகிய இரு மொழிகளிலும் வழங்கவும்). Provide Tamil legal terms clearly.
`;

    // 2. Model Execution
    if (hasOpenAI) {
      try {
        state.addThought("Response Agent", "Routing synthesis to OpenAI GPT-4o-mini.");
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: state.query }
          ],
          temperature: 0.2,
        });
        answer = completion.choices[0].message.content;
        generationMethod = "OpenAI GPT-4o-mini RAG Response";
      } catch (err) {
        console.warn("OpenAI response generation failed, falling back to Gemini...", err.message);
      }
    }

    if (!answer && hasGemini) {
      try {
        state.addThought("Response Agent", "Routing synthesis to Google Gemini (gemini-1.5-flash).");
        const { GoogleGenerativeAI } = require("@google/generative-ai");
        const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `${systemPrompt}\n\nUser Query: ${state.query}`;
        const result = await model.generateContent(prompt);
        answer = result.response.text();
        generationMethod = "Gemini 1.5 Flash RAG Response";
      } catch (err) {
        console.warn("Gemini response generation failed, falling back to local compiler...", err.message);
      }
    }

    // 3. Fallback Heuristic Generator (Zero API keys or errors)
    if (!answer) {
      state.addThought("Response Agent", "No active API credentials found. Generating locally compiled heuristic response.");
      answer = this.compileHeuristicAnswer(state);
      generationMethod = "Local Rule-Based Heuristic Compiler";
    }

    state.finalAnswer = answer;
    state.addObservation("ResponseAgent", `Counsel report synthesized via ${generationMethod}.`);
    
    return {
      answer,
      generationMethod,
      sources: state.retrievedNodes,
    };
  }

  compileHeuristicAnswer(state) {
    const isTamil = state.language === "ta";
    let text = "";

    if (isTamil) {
      text += `# ⚖️ சட்ட ஆலோசனை மற்றும் இணக்க அறிக்கை (Antigravity Legal AI Counsel Report)

விசாரணை: "${state.query}"

## 1. சுருக்கம் (Executive Summary)
வழங்கப்பட்ட தகவலின் அடிப்படையில், உங்கள் வணிகச் செயல்பாடு தொடர்பான முக்கிய இணக்கக் கூறுகள் பகுப்பாய்வு செய்யப்பட்டன.

`;

      if (state.complianceGaps.length > 0) {
        text += `### ⚠️ முக்கிய இணக்க இடைவெளிகள் (Critical Compliance Gaps):\n`;
        state.complianceGaps.forEach(g => {
          const transSeverity = g.severity === "high" ? "உயர் ஆபத்து (High Risk)" : "நடுத்தர ஆபத்து (Medium Risk)";
          text += `- **[${g.framework}] ${g.requirement}**: ${g.details} (தீவிரம்: ${transSeverity})\n`;
        });
      } else {
        text += `✅ தற்போதைய தரவுகளில் உடனடி விதிமீறல் அல்லது இணக்க இடைவெளிகள் ஏதும் கண்டறியப்படவில்லை.\n\n`;
      }

      if (state.retrievedNodes.length > 0) {
        text += `\n## 2. மீட்டெடுக்கப்பட்ட சட்டப் பிரிவுகள் (Retrieved Regulations):\n`;
        state.retrievedNodes.forEach((node, i) => {
          text += `### [ஆதாரம் ${i+1}] ${node.documentTitle}\n${node.text}\n\n`;
        });
      }

      text += `\n## 3. பரிந்துரைகள் (Action Items):
1. **72-மணிநேர அறிவிப்பு கொள்கை**: தரவு மீறல் ஏற்பட்டால் 72 மணி நேரத்திற்குள் உரிய அதிகாரிகளுக்குத் தெரிவிக்க வேண்டும் (GDPR Article 33).
2. **தரவு குறியாக்கம்**: அனைத்து பயனர் தரவுகளும் AES-256 மற்றும் TLS 1.3 குறியாக்க முறைகளைப் பயன்படுத்தி பாதுகாக்கப்பட வேண்டும்.
3. **ஒப்பந்த திருத்தங்கள்**: உங்கள் தற்போதைய ஒப்பந்தங்களில் சேவை வழங்குநர் பொறுப்பு மற்றும் தரவு நீக்க விதிகள் தெளிவாக இருப்பதை உறுதி செய்யவும்.
`;
    } else {
      text += `# ⚖️ Compliance & Advisory Counsel Report

Query: "${state.query}"

## 1. Executive Summary
Based on the retrieved regulatory references and active systems parameters, we have completed a compliance assessment. 

`;

      if (state.complianceGaps.length > 0) {
        text += `### ⚠️ Flagged Compliance Gaps:\n`;
        state.complianceGaps.forEach(g => {
          text += `- **[${g.framework}] ${g.requirement}**: ${g.details} (Severity: **${g.severity.toUpperCase()}**)\n`;
        });
      } else {
        text += `✅ No immediate high-severity compliance gaps were flagged based on standard heuristics.\n\n`;
      }

      if (state.retrievedNodes.length > 0) {
        text += `\n## 2. Retrieved Regulatory Context:\n`;
        state.retrievedNodes.forEach((node, i) => {
          text += `### [Source ${i+1}] ${node.documentTitle}\n> "${node.text}"\n\n`;
        });
      }

      text += `\n## 3. Legal Recommendations:
1. **Breach Notification**: Implement a robust internal security playbook to guarantee data breaches are logged and reported to national supervisory authorities within **72 hours** (GDPR Article 33).
2. **Data Encryption Safeguards**: Enforce system-wide encryption at rest (AES-256) and in transit (TLS 1.3) across all cloud database servers.
3. **AI Consent Gates**: For any systems processing user inputs or prompts, construct opt-in consent banners to satisfy transparency obligations under **EU AI Act Article 50**.
`;
    }

    return text;
  }
}

module.exports = new ResponseAgent();
