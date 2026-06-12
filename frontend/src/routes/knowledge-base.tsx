import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BookOpen, Plus, Trash, Search, Database, RefreshCw, Upload, CloudUpload } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/knowledge-base")({
  head: () => ({
    meta: [
      { title: "Knowledge Base — Legal AI" },
      { name: "description", content: "Manage your legal knowledge base for RAG." },
    ],
  }),
  component: KnowledgeBasePage,
});

type Article = { id: string; title: string; chunkCount: number; metadata: { framework?: string; source?: string } };

function KnowledgeBasePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [open, setOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [framework, setFramework] = useState("");
  const [kbFramework, setKbFramework] = useState("");
  const [source, setSource] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const API_BASE = typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:8080" : "";

  const loadArticles = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      const res = await fetch(`${API_BASE}/api/knowledge-base`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) setArticles(await res.json());
    } catch (err) { console.error(err); }
  };

  const handleUploadKBFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const toastId = toast.loading(`Uploading and indexing ${files.length} document(s) to knowledge base...`);
    setUploadOpen(false);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("kbFile", file);
        formData.append("title", file.name.replace(/\.[^/.]+$/, ""));
        formData.append("framework", kbFramework || "General");
        formData.append("source", file.name);

        const res = await fetch(`${API_BASE}/api/knowledge-base/upload`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` },
          body: formData,
        });

        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      }
      toast.success(`${files.length} document(s) successfully added to Knowledge Base!`, { id: toastId });
      setKbFramework("");
      loadArticles();
    } catch (err) {
      toast.error("Failed to upload document to knowledge base.", { id: toastId });
    }
  };

  useEffect(() => { loadArticles(); }, []);

  const addArticle = async () => {
    if (!title.trim() || !content.trim()) return;
    setLoading(true);
    const toastId = toast.loading("Indexing article into vector store...");
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      const res = await fetch(`${API_BASE}/api/knowledge-base`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ title, content, framework, source }),
      });
      if (res.ok) {
        toast.success("Article indexed successfully!", { id: toastId });
        setOpen(false);
        setTitle(""); setContent(""); setFramework(""); setSource("");
        loadArticles();
      } else {
        toast.error("Failed to index article.", { id: toastId });
      }
    } catch (err) {
      toast.error("Error indexing article.", { id: toastId });
    } finally { setLoading(false); }
  };

  const deleteArticle = async (id: string) => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      await fetch(`${API_BASE}/api/knowledge-base/${id}`, { 
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      setArticles(prev => prev.filter(a => a.id !== id));
      toast.success("Article removed from knowledge base.");
    } catch (err) { toast.error("Failed to delete article."); }
  };

  const searchKB = async () => {
    if (!searchQuery.trim()) return;
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      const res = await fetch(`${API_BASE}/api/knowledge-base/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ query: searchQuery, topK: 5 }),
      });
      if (res.ok) setSearchResults(await res.json());
    } catch (err) { console.error(err); }
  };

  const PRESET_ARTICLES = [
    { title: "GDPR Article 33 — Breach Notification", framework: "GDPR", content: "In the case of a personal data breach, the controller shall without undue delay and, where feasible, not later than 72 hours after having become aware of it, notify the personal data breach to the supervisory authority competent in accordance with Article 55, unless the personal data breach is unlikely to result in a risk to the rights and freedoms of natural persons. Where the notification to the supervisory authority is not made within 72 hours, it shall be accompanied by reasons for the delay." },
    { title: "GDPR Article 17 — Right to Erasure", framework: "GDPR", content: "The data subject shall have the right to obtain from the controller the erasure of personal data concerning him or her without undue delay and the controller shall have the obligation to erase personal data without undue delay where the personal data are no longer necessary in relation to the purposes for which they were collected or otherwise processed." },
    { title: "SOX Section 302 — Corporate Responsibility", framework: "SOX", content: "The signing officers of an issuer must certify in each annual or quarterly report that they have reviewed the report, it does not contain any untrue statement of a material fact or omit to state a material fact, the financial statements fairly present the financial condition and results of operations, and the signing officers are responsible for establishing and maintaining internal controls." },
  ];

  return (
    <AppShell title="Knowledge Base" subtitle="Build and manage your legal RAG knowledge store">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Vector Store</h2>
            <p className="text-sm text-muted-foreground">{articles.length} documents indexed · {articles.reduce((s, a) => s + a.chunkCount, 0)} chunks</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="rounded-xl"><Plus className="mr-2 h-4 w-4" />Add Article</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add Knowledge Base Article</DialogTitle>
                  <DialogDescription>Add legal text to improve RAG responses.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Title</Label>
                    <Input placeholder="e.g. GDPR Article 33" value={title} onChange={e => setTitle(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Framework</Label><Input placeholder="GDPR, SOX, HIPAA..." value={framework} onChange={e => setFramework(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Source</Label><Input placeholder="EU Official Journal" value={source} onChange={e => setSource(e.target.value)} /></div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Content</Label>
                    <Textarea placeholder="Paste the full legal text here..." rows={6} value={content} onChange={e => setContent(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={addArticle} disabled={loading}>{loading ? "Indexing..." : "Index Article"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-xl shadow-sm"><Upload className="mr-2 h-4 w-4" />Upload Document</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Upload to Knowledge Base</DialogTitle>
                  <DialogDescription>Index PDFs, DOCX, DOC, Images, CSV, JSON, MD, HTML, or TXT into the vector database.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 my-2">
                  <div className="space-y-1.5">
                    <Label>Regulatory Framework (Optional)</Label>
                    <Input placeholder="e.g. GDPR, HIPAA, SOX, Internal Policy" value={kbFramework} onChange={e => setKbFramework(e.target.value)} />
                  </div>
                  <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={e => { e.preventDefault(); setDragOver(false); handleUploadKBFiles(e.dataTransfer.files); }} onClick={() => fileInputRef.current?.click()}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-accent/40"}`}>
                    <CloudUpload className="h-10 w-10 text-muted-foreground" />
                    <p className="mt-3 text-sm font-medium">Drop files here or click to browse</p>
                    <input ref={fileInputRef} type="file" multiple className="hidden" accept="image/*,.pdf,.txt,.docx,.doc,.xlsx,.xls,.csv,.json,.md,.html,.htm" onChange={e => handleUploadKBFiles(e.target.files)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
                  <Button onClick={() => fileInputRef.current?.click()}>Choose files</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Preset Articles */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4" />Quick Add — Pre-built Regulations</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {PRESET_ARTICLES.map(p => (
              <Card key={p.title} className="rounded-xl p-4 hover:shadow-md transition cursor-pointer border-dashed" onClick={() => { setTitle(p.title); setContent(p.content); setFramework(p.framework); setSource("Official Regulation"); setOpen(true); }}>
                <div className="flex items-start justify-between mb-2">
                  <Badge variant="outline" className="rounded-full text-[10px]">{p.framework}</Badge>
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">{p.title}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.content.substring(0, 100)}...</p>
              </Card>
            ))}
          </CardContent>
        </Card>

        {/* Search */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Search className="h-4 w-4" />Search Knowledge Base</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input placeholder="Search for legal content..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && searchKB()} className="flex-1" />
              <Button onClick={searchKB} className="rounded-xl">Search</Button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-4 space-y-3">
                {searchResults.map((r, i) => (
                  <div key={i} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{r.documentTitle}</span>
                      <Badge variant="outline" className="text-[10px] rounded-full">Score: {((r.score || 0) * 100).toFixed(0)}%</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{r.text?.substring(0, 200)}...</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Indexed Articles */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4" />Indexed Documents</CardTitle></CardHeader>
          <CardContent>
            {articles.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No articles indexed yet. Add some above!</p>}
            <div className="space-y-2">
              {articles.map(a => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/40 transition">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.chunkCount} chunks{a.metadata?.framework ? ` · ${a.metadata.framework}` : ""}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-500/10 rounded-lg shrink-0" onClick={() => deleteArticle(a.id)}>
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
