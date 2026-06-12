import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Legal AI" },
      { name: "description", content: "Manage your account and preferences." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [name, setName] = useState("Jane Doe");
  const [email, setEmail] = useState("jane@firm.com");
  const [firm, setFirm] = useState("Doe & Associates LLP");
  const [dark, setDark] = useState(false);
  const [language, setLanguage] = useState("en");

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    const savedLang = localStorage.getItem("legal-ai-language");
    if (savedLang) setLanguage(savedLang);
    try {
      const u = localStorage.getItem("user");
      if (u) {
        const parsed = JSON.parse(u);
        if (parsed.name) setName(parsed.name);
        if (parsed.email) setEmail(parsed.email);
      }
    } catch { /* ignore */ }
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const save = () => {
    localStorage.setItem("user", JSON.stringify({ name, email }));
    localStorage.setItem("legal-ai-language", language);
    toast.success("Settings saved successfully!");
  };

  return (
    <AppShell title="Settings" subtitle="Manage your account, workspace, and preferences">
      <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
            <CardDescription>Update your personal information.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="name">Full name</Label><Input id="name" value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="firm">Firm</Label><Input id="firm" value={firm} onChange={e => setFirm(e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Appearance & Language</CardTitle>
            <CardDescription>Customize how Legal AI works for you.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Dark Mode</p>
                <p className="text-xs text-muted-foreground">Toggle between light and dark themes.</p>
              </div>
              <Switch checked={dark} onCheckedChange={toggleDark} />
            </div>
            <Separator />
            <div>
              <p className="text-sm font-medium mb-2">AI Response Language</p>
              <p className="text-xs text-muted-foreground mb-3">Select the language for AI-generated legal responses.</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { code: "en", label: "🇬🇧 English" },
                  { code: "ta", label: "🇮🇳 Tamil (தமிழ்)" },
                  { code: "hi", label: "🇮🇳 Hindi (हिन्दी)" },
                ].map(l => (
                  <Button key={l.code} variant={language === l.code ? "default" : "outline"} className="rounded-xl text-xs"
                    onClick={() => setLanguage(l.code)}>
                    {l.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Notifications</CardTitle>
            <CardDescription>Configure notification preferences.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Email notifications", desc: "Receive updates about document analysis and compliance.", on: true },
              { label: "Weekly compliance digest", desc: "A summary of your team's compliance posture every Monday.", on: true },
              { label: "AI suggestions in chat", desc: "Show contextual suggested prompts while you chat.", on: false },
              { label: "Regulatory alert emails", desc: "Get notified when new regulatory alerts are published.", on: true },
            ].map((p, i) => (
              <div key={p.label}>
                {i > 0 && <Separator className="my-4" />}
                <div className="flex items-center justify-between gap-4">
                  <div><p className="text-sm font-medium">{p.label}</p><p className="text-xs text-muted-foreground">{p.desc}</p></div>
                  <Switch defaultChecked={p.on} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" className="rounded-xl">Cancel</Button>
          <Button className="rounded-xl shadow-sm" onClick={save}>Save changes</Button>
        </div>
      </div>
    </AppShell>
  );
}