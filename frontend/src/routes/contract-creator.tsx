import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  FileSignature, Sparkles, ShieldCheck, AlertTriangle, CheckCircle2,
  ShieldAlert, Copy, Download, RefreshCw, ChevronRight, BookOpen, Wand2
} from "lucide-react";

export const Route = createFileRoute("/contract-creator")({
  head: () => ({
    meta: [
      { title: "Contract Creator — Legal AI" },
      { name: "description", content: "AI-powered contract drafting with regulation compliance." },
    ],
  }),
  component: ContractCreatorPage,
});

const CONTRACT_TYPES = [
  { id: "NDA", label: "Non-Disclosure Agreement", icon: "🔒", desc: "Protect confidential information between parties" },
  { id: "Service Agreement", label: "Service Agreement", icon: "🤝", desc: "Define scope, payment, and deliverables for services" },
  { id: "Employment Contract", label: "Employment Contract", icon: "👔", desc: "Compliant hiring agreements with labor law provisions" },
  { id: "SaaS Agreement", label: "SaaS Agreement", icon: "☁️", desc: "Software-as-a-service terms with data protection clauses" },
  { id: "Lease Agreement", label: "Lease Agreement", icon: "🏠", desc: "Residential or commercial property lease terms" },
];

const JURISDICTIONS = ["England and Wales", "United States (Federal)", "European Union", "India", "Singapore", "Australia"];

type ValidationIssue = { title: string; severity: "high" | "medium" | "low"; regulation: string; description: string; suggestion: string };
type ValidationResult = { overallScore: number; issues: ValidationIssue[]; strengths: string[]; summary: string };

