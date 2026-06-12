const { SAMPLE_CONTRACTS } = require("../mockData");

exports.getTemplates = async (req, res) => {
  try {
    const templates = Object.entries(SAMPLE_CONTRACTS).map(([key, text]) => ({
      id: key,
      name: key === "saas" ? "Cloud SaaS Agreement" : key === "privacy" ? "Privacy Policy & User Disclosure" : "Non-Disclosure Agreement (NDA)",
      type: key.toUpperCase(),
      description: key === "saas"
        ? "Standard SaaS service agreement template with termination, liability, and security clauses."
        : key === "privacy"
        ? "Privacy policy covering data collection, model training, and jurisdiction terms."
        : "Mutual NDA template with confidentiality definitions and relief provisions.",
      text,
      clauseCount: text.split(/\d+\.\s+[A-Z]/).length - 1,
      riskLevel: key === "saas" ? "high" : key === "privacy" ? "critical" : "low"
    }));
    res.json(templates);
  } catch (err) {
    console.error("Templates Error:", err);
    res.status(500).json({ error: "Failed to retrieve templates." });
  }
};
