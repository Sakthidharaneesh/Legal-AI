const ComplianceCheck = require("../models/compliance");

exports.evaluateCompliance = async (req, res) => {
  const { businessType, country } = req.body;

  try {
    if (!businessType || !country) {
      return res.status(400).json({ error: "Missing 'businessType' or 'country' parameters." });
    }

    const checklist = [];
    const bType = businessType.toLowerCase();
    const cCode = country.toLowerCase();

    // 1. Generate checklists based on industry and geography
    // Core GDPR checklist rules
    if (cCode === "eu" || cCode === "europe" || bType === "saas") {
      checklist.push({
        id: "REG-GDPR-01",
        category: "Data Privacy",
        title: "Appoint Data Protection Officer (DPO)",
        description: "Appoint a DPO if core operations involve systematic monitoring of users on a large scale.",
        status: "pending",
        severity: "medium",
        regulationSource: "GDPR Article 37"
      });
      checklist.push({
        id: "REG-GDPR-02",
        category: "Data Privacy",
        title: "Maintain Data Processing Register (ROPA)",
        description: "Maintain a written record of all categories of processing activities managed.",
        status: "pending",
        severity: "high",
        regulationSource: "GDPR Article 30"
      });
      checklist.push({
        id: "REG-GDPR-03",
        category: "Data Privacy",
        title: "Configure GDPR-Compliant Cookie Consent Banner",
        description: "Explicit opt-in required before deploying analytics cookies on web platforms.",
        status: "completed",
        severity: "high",
        regulationSource: "GDPR Article 7"
      });
    }

    // HIPAA rules
    if (bType === "healthcare" || bType === "healthtech") {
      checklist.push({
        id: "REG-HIPAA-01",
        category: "Healthcare Integrity",
        title: "Execute Business Associate Agreements (BAA)",
        description: "Obtain signed contract assurances that BAAs are active with all hosting processors.",
        status: "pending",
        severity: "high",
        regulationSource: "HIPAA 45 CFR 164.502"
      });
      checklist.push({
        id: "REG-HIPAA-02",
        category: "Security",
        title: "Enforce Unique User Identifiers & Login Credentials",
        description: "System logs must isolate user actions to unique login profiles.",
        status: "completed",
        severity: "high",
        regulationSource: "HIPAA 45 CFR 164.312"
      });
      checklist.push({
        id: "REG-HIPAA-03",
        category: "Security",
        title: "Deploy Automated Session Logout Locks",
        description: "Enable screen shields or logouts after 15 minutes of user inactivity.",
        status: "pending",
        severity: "medium",
        regulationSource: "HIPAA 45 CFR 164.312"
      });
    }

    // Fintech / PCI-DSS rules
    if (bType === "fintech" || bType === "payment" || bType === "banking") {
      checklist.push({
        id: "REG-PCI-01",
        category: "Financial Security",
        title: "Enforce Cardholder Data Encryption",
        description: "Secure data using robust cryptographic controls during transmission over public networks.",
        status: "pending",
        severity: "high",
        regulationSource: "PCI-DSS v4.0 Req 4"
      });
      checklist.push({
        id: "REG-PCI-02",
        category: "Financial Security",
        title: "Execute Quarterly External Vulnerability Scans",
        description: "Schedule automated security scanning via an Approved Scanning Vendor (ASV).",
        status: "pending",
        severity: "medium",
        regulationSource: "PCI-DSS v4.0 Req 11"
      });
    }

    // AI rules
    if (bType === "ai" || bType === "artificial intelligence" || bType === "saas") {
      checklist.push({
        id: "REG-AIACT-01",
        category: "AI Governance",
        title: "Establish Generative AI Disclosure Banners",
        description: "Notify users that outputs are generated dynamically by an AI system.",
        status: "pending",
        severity: "high",
        regulationSource: "EU AI Act Article 50"
      });
      checklist.push({
        id: "REG-AIACT-02",
        category: "AI Governance",
        title: "Review Training Datasets for Copyright Compliance",
        description: "Document model training processes to verify respect of copyright waivers.",
        status: "completed",
        severity: "medium",
        regulationSource: "EU AI Act Article 53"
      });
    }

    // General Cybersecurity rules (SOC 2)
    checklist.push({
      id: "REG-SOC2-01",
      category: "Security Infrastructure",
      title: "Activate Multi-Factor Authentication (MFA)",
      description: "Require MFA for all administrative and user logins access.",
      status: "completed",
      severity: "high",
      regulationSource: "SOC 2 Trust Services Criteria CC6.3"
    });

    // Compute initial overall compliance score
    const completedCount = checklist.filter(item => item.status === "completed").length;
    const overallScore = checklist.length > 0 ? Math.round((completedCount / checklist.length) * 100) : 100;

    const complianceCheck = new ComplianceCheck({
      user: req.user.id,
      businessType,
      country,
      checklist,
      overallScore
    });

    await complianceCheck.save();
    res.status(201).json(complianceCheck);

  } catch (err) {
    console.error("Compliance Check Error:", err);
    res.status(500).json({ error: "Failed to evaluate compliance parameters." });
  }
};

exports.getComplianceHistory = async (req, res) => {
  try {
    const history = await ComplianceCheck.find({ user: req.user.id })
      .sort({ createdAt: -1 });
    res.json(history);
  } catch (err) {
    console.error("Compliance History Error:", err);
    res.status(500).json({ error: "Failed to fetch compliance history." });
  }
};

exports.updateComplianceItemStatus = async (req, res) => {
  const { checkId, itemId } = req.params;
  const { status } = req.body; // 'completed' or 'pending'

  try {
    const check = await ComplianceCheck.findOne({ _id: checkId, user: req.user.id });
    if (!check) {
      return res.status(404).json({ error: "Compliance audit report not found." });
    }

    const item = check.checklist.find(i => i.id === itemId);
    if (!item) {
      return res.status(404).json({ error: "Compliance checklist item not found." });
    }

    item.status = status;

    // Recalculate score
    const completedCount = check.checklist.filter(i => i.status === "completed").length;
    check.overallScore = Math.round((completedCount / check.checklist.length) * 100);

    await check.save();
    res.json(check);
  } catch (err) {
    console.error("UpdateComplianceItem Error:", err);
    res.status(500).json({ error: "Failed to update compliance task status." });
  }
};
