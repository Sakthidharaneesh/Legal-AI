import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, MessageSquare, ShieldCheck, TrendingUp, ArrowRight, AlertTriangle, Bell, CheckCircle } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Legal AI" },
      { name: "description", content: "Overview of your legal workspace." },
    ],
  }),
  component: DashboardPage,
});

type Alert = {
  id: string; title: string; authority: string; date: string;
  status: string; summary: string; impactScore: number;
  actions: string[]; acknowledged: boolean;
};

function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const API_BASE = typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:8080" : "";

  useEffect(() => {
    const load = async () => {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
        const headers = { "Authorization": `Bearer ${token}` };
        const [statsRes, alertsRes] = await Promise.all([
          fetch(`${API_BASE}/api/stats`, { headers }),
          fetch(`${API_BASE}/api/alerts`, { headers }),
        ]);
        if (statsRes.ok) setStats(await statsRes.json());
        if (alertsRes.ok) setAlerts(await alertsRes.json());
      } catch (err) { console.error("Dashboard load error:", err); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const acknowledgeAlert = async (id: string) => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      await fetch(`${API_BASE}/api/alerts/${id}/acknowledge`, { 
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` }
      });
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
    } catch (err) { console.error(err); }
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const icons: Record<string, any> = { document: FileText, chat: MessageSquare, compliance: ShieldCheck };

  return (
    <AppShell title="Dashboard" subtitle="Your workspace at a glance">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Documents" value={stats?.documents ?? "—"} trend={`${stats?.averageRiskScore ?? 0}% avg risk`} icon={FileText} />
          <Stat label="AI Conversations" value={stats?.conversations ?? "—"} trend="Active sessions" icon={MessageSquare} />
          <Stat label="Compliance Checks" value={stats?.complianceChecks ?? "—"} trend="Evaluations run" icon={ShieldCheck} />
          <Stat label="Regulatory Alerts" value={alerts.length} trend={`${alerts.filter(a => !a.acknowledged).length} pending`} icon={Bell} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Activity Chart */}
          <Card className="rounded-xl shadow-sm lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">AI Activity</CardTitle>
              <Badge variant="outline" className="rounded-full text-xs">Last 7 days</Badge>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats?.weekActivity || []}>
                  <defs>
                    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
                  <Area type="monotone" dataKey="queries" stroke="var(--primary)" strokeWidth={2} fill="url(#g)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="rounded-xl shadow-sm">
            <CardHeader><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: "Start a new chat", icon: MessageSquare, href: "/" },
                { label: "Upload a document", icon: FileText, href: "/documents" },
                { label: "Run compliance check", icon: ShieldCheck, href: "/compliance" },
              ].map(q => (
                <a key={q.label} href={q.href}>
                  <Button variant="ghost" className="h-auto w-full justify-between rounded-lg p-3 hover:bg-accent">
                    <span className="flex items-center gap-3 text-sm">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <q.icon className="h-4 w-4" />
                      </span>
                      {q.label}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </a>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Regulatory Alerts */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Regulatory Alerts
            </CardTitle>
            <Badge variant="outline" className="rounded-full text-xs">{alerts.filter(a => !a.acknowledged).length} pending</Badge>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {alerts.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No alerts available.</p>}
            {alerts.map(a => (
              <div key={a.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium truncate">{a.title}</p>
                      <Badge variant="outline" className={`rounded-full text-[10px] ${a.impactScore >= 90 ? "bg-rose-500/10 text-rose-600 border-rose-500/20" : a.impactScore >= 85 ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-blue-500/10 text-blue-600 border-blue-500/20"}`}>
                        Impact: {a.impactScore}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">{a.authority} · {a.date}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{a.summary}</p>
                  </div>
                  {a.acknowledged ? (
                    <Badge className="shrink-0 rounded-full bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]"><CheckCircle className="h-3 w-3 mr-1" />Done</Badge>
                  ) : (
                    <Button size="sm" variant="outline" className="shrink-0 text-xs rounded-lg" onClick={() => acknowledgeAlert(a.id)}>Acknowledge</Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
          <CardContent className="divide-y divide-border">
            {!stats?.recentActivity?.length && <p className="text-sm text-muted-foreground py-4 text-center">No recent activity yet.</p>}
            {stats?.recentActivity?.map((r: any, i: number) => {
              const Icon = icons[r.type] || FileText;
              return (
                <div key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="h-4 w-4" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{r.title}</p>
                    <p className="text-xs text-muted-foreground">{timeAgo(r.time)}</p>
                  </div>
                  <Badge variant="outline" className="rounded-full text-xs">{r.tag}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, trend, icon: Icon }: { label: string; value: string | number; trend: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card className="rounded-xl p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{trend}</p>
    </Card>
  );
}