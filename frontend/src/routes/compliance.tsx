import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, AlertTriangle, ShieldCheck, Check, Square, Play } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/compliance")({
  head: () => ({
    meta: [
      { title: "Compliance — Legal AI" },
      { name: "description", content: "Monitor compliance status and risk score." },
    ],
  }),
  component: CompliancePage,
});

type ChecklistItem = {
  id: string;
  category: string;
  title: string;
  description: string;
  status: "completed" | "pending";
  severity: "high" | "medium" | "low";
  regulationSource: string;
};

const barData = [
  { month: "Jan", completed: 12, pending: 4 },
  { month: "Feb", completed: 18, pending: 3 },
  { month: "Mar", completed: 15, pending: 6 },
  { month: "Apr", completed: 22, pending: 2 },
  { month: "May", completed: 19, pending: 5 },
  { month: "Jun", completed: 26, pending: 3 },
];

function CompliancePage() {
  const [businessType, setBusinessType] = useState("SaaS");
  const [country, setCountry] = useState("US");
  const [loading, setLoading] = useState(false);
  
  const [currentCheckId, setCurrentCheckId] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [overallScore, setOverallScore] = useState<number>(100);

  const API_BASE = typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:8080" : "";

  const loadLatestAudit = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      const res = await fetch(`${API_BASE}/api/compliance/history`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const history = await res.json();
        if (history && history.length > 0) {
          const latest = history[0];
          setCurrentCheckId(latest._id);
          setChecklist(latest.checklist);
          setOverallScore(latest.overallScore);
          setBusinessType(latest.businessType || "SaaS");
          setCountry(latest.country || "US");
        } else {
          await runAuditDirect("SaaS", "US");
        }
      }
    } catch (err) {
      console.error("Failed to load compliance audit history:", err);
    }
  };

  useEffect(() => {
    loadLatestAudit();
  }, []);

  const runAudit = async () => {
    await runAuditDirect(businessType, country);
  };

  const runAuditDirect = async (bType: string, cCode: string) => {
    setLoading(true);
    const toastId = toast.loading("Evaluating compliance framework parameters...");
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      const res = await fetch(`${API_BASE}/api/compliance/evaluate`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ businessType: bType, country: cCode })
      });
      if (res.ok) {
        const audit = await res.json();
        setCurrentCheckId(audit._id);
        setChecklist(audit.checklist || []);
        setOverallScore(audit.overallScore ?? 100);
        toast.success("Compliance audit completed!", { id: toastId });
      } else {
        toast.error("Failed to run compliance evaluation.", { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error("Error connecting to compliance service.", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const toggleItemStatus = async (itemId: string, currentStatus: string) => {
    if (!currentCheckId) return;
    const nextStatus = currentStatus === "completed" ? "pending" : "completed";
    
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      const res = await fetch(`${API_BASE}/api/compliance/checks/${currentCheckId}/items/${itemId}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        const updatedCheck = await res.json();
        setChecklist(updatedCheck.checklist);
        setOverallScore(updatedCheck.overallScore);
        toast.success(`Task marked as ${nextStatus === "completed" ? "complete" : "pending"}`);
      } else {
        toast.error("Failed to update task status");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error updating task status");
    }
  };

  // Derived Stats
  const completedCount = checklist.filter(item => item.status === "completed").length;
  const pendingCount = checklist.filter(item => item.status === "pending").length;
  const coveragePercent = overallScore;
  
  // Calculate a dynamic compliance risk score: pending high severity = 15, medium = 8, low = 3
  const dynamicRiskScore = checklist
    .filter(i => i.status === "pending")
    .reduce((acc, curr) => acc + (curr.severity === "high" ? 15 : curr.severity === "medium" ? 8 : 3), 0);

  const getRiskLabel = (score: number) => {
    if (score < 10) return "Very Low Risk";
    if (score < 25) return "Low Risk";
    if (score < 45) return "Medium Risk";
    return "High Risk";
  };

  // Pie Chart Data
  const lowCount = checklist.filter(i => i.severity === "low").length;
  const medCount = checklist.filter(i => i.severity === "medium").length;
  const highCount = checklist.filter(i => i.severity === "high").length;

  const pieData = [
    { name: "Low Severity", value: lowCount || 1, color: "oklch(0.72 0.15 160)" },
    { name: "Medium Severity", value: medCount || 1, color: "oklch(0.78 0.15 80)" },
    { name: "High Severity", value: highCount || 1, color: "oklch(0.65 0.2 25)" },
  ];

  return (
    <AppShell title="Compliance Checker" subtitle="Overview of your organization's compliance posture">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6 text-left">
        
        {/* Compliance Configuration Card */}
        <Card className="rounded-xl shadow-sm border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Compliance Framework Evaluator</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Business Type</label>
                <select 
                  value={businessType} 
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="w-full bg-accent/40 text-foreground border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="SaaS">SaaS / Cloud Platform</option>
                  <option value="Fintech">Fintech / Banking / Payments</option>
                  <option value="Healthcare">Healthcare / HealthTech</option>
                  <option value="AI">AI / Machine Learning Systems</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Geography / Regulation</label>
                <select 
                  value={country} 
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full bg-accent/40 text-foreground border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="EU">European Union (GDPR / AI Act)</option>
                  <option value="US">United States (HIPAA / SOC 2)</option>
                  <option value="Global">Global / Multi-Jurisdictional</option>
                </select>
              </div>
            </div>
            <Button onClick={runAudit} disabled={loading} className="rounded-xl shadow-sm h-10 px-6 font-semibold flex items-center gap-2">
              <Play className="h-4 w-4" /> {loading ? "Evaluating..." : "Run Framework Audit"}
            </Button>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={CheckCircle2} label="Completed Rules" value={String(completedCount)} hint={`${completedCount} requirements passed`} color="emerald" />
          <StatCard icon={Clock} label="Pending Tasks" value={String(pendingCount)} hint={`${pendingCount} rules await audit`} color="amber" />
          <StatCard icon={AlertTriangle} label="Risk Score" value={String(dynamicRiskScore)} hint={getRiskLabel(dynamicRiskScore)} color={dynamicRiskScore > 40 ? "rose" : "primary"} />
          <StatCard icon={ShieldCheck} label="Overall Coverage" value={`${coveragePercent}%`} hint={`Across ${[...new Set(checklist.map(c => c.category))].length} areas`} color="primary" />
        </div>

        {/* Graphs Section */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="rounded-xl shadow-sm lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Historical Compliance Activity</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="completed" name="Completed Tasks" fill="var(--primary)" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="pending" name="Pending Audits" fill="var(--muted-foreground)" radius={[8, 8, 0, 0]} opacity={0.4} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Audit Severity Distribution</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {pieData.map((e) => (
                      <Cell key={e.name} fill={e.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 flex justify-center gap-4">
                {pieData.map((e) => (
                  <div key={e.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-2 w-2 rounded-full" style={{ background: e.color }} />
                    {e.name}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Compliance Tasks List */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Framework Requirements Checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {checklist.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No compliance checks executed yet.</p>
            ) : (
              checklist.map((t) => (
                <div 
                  key={t.id} 
                  className={cn(
                    "flex items-start gap-4 p-4 rounded-xl border transition",
                    t.status === "completed" 
                      ? "border-emerald-500/10 bg-emerald-500/5 opacity-80" 
                      : "border-border bg-card hover:border-primary/20"
                  )}
                >
                  <button 
                    onClick={() => toggleItemStatus(t.id, t.status)}
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-input transition focus:outline-none",
                      t.status === "completed" 
                        ? "bg-emerald-500 border-emerald-500 text-white" 
                        : "bg-background text-transparent hover:border-primary/40"
                    )}
                  >
                    <Check className="h-3 w-3 stroke-[3]" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className={cn("text-sm font-semibold", t.status === "completed" && "line-through text-muted-foreground")}>
                          {t.title}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t.regulationSource} &middot; <span className="font-semibold">{t.category}</span>
                        </p>
                      </div>
                      <Badge variant="outline" className={cn(
                        "rounded-full text-[10px] uppercase font-bold px-2 py-0.5 shrink-0",
                        t.severity === "high" ? "bg-rose-500/10 text-rose-600 border-rose-500/20" :
                        t.severity === "medium" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                        "bg-blue-500/10 text-blue-600 border-blue-500/20"
                      )}>
                        {t.severity}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                      {t.description}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  color: "emerald" | "amber" | "rose" | "primary";
}) {
  const colors = {
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    primary: "bg-primary/10 text-primary",
  };
  return (
    <Card className="rounded-xl p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${colors[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}