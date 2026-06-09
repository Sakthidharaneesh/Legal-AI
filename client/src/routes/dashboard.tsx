import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, MessageSquare, ShieldCheck, TrendingUp, ArrowRight } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
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

const activity = [
  { day: "Mon", queries: 12 },
  { day: "Tue", queries: 19 },
  { day: "Wed", queries: 14 },
  { day: "Thu", queries: 28 },
  { day: "Fri", queries: 22 },
  { day: "Sat", queries: 8 },
  { day: "Sun", queries: 11 },
];

const recent = [
  { icon: FileText, title: "MSA_Acme_2025.pdf analyzed", time: "2 minutes ago", tag: "Document" },
  { icon: MessageSquare, title: "Asked about indemnification limits", time: "1 hour ago", tag: "Chat" },
  { icon: ShieldCheck, title: "GDPR review marked complete", time: "3 hours ago", tag: "Compliance" },
  { icon: FileText, title: "NDA_Vendor_Q3.pdf flagged for review", time: "Yesterday", tag: "Document" },
  { icon: MessageSquare, title: "Drafted privacy policy section", time: "Yesterday", tag: "Chat" },
];

function DashboardPage() {
  return (
    <AppShell title="Dashboard" subtitle="Your workspace at a glance">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Documents" value="48" trend="+8 this week" icon={FileText} />
          <Stat label="AI conversations" value="216" trend="+24 this week" icon={MessageSquare} />
          <Stat label="Compliance items" value="142" trend="92% coverage" icon={ShieldCheck} />
          <Stat label="Time saved" value="36h" trend="vs. manual review" icon={TrendingUp} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="rounded-xl shadow-sm lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">AI activity</CardTitle>
              <Badge variant="outline" className="rounded-full text-xs">Last 7 days</Badge>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activity}>
                  <defs>
                    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Area type="monotone" dataKey="queries" stroke="var(--primary)" strokeWidth={2} fill="url(#g)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: "Start a new chat", icon: MessageSquare },
                { label: "Upload a document", icon: FileText },
                { label: "Run compliance check", icon: ShieldCheck },
              ].map((q) => (
                <Button key={q.label} variant="ghost" className="h-auto w-full justify-between rounded-lg p-3 hover:bg-accent">
                  <span className="flex items-center gap-3 text-sm">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <q.icon className="h-4 w-4" />
                    </span>
                    {q.label}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {recent.map((r, i) => (
              <div key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <r.icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.time}</p>
                </div>
                <Badge variant="outline" className="rounded-full text-xs">{r.tag}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  trend,
  icon: Icon,
}: {
  label: string;
  value: string;
  trend: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="rounded-xl p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{trend}</p>
    </Card>
  );
}