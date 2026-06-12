const REGULATORY_ALERTS = [
  {
    id: "ALERT-FTC-NC",
    title: "FTC Non-Compete Agreement Ban",
    authority: "Federal Trade Commission (US)",
    date: "2024-04-23",
    status: "final_rule",
    summary: "The Federal Trade Commission issued a final rule banning non-compete agreements nationwide. The rule declares that it is an unfair method of competition for employers to enter into non-compete clauses with workers after the effective date.",
    impactScore: 92,
    actions: [
      "Sweep HR systems to flag existing employee agreements containing non-competes.",
      "Draft required notices to employees informing them that non-competes are unenforceable.",
      "Revise standard employment templates to exclude restrictive non-compete covenants."
    ]
  },
  {
    id: "ALERT-EU-AI",
    title: "EU AI Act Compliance Timeline Enacted",
    authority: "European Parliament",
    date: "2024-05-13",
    status: "active_transition",
    summary: "The EU AI Act enters force with staggered implementation. Article 5 bans prohibited AI practices after 6 months; transparency duties under Article 50 activate after 12 months; general systemic requirements apply at 24 months.",
    impactScore: 88,
    actions: [
      "Audit model pipelines to determine risk classification (Prohibited, High Risk, Low/Limited Risk).",
      "Deploy transparency user interface notices for chatbots (explicitly stating interaction is with an AI).",
      "Build model transparency cards summarizing architecture and training parameters."
    ]
  },
  {
    id: "ALERT-SEC-CYBER",
    title: "SEC Cybersecurity Incident Reporting Guideline",
    authority: "Securities and Exchange Commission (US)",
    date: "2023-12-18",
    status: "enforced",
    summary: "Public companies must disclose material cybersecurity incidents on Item 1.05 of Form 8-K within four business days of determining that the incident is material.",
    impactScore: 95,
    actions: [
      "Sync internal incident response plan with SEC 4-day filing schedules.",
      "Draft materiality determination guidelines to define reporting criteria.",
      "Deploy executive reporting chains to ensure immediate board escalation."
    ]
  },
  {
    id: "ALERT-GDPR-V",
    title: "GDPR Chapter V Cross-Border Data Flows Update",
    authority: "European Data Protection Board",
    date: "2023-07-10",
    status: "active",
    summary: "The EU-US Data Privacy Framework (DPF) replaces older privacy shields, authorizing standard transfers to certified US entities. Uncertified transfers still require Standard Contractual Clauses (SCCs) and Transfer Impact Assessments (TIAs).",
    impactScore: 85,
    actions: [
      "Check US data processors for active DPF certification.",
      "Append approved Standard Contractual Clauses (SCCs) to agreements for uncertified vendors.",
      "Perform mandatory Transfer Impact Assessments (TIA) for key cloud servers."
    ]
  }
];

const SAMPLE_CONTRACTS = {
  saas: `SOFTWARE AS A SERVICE (SAAS) AGREEMENT
This agreement is between CloudScale Inc. ("Vendor") and the undersigning client ("Customer").

1. TERMINATION & DATA RETENTION
Upon termination of services, Vendor will retain Customer's database and usage data indefinitely for data analysis and software refinement purposes.

2. LIMITATION OF LIABILITY
Customer agrees to indemnify and hold harmless Vendor from any liabilities, claims, losses, or legal costs arising out of any breach or security incident, regardless of whether such incident was caused by Vendor's negligence or security failure.

3. SECURITY & INCIDENTS
Vendor shall notify Customer of any data breach or security compromise of systems storing Customer records. Such notification shall be made within 7 business days of the Vendor's final internal assessment and confirmation. Encryption protocols for Customer data in transit may be waived by the Vendor in writing at its convenience to optimize data transfer speeds.`,

  privacy: `PRIVACY POLICY & USER DISCLOSURE
This policy explains how we collect and process data at Omniverse AI Solutions.

1. MODEL TRAINING & HARVESTING
By using our platforms, prompts, inputs, chatbot dialogs, and text documents uploaded to the dashboard, you grant us an irrevocable, worldwide, royalty-free license to parse, compile, harvest, and use such inputs for training, refining, and testing our machine learning algorithms, deep learning models, and general generative AI systems without further notice or opt-out options.

2. JURISDICTION
Any disputes, claims, or regulatory inquiries relating to data privacy shall be resolved exclusively in the judicial courts of the Cayman Islands, under Cayman Islands judicial rules.`,

  nda: `NON-DISCLOSURE AGREEMENT (NDA)
This NDA is entered into between Customer and Supplier.

1. DEFINTION OF CONFIDENTIAL INFORMATION
"Confidential Information" includes all financial, technical, and operational records.

2. RELIEF
The disclosing party may seek injunctive relief in any court of competent jurisdiction. This agreement is governed by the laws of Delaware. All confidential records containing customer records must be returned or destroyed within 30 days of written request.`
};

module.exports = {
  REGULATORY_ALERTS,
  SAMPLE_CONTRACTS
};
