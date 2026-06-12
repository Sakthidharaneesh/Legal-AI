/**
 * Retriever Agent — Upgraded to Hybrid RAG
 * Uses: Dense vector search + BM25 sparse + RRF + LLM Re-ranking + Query Expansion
 */

const hybridSearchService = require("../services/hybridSearchService");

class RetrieverAgent {
  async execute(state) {
    if (state.options && state.options.useKnowledgeBase === false || state.useKnowledgeBase === false) {
      state.addThought("Retriever Agent", "Knowledge Base search disabled. Skipping retrieval.");
      state.retrievedNodes = [];
      return state;
    }

    state.addThought("Retriever Agent",
      `Starting hybrid retrieval — jurisdiction: ${state.jurisdiction || "general"}, frameworks: ${(state.frameworks || []).join(", ") || "none"}`
    );

    try {
      const results = await hybridSearchService.hybridSearch(
        state.query,
        state.topK || 8,
        {
          jurisdiction: state.jurisdiction || "general",
          skipExpansion: false,
          skipRerank: false,
        }
      );

      state.retrievedNodes = results;
      state.expandedQueries = hybridSearchService._lastExpandedQueries || [];

      if (results.length > 0) {
        state.addObservation(
          "Retriever Agent",
          `Hybrid search returned ${results.length} chunks. Top: "${results[0].documentTitle}" (score: ${results[0].score}, source: ${results[0].source || "dense"})`
        );
      } else {
        state.addObservation("Retriever Agent",
          "Vector store appears empty. Upload regulatory documents in the Knowledge Base for grounded responses."
        );
        // Built-in legal knowledge fallback
        state.retrievedNodes = this._getBuiltinFallback(state.query, state.frameworks);
        state.addObservation("Retriever Agent", `Using ${state.retrievedNodes.length} built-in regulatory reference(s).`);
      }
    } catch (err) {
      console.error("[RetrieverAgent] Hybrid search failed:", err.message);
      state.addThought("Retriever Agent", `Retrieval error: ${err.message}. Using built-in fallback.`);
      state.retrievedNodes = this._getBuiltinFallback(state.query, state.frameworks);
    }

    return state;
  }

