import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

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
  return (
    <AppShell title="Settings" subtitle="Manage your account, workspace, and preferences">
      <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
            <CardDescription>Update your personal information.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" defaultValue="Jane Doe" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" defaultValue="jane@firm.com" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="firm">Firm</Label>
              <Input id="firm" defaultValue="Doe & Associates LLP" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Preferences</CardTitle>
            <CardDescription>Customize how Legal AI works for you.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Email notifications", desc: "Receive updates about document analysis and compliance.", on: true },
              { label: "Weekly compliance digest", desc: "A summary of your team's compliance posture every Monday.", on: true },
              { label: "AI suggestions in chat", desc: "Show contextual suggested prompts while you chat.", on: false },
            ].map((p, i) => (
              <div key={p.label}>
                {i > 0 && <Separator className="my-4" />}
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{p.label}</p>
                    <p className="text-xs text-muted-foreground">{p.desc}</p>
                  </div>
                  <Switch defaultChecked={p.on} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" className="rounded-xl">Cancel</Button>
          <Button className="rounded-xl shadow-sm">Save changes</Button>
        </div>
      </div>
    </AppShell>
  );
}