const { GoogleGenerativeAI } = require("@google/generative-ai");
const OpenAI = require("openai");

class AnalyzerAgent {
  async execute(state) {
    state.addThought("Analyzer Agent", "Initiating document risk analysis.");
    const results = await this.analyzeContractTextAsync(state.query);
    state.analysisResults = results;
    state.addObservation("Analyzer Agent", `Risk assessment completed. Document Score: ${results.score}/100. Findings: ${results.findings.length}`);
    return state;
  }

  async analyzeContractTextAsync(text) {
    // 1. Try Gemini
    if (process.env.GEMINI_API_KEY) {
      try {
        console.log("[AnalyzerAgent] Running Gemini AI Document Audit...");
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `
You are an expert corporate legal counsel and contract auditor. 
Analyze the following document/contract/agreement text and identify critical legal, compliance, financial, and operational risks.

Output your audit results strictly in JSON format matching this schema:
{
  "score": <overall contract compliance/safety score from 0 to 100, where 100 is perfectly safe/fair and 0 is extremely high risk>,
  "findings": [
    {
      "id": "RISK-XX",
      "clause": "<exact or closely matching sentence/clause from the text containing the risk>",
      "severity": "<"high" | "medium" | "low">",
      "findingType": "<short title/type of the finding, e.g. 'Unbalanced Indemnification', 'Automatic Renewal'>",
      "details": "<clear explanation of why this clause constitutes a risk, citing legal concepts or consequences>",
      "suggestedRewrite": "<a professionally drafted, balanced alternative clause that resolves the risk>"
    }
  ]
}

Document Content:
${text}

Respond only with the raw JSON object. Do not wrap it in markdown code fences or add explanatory text.`;
        const result = await model.generateContent(prompt);
        let rawResponse = result.response.text();
        // Strip out code blocks if present
        rawResponse = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(rawResponse);
        if (parsed && typeof parsed.score === "number" && Array.isArray(parsed.findings)) {
          return parsed;
        }
      } catch (err) {
        console.warn("[AnalyzerAgent] Gemini AI Audit failed, trying OpenAI...", err.message);
      }
    }

    // 2. Try OpenAI
    if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith("gsk_")) {
      try {
        console.log("[AnalyzerAgent] Running OpenAI AI Document Audit...");
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const prompt = `
You are an expert corporate legal counsel and contract auditor. 
Analyze the following document/contract/agreement text and identify critical legal, compliance, financial, and operational risks.

Output your audit results strictly in JSON format matching this schema:
{
  "score": <overall contract compliance/safety score from 0 to 100, where 100 is perfectly safe/fair and 0 is extremely high risk>,
  "findings": [
    {
      "id": "RISK-XX",
      "clause": "<exact or closely matching sentence/clause from the text containing the risk>",
      "severity": "<"high" | "medium" | "low">",
      "findingType": "<short title/type of the finding, e.g. 'Unbalanced Indemnification', 'Automatic Renewal'>",
      "details": "<clear explanation of why this clause constitutes a risk, citing legal concepts or consequences>",
      "suggestedRewrite": "<a professionally drafted, balanced alternative clause that resolves the risk>"
    }
  ]
}

Document Content:
${text}

Respond only with the raw JSON object. Do not wrap it in markdown code fences or add explanatory text.`;
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }]
        });
        let rawResponse = response.choices[0]?.message?.content || "";
        rawResponse = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(rawResponse);
        if (parsed && typeof parsed.score === "number" && Array.isArray(parsed.findings)) {
          return parsed;
        }
      } catch (err) {
        console.warn("[AnalyzerAgent] OpenAI AI Audit failed, falling back to heuristics...", err.message);
      }
    }

    // Fallback: Heuristics
    console.log("[AnalyzerAgent] Using fallback heuristics scanner.");
    return this.analyzeContractText(text);
  }

  analyzeContractText(text) {
    const findings = [];
    let deductionPoints = 0;

    // 1. Notification Timeline Gap (>72 hours or not specified)
    const notificationMatch = text.match(/(?:notify|notification|report)[^.]*(?:days|hours|\d+)[^.]*/gi);
    if (notificationMatch) {
      const hoursMatch = notificationMatch.join(" ").match(/(\d+)\s*(?:hour|hr)/i);
      const daysMatch = notificationMatch.join(" ").match(/(\d+)\s*(?:day)/i);

      let hours = 0;
      if (hoursMatch) hours = parseInt(hoursMatch[1]);
      else if (daysMatch) hours = parseInt(daysMatch[1]) * 24;

      if (hours > 72) {
        findings.push({
          id: "RISK-01",
          clause: notificationMatch[0].trim(),
          severity: "high",
          findingType: "Notification Timeline Delay",
          details: `The contract specifies a breach notification timeline of ${hours} hours. Regulations like GDPR Article 33 mandate notification to authorities within 72 hours.`,
          suggestedRewrite: "In the event of a Personal Data Breach, Vendor shall notify Customer within 72 hours of becoming aware of the breach."
        });
        deductionPoints += 25;
      }
    } else {
      findings.push({
        id: "RISK-01-MISSING",
        clause: "N/A (Missing Clause)",
        severity: "medium",
        findingType: "Unspecified Notification Timeline",
        details: "No explicit breach notification timeline was found. This leaves the organization exposed to compliance delays.",
        suggestedRewrite: "Vendor shall notify Customer without undue delay, and in any event, not later than 72 hours after becoming aware of any security incident."
      });
      deductionPoints += 12;
    }

    // 2. Encryption waivers / lack of security safeguards
    if (/waive[^.]*encryption/i.test(text) || /no[^.]*encryption/i.test(text) || /without[^.]*encryption/i.test(text)) {
      const waivedMatch = text.match(/[^.]*waive[^.]*encryption[^.]*/gi);
      findings.push({
        id: "RISK-02",
        clause: waivedMatch ? waivedMatch[0].trim() : "Waiver of security safeguards",
        severity: "high",
        findingType: "Encryption Safeguard Waiver",
        details: "The clause waives standard encryption requirements for data in transit/storage, violating SOC 2 CC6.7 and GDPR Article 32.",
        suggestedRewrite: "All data containing personally identifiable information (PII) or confidential records must be encrypted in transit using TLS 1.3 and at rest using AES-256."
      });
      deductionPoints += 25;
    }

    // 3. AI Training model harvesting
    if (/model training/i.test(text) || /train[^.]*model/i.test(text) || /harvest[^.]*prompt/i.test(text) || /use[^.]*input[^.]*improve/i.test(text)) {
      const harvestMatch = text.match(/[^.]*(?:model training|train|harvest)[^.]*/gi);
      findings.push({
        id: "RISK-03",
        clause: harvestMatch ? harvestMatch[0].trim() : "Customer data used for model training",
        severity: "medium",
        findingType: "AI Model Training Data Harvesting",
        details: "Allows the vendor to harvest customer inputs/prompts for model training, creating high data-leakage risks and potential EU AI Act compliance concerns.",
        suggestedRewrite: "Vendor agrees not to use Customer's confidential data, prompts, or generated outputs for training machine learning or artificial intelligence models without Customer's express, revocable written consent."
      });
      deductionPoints += 12;
    }

    // 4. Governing Law / Jurisdiction disputes
    const jurisdictionMatch = text.match(/(?:governing law|jurisdiction|governed by)[^.]*/gi);
    if (jurisdictionMatch) {
      if (!/(delaware|new york|california|london|united kingdom|india)/i.test(jurisdictionMatch[0])) {
        findings.push({
          id: "RISK-04",
          clause: jurisdictionMatch[0].trim(),
          severity: "low",
          findingType: "Non-Standard Governing Law Jurisdiction",
          details: "The governing law is set to a non-standard jurisdiction which may increase dispute resolution complexity and cost.",
          suggestedRewrite: "This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to conflict of law principles."
        });
        deductionPoints += 5;
      }
    }

    // 5. Unbalanced Indemnity
    if (/customer[^.]*indemnify[^.]*vendor[^.]*negligence/i.test(text) || /customer[^.]*responsible[^.]*vendor[^.]*breach/i.test(text)) {
      const indemnityMatch = text.match(/[^.]*indemnify[^.]*negligence[^.]*/gi);
      findings.push({
        id: "RISK-05",
        clause: indemnityMatch ? indemnityMatch[0].trim() : "Unbalanced Indemnity Clause",
        severity: "high",
        findingType: "Unbalanced Liability Allocation",
        details: "Requires Customer to indemnify Vendor even in cases of Vendor's own negligence, creating massive operational and financial risk.",
        suggestedRewrite: "Each party shall indemnify and hold harmless the other party from claims arising out of the indemnifying party's gross negligence, willful misconduct, or material breach of this Agreement."
      });
      deductionPoints += 25;
    }

    // 6. Indefinite Retention
    if (/retained[^.]*indefinitely/i.test(text) || /retain[^.]*forever/i.test(text) || /no[^.]*deletion[^.]*request/i.test(text)) {
      const retentionMatch = text.match(/[^.]*(?:retained indefinitely|forever)[^.]*/gi);
      findings.push({
        id: "RISK-06",
        clause: retentionMatch ? retentionMatch[0].trim() : "Indefinite Data Retention",
        severity: "medium",
        findingType: "Indefinite Data Retention Period",
        details: "Specifies indefinite data retention, which directly violates the GDPR storage limitation principle (Article 5(1)(e)).",
        suggestedRewrite: "Vendor shall delete all Customer personal data within 30 days of the termination of this Agreement or upon Customer's written deletion request."
      });
      deductionPoints += 12;
    }

    // Calculate score (0-100)
    const score = Math.max(0, 100 - deductionPoints);

    return {
      score,
      findings
    };
  }
}

module.exports = new AnalyzerAgent();