  _getBuiltinFallback(query, frameworks = []) {
    const q = query.toLowerCase();
    const refs = [];

    if (frameworks.includes("GDPR") || q.includes("gdpr") || q.includes("data protection") || q.includes("privacy")) {
      refs.push({
        documentId: "builtin-gdpr",
        documentTitle: "GDPR — Key Articles Reference",
        text: `GDPR Article 5: Personal data shall be processed lawfully, fairly, and transparently. Data must be collected for specified, explicit, and legitimate purposes and not further processed in a manner incompatible with those purposes (purpose limitation). Data must be adequate, relevant, and limited to what is necessary (data minimisation). Data must be accurate and kept up to date. Data must be stored no longer than necessary (storage limitation). Data must be processed with appropriate security (integrity and confidentiality).

GDPR Article 17 (Right to Erasure): Data subjects have the right to obtain erasure of personal data where: data is no longer necessary; consent is withdrawn; data has been unlawfully processed; or erasure required by law.

GDPR Article 28: Where processing is carried out by a processor, the controller shall use only processors providing sufficient guarantees. Processing by a processor shall be governed by a binding contract.

GDPR Article 33: In the case of a personal data breach, the controller shall notify the supervisory authority without undue delay and, where feasible, not later than 72 hours after having become aware of it.

GDPR Article 83: Infringements of the most serious provisions can lead to fines of up to €20 million or 4% of total worldwide annual turnover, whichever is higher.`,
        score: 0.9,
        source: "builtin",
      });
    }

    if (frameworks.includes("HIPAA") || q.includes("hipaa") || q.includes("health") || q.includes("patient") || q.includes("medical")) {
      refs.push({
        documentId: "builtin-hipaa",
        documentTitle: "HIPAA — Key Requirements Reference",
        text: `HIPAA Privacy Rule: Covered entities must implement policies protecting Protected Health Information (PHI). Patients have rights to access, amend, and receive an accounting of disclosures of their PHI. Minimum necessary standard: only the minimum necessary PHI should be used or disclosed.

HIPAA Security Rule: Covered entities must implement administrative, physical, and technical safeguards to protect electronic PHI (ePHI). Required safeguards include: access controls, audit controls, integrity controls, and transmission security (encryption in transit).

HIPAA Breach Notification Rule: Covered entities must notify affected individuals, HHS, and in some cases the media, following a breach of unsecured PHI, generally within 60 days of discovery.

Business Associate Agreements (BAA): A BAA must be signed with any vendor that handles PHI on behalf of the covered entity before sharing PHI.`,
        score: 0.9,
        source: "builtin",
      });
    }

    if (frameworks.includes("CCPA") || q.includes("ccpa") || q.includes("california") || q.includes("consumer privacy")) {
      refs.push({
        documentId: "builtin-ccpa",
        documentTitle: "CCPA / CPRA — Key Rights Reference",
        text: `CCPA grants California consumers the right to: (1) Know what personal information is collected; (2) Delete personal information; (3) Opt-out of the sale or sharing of personal information; (4) Non-discrimination for exercising CCPA rights; (5) Correct inaccurate personal information (CPRA addition); (6) Limit use of sensitive personal information (CPRA addition).

Businesses subject to CCPA must: Provide notice at collection; Respond to consumer requests within 45 days; Maintain a "Do Not Sell or Share My Personal Information" link; Enter into contracts with service providers and contractors limiting their use of personal information.`,
        score: 0.85,
        source: "builtin",
      });
    }

    if (frameworks.includes("EU AI Act") || q.includes("ai act") || q.includes("artificial intelligence") || q.includes("ai system")) {
      refs.push({
        documentId: "builtin-eu-ai",
        documentTitle: "EU AI Act — Key Obligations Reference",
        text: `EU AI Act Article 50 (Transparency): Providers of AI systems that generate synthetic audio, image, video, or text content shall ensure outputs are marked as artificially generated. Users interacting with AI chatbots must be informed they are interacting with an AI system.

EU AI Act — High-Risk AI: Systems used in employment, credit scoring, biometric identification, and critical infrastructure are classified as high-risk and require conformity assessments, risk management systems, data governance, technical documentation, human oversight, and accuracy/robustness standards.

EU AI Act — Prohibited Practices: Subliminal manipulation, exploitation of vulnerabilities, real-time remote biometric identification in public spaces (with exceptions), and social scoring by public authorities are prohibited.`,
        score: 0.85,
        source: "builtin",
      });
    }

    if (q.includes("contract") || q.includes("nda") || q.includes("agreement") || q.includes("clause")) {
      refs.push({
        documentId: "builtin-contracts",
        documentTitle: "Contract Law — Key Principles Reference",
        text: `Formation: A valid contract requires offer, acceptance, consideration, and intention to create legal relations. Contracts for goods/services over certain values may require written form.

Limitation of Liability: Courts will uphold reasonable mutual caps. Unilateral, one-sided limitations may be struck down under UCTA (UK) or similar consumer protection laws. Liability for death or personal injury caused by negligence cannot be excluded.

Indemnification: Broad, unilateral indemnification clauses heavily favouring one party create significant legal risk. 'Mutual indemnification' provisions are more commonly upheld. Indemnification clauses should specify: scope of covered losses, notice requirements, and defence obligations.

Data Protection in Contracts: Any contract involving personal data processing must include: data protection obligations aligned with applicable law (GDPR Art. 28), specification of processing purposes, security measures, and sub-processor controls.

Termination: Specify termination for cause vs. convenience, notice periods, survival clauses, and data return obligations on termination.`,
        score: 0.8,
        source: "builtin",
      });
    }

    return refs.slice(0, 4);
  }
}

module.exports = new RetrieverAgent();