function ContractCreatorPage() {
  const API = typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:8080" : "";

  // Step state
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form state
  const [contractType, setContractType] = useState("");
  const [partyAName, setPartyAName] = useState("");
  const [partyARole, setPartyARole] = useState("Disclosing Party");
  const [partyBName, setPartyBName] = useState("");
  const [partyBRole, setPartyBRole] = useState("Receiving Party");
  const [purpose, setPurpose] = useState("");
  const [jurisdiction, setJurisdiction] = useState("England and Wales");
  const [duration, setDuration] = useState("1 year");
  const [industry, setIndustry] = useState("");
  const [additionalTerms, setAdditionalTerms] = useState("");

  // Generated contract
  const [contractText, setContractText] = useState("");
  const [regulations, setRegulations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Validation
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);

  // Clause suggestion
  const [clauseTitle, setClauseTitle] = useState("");
  const [clauseText, setClauseText] = useState("");
  const [clauseSuggestion, setClauseSuggestion] = useState("");
  const [suggestingClause, setSuggestingClause] = useState(false);

  const handleGenerate = async () => {
    if (!contractType) { toast.error("Please select a contract type."); return; }
    setLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      const res = await fetch(`${API}/api/contract-creator/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ contractType, partyA: { name: partyAName, role: partyARole }, partyB: { name: partyBName, role: partyBRole }, purpose, jurisdiction, duration, industry, additionalTerms }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json();
      setContractText(data.contractText);
      setRegulations(data.regulations || []);
      setStep(2);
      toast.success("Contract draft generated!");
    } catch (err) {
      toast.error("Failed to generate contract. Check your API keys.");
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!contractText) return;
    setValidating(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      const res = await fetch(`${API}/api/contract-creator/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ contractText, contractType, jurisdiction }),
      });
      if (!res.ok) throw new Error("Validation failed");
      const data = await res.json();
      setValidation(data);
      setStep(3);
      toast.success("Compliance validation complete!");
    } catch (err) {
      toast.error("Validation failed. Please try again.");
    } finally {
      setValidating(false);
    }
  };

  const handleSuggestClause = async () => {
    if (!clauseTitle) { toast.error("Enter a clause title first."); return; }
    setSuggestingClause(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      const res = await fetch(`${API}/api/contract-creator/suggest-clause`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ clauseTitle, currentText: clauseText, contractType, jurisdiction }),
      });
      if (!res.ok) throw new Error("Suggestion failed");
      const data = await res.json();
      setClauseSuggestion(data.suggestion);
    } catch (err) {
      toast.error("Failed to get clause suggestion.");
    } finally {
      setSuggestingClause(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(contractText);
    toast.success("Contract copied to clipboard!");
  };

  const downloadTxt = () => {
    const blob = new Blob([contractText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${contractType.replace(/\s+/g, "_")}_draft.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Contract downloaded!");
  };

  const severityColors: Record<string, string> = {
    high: "border-rose-500/25 bg-rose-500/5 text-rose-700 dark:text-rose-400",
    medium: "border-amber-500/25 bg-amber-500/5 text-amber-700 dark:text-amber-400",
    low: "border-blue-500/25 bg-blue-500/5 text-blue-700 dark:text-blue-400",
  };
  const severityBadge: Record<string, string> = {
    high: "bg-rose-500/10 text-rose-600 border-rose-500/20",
    medium: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    low: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  };

  return (
    <AppShell title="Contract Creator" subtitle="AI-powered contract drafting with built-in regulatory compliance">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">

        {/* Progress Steps */}
        <div className="flex items-center gap-3">
          {[{ n: 1, label: "Configure" }, { n: 2, label: "Draft & Edit" }, { n: 3, label: "Validate" }].map((s, i) => (
            <div key={s.n} className="flex items-center gap-3">
              <button onClick={() => { if (s.n === 1 || (s.n === 2 && contractText) || (s.n === 3 && validation)) setStep(s.n as 1|2|3); }}
                className={cn("flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold border transition-all",
                  step === s.n ? "bg-primary text-primary-foreground border-primary shadow-sm" :
                  s.n < step ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 cursor-pointer hover:opacity-80" :
                  "bg-muted text-muted-foreground border-border cursor-default")}>
                {s.n < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span>{s.n}</span>}
                {s.label}
              </button>
              {i < 2 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* ── STEP 1: Configure ── */}
        {step === 1 && (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Contract Type */}
            <div className="lg:col-span-3">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Select Contract Type</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {CONTRACT_TYPES.map(ct => (
                  <button key={ct.id} onClick={() => setContractType(ct.id)}
                    className={cn("rounded-xl border p-4 text-left transition-all hover:shadow-sm",
                      contractType === ct.id ? "border-primary/50 bg-primary/5 shadow-sm ring-2 ring-primary/20" : "border-border bg-card hover:border-primary/30")}>
                    <div className="mb-2 text-2xl">{ct.icon}</div>
                    <div className="text-xs font-bold text-foreground">{ct.label}</div>
                    <div className="mt-1 text-[10px] text-muted-foreground leading-relaxed">{ct.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Party Details */}
            <Card className="rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2"><FileSignature className="h-4 w-4 text-primary" /> Party A</h3>
              <div className="space-y-2">
                <input value={partyAName} onChange={e => setPartyAName(e.target.value)} placeholder="Full legal name or entity name"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                <input value={partyARole} onChange={e => setPartyARole(e.target.value)} placeholder="Role (e.g. Disclosing Party, Client)"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </Card>

            <Card className="rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2"><FileSignature className="h-4 w-4 text-blue-500" /> Party B</h3>
              <div className="space-y-2">
                <input value={partyBName} onChange={e => setPartyBName(e.target.value)} placeholder="Full legal name or entity name"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                <input value={partyBRole} onChange={e => setPartyBRole(e.target.value)} placeholder="Role (e.g. Receiving Party, Provider)"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </Card>

            <Card className="rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2"><BookOpen className="h-4 w-4 text-emerald-500" /> Contract Details</h3>
              <div className="space-y-2">
                <select value={jurisdiction} onChange={e => setJurisdiction(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  {JURISDICTIONS.map(j => <option key={j}>{j}</option>)}
                </select>
                <input value={duration} onChange={e => setDuration(e.target.value)} placeholder="Duration (e.g. 1 year, 24 months)"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                <input value={industry} onChange={e => setIndustry(e.target.value)} placeholder="Industry (e.g. SaaS, Healthcare)"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </Card>

            <div className="lg:col-span-3 space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">Purpose / Scope</label>
                  <Textarea value={purpose} onChange={e => setPurpose(e.target.value)} rows={3}
                    placeholder="Describe the purpose of this contract (e.g. 'sharing technical specifications for a software integration project')"
                    className="resize-none text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">Additional Terms or Requirements</label>
                  <Textarea value={additionalTerms} onChange={e => setAdditionalTerms(e.target.value)} rows={3}
                    placeholder="Any special requirements, custom clauses, or specific regulatory frameworks to include"
                    className="resize-none text-sm" />
                </div>
              </div>

              {/* Applicable Regulations Preview */}
              {contractType && REGULATION_RULES_PREVIEW[contractType] && (
                <Card className="rounded-xl border-primary/20 bg-primary/[0.02] p-4">
                  <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                    <ShieldCheck className="h-3.5 w-3.5" /> Applicable Regulations for {contractType}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {REGULATION_RULES_PREVIEW[contractType].map((r: string, i: number) => (
                      <Badge key={i} variant="outline" className="rounded-full text-[10px] px-2.5 py-0.5 bg-primary/5 text-primary border-primary/20">{r}</Badge>
                    ))}
                  </div>
                </Card>
              )}

              <Button onClick={handleGenerate} disabled={!contractType || loading} size="lg" className="w-full rounded-xl gap-2 text-sm font-semibold">
                {loading ? <><RefreshCw className="h-4 w-4 animate-spin" /> Generating AI Contract Draft...</> : <><Wand2 className="h-4 w-4" /> Generate Contract with AI</>}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Draft & Edit ── */}
        {step === 2 && contractText && (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Contract Editor */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Contract Draft</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="rounded-lg text-xs gap-1.5" onClick={copyToClipboard}>
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-lg text-xs gap-1.5" onClick={downloadTxt}>
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                </div>
              </div>
              <Textarea value={contractText} onChange={e => setContractText(e.target.value)} rows={30}
                className="font-mono text-xs leading-relaxed resize-y rounded-xl border-border" />
              <Button onClick={handleValidate} disabled={validating} size="lg" className="w-full rounded-xl gap-2 font-semibold">
                {validating ? <><RefreshCw className="h-4 w-4 animate-spin" /> Validating against regulations...</> : <><ShieldCheck className="h-4 w-4" /> Validate Compliance & Get Report</>}
              </Button>
            </div>

            {/* Right Panel: Regulations + Clause Suggester */}
            <div className="space-y-4">
              {/* Regulations Applied */}
              {regulations.length > 0 && (
                <Card className="rounded-xl p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Regulations Applied
                  </h4>
                  <div className="space-y-2">
                    {regulations.map((r: any) => (
                      <div key={r.id} className={cn("rounded-lg border p-2.5 text-xs", severityColors[r.severity])}>
                        <div className="font-semibold">{r.regulation}</div>
                        <div className="text-[10px] mt-0.5 text-muted-foreground">{r.clause}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Clause Suggester */}
              <Card className="rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> AI Clause Suggester
                </h4>
                <input value={clauseTitle} onChange={e => setClauseTitle(e.target.value)} placeholder="Clause title (e.g. Limitation of Liability)"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30" />
                <Textarea value={clauseText} onChange={e => setClauseText(e.target.value)} rows={3}
                  placeholder="Paste existing clause text here (or leave blank to draft from scratch)"
                  className="text-xs resize-none rounded-lg" />
                <Button onClick={handleSuggestClause} disabled={suggestingClause} size="sm" className="w-full rounded-lg text-xs gap-1.5">
                  {suggestingClause ? <><RefreshCw className="h-3 w-3 animate-spin" /> Generating...</> : <><Sparkles className="h-3 w-3" /> Get AI Suggestion</>}
                </Button>
                {clauseSuggestion && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Suggested Clause
                    </div>
                    <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">{clauseSuggestion}</p>
                    <Button size="sm" variant="outline" className="w-full rounded-lg text-[10px] h-7 gap-1"
                      onClick={() => { setContractText(t => t + "\n\n" + clauseSuggestion); toast.success("Clause appended to contract!"); }}>
                      <Copy className="h-3 w-3" /> Append to Contract
                    </Button>
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {/* ── STEP 3: Validation Report ── */}
        {step === 3 && validation && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              {/* Score Banner */}
              <Card className={cn("rounded-xl p-5 border-2",
                validation.overallScore >= 80 ? "border-emerald-500/30 bg-emerald-500/5" :
                validation.overallScore >= 60 ? "border-amber-500/30 bg-amber-500/5" :
                "border-rose-500/30 bg-rose-500/5")}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Compliance Validation Report</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{validation.summary}</p>
                  </div>
                  <div className={cn("text-4xl font-black",
                    validation.overallScore >= 80 ? "text-emerald-500" :
                    validation.overallScore >= 60 ? "text-amber-500" : "text-rose-500")}>
                    {validation.overallScore}<span className="text-lg font-semibold text-muted-foreground">/100</span>
                  </div>
                </div>
                {/* Score bar */}
                <div className="mt-3 h-2 rounded-full bg-border overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all",
                    validation.overallScore >= 80 ? "bg-emerald-500" :
                    validation.overallScore >= 60 ? "bg-amber-500" : "bg-rose-500")}
                    style={{ width: `${validation.overallScore}%` }} />
                </div>
              </Card>

              {/* Issues */}
              {validation.issues.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Compliance Issues Found</h4>
                  {validation.issues.map((issue, i) => (
                    <Card key={i} className={cn("rounded-xl border p-4 space-y-2", severityColors[issue.severity])}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          {issue.severity === "high" ? <ShieldAlert className="h-4 w-4 text-rose-500 shrink-0" /> :
                           issue.severity === "medium" ? <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" /> :
                           <Sparkles className="h-4 w-4 text-blue-500 shrink-0" />}
                          <span className="text-sm font-bold">{issue.title}</span>
                        </div>
                        <Badge variant="outline" className={cn("rounded-full text-[10px] uppercase font-bold px-2.5 py-0.5 shrink-0", severityBadge[issue.severity])}>
                          {issue.severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-foreground/80 leading-relaxed">{issue.description}</p>
                      <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 p-2.5 space-y-1">
                        <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <Sparkles className="h-3 w-3" /> Regulatory Suggestion ({issue.regulation})
                        </span>
                        <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">{issue.suggestion}</p>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Strengths */}
              {validation.strengths.length > 0 && (
                <Card className="rounded-xl border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Contract Strengths
                  </h4>
                  <ul className="space-y-1">
                    {validation.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />{s}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              <div className="flex gap-3">
                <Button onClick={() => setStep(2)} variant="outline" className="rounded-xl gap-2 text-sm">Edit Contract</Button>
                <Button onClick={downloadTxt} className="rounded-xl gap-2 text-sm flex-1">
                  <Download className="h-4 w-4" /> Download Final Contract
                </Button>
              </div>
            </div>

            {/* Summary sidebar */}
            <div className="space-y-4">
              <Card className="rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Issue Breakdown</h4>
                {(["high", "medium", "low"] as const).map(sev => {
                  const count = validation.issues.filter(i => i.severity === sev).length;
                  return (
                    <div key={sev} className={cn("flex items-center justify-between rounded-lg border px-3 py-2", severityColors[sev])}>
                      <span className="text-xs font-semibold capitalize">{sev} Risk</span>
                      <span className="text-sm font-black">{count}</span>
                    </div>
                  );
                })}
              </Card>
              <Card className="rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contract Details</h4>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div><span className="font-semibold text-foreground">Type:</span> {contractType}</div>
                  <div><span className="font-semibold text-foreground">Jurisdiction:</span> {jurisdiction}</div>
                  <div><span className="font-semibold text-foreground">Party A:</span> {partyAName || "N/A"}</div>
                  <div><span className="font-semibold text-foreground">Party B:</span> {partyBName || "N/A"}</div>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

// Regulations preview for step 1 (static lookup, no server call needed)
const REGULATION_RULES_PREVIEW: Record<string, string[]> = {
  "NDA": ["UTSA (Trade Secrets)", "GDPR Article 28", "GDPR Article 17 / CCPA"],
  "Service Agreement": ["EU AI Act Art. 50", "GDPR Art. 28 (DPA)", "IP Work-for-Hire Doctrine"],
  "Employment Contract": ["FLSA / Labor Standards", "NLRA (Non-Compete)", "GDPR Employee Privacy"],
  "SaaS Agreement": ["GDPR Art. 32 (Security)", "PCI-DSS", "CCPA Data Portability"],
  "Lease Agreement": ["Fair Housing Act", "Habitability Standards", "GDPR Tenant Data"],
};
