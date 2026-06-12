import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, FileText, Trash, CloudUpload, Download, BookTemplate, ArrowLeftRight, ShieldAlert, Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/documents")({
  head: () => ({ meta: [{ title: "Document Analyzer — Legal AI" }, { name: "description", content: "Upload and analyze legal documents for compliance and risks." }] }),
  component: DocumentsPage,
});

type Doc = {
  id: string; name: string; size: string; type: string;
  status: "Analyzed" | "Processing" | "Needs review"; uploaded: string;
  riskScore?: number;
  findings?: Array<{ id: string; clause: string; severity: "high" | "medium" | "low"; findingType: string; details: string; suggestedRewrite: string }>;
};

type Template = { id: string; name: string; type: string; description: string; text: string; clauseCount: number; riskLevel: string };

const statusVariant: Record<Doc["status"], string> = {
  Analyzed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  Processing: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  "Needs review": "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
};

function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [open, setOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<Doc[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const API_BASE = typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:8080" : "";

  const loadDocs = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      const res = await fetch(`${API_BASE}/api/documents`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDocs(data.map((d: any) => ({
          id: d._id, name: d.title || d.filename,
          size: d.extractedText ? `${(d.extractedText.length / 1024).toFixed(1)} KB` : "150 KB",
          type: d.fileType ? d.fileType.toUpperCase() : "PDF",
          status: d.riskScore < 70 ? "Needs review" : "Analyzed",
          uploaded: new Date(d.createdAt).toLocaleDateString(),
          riskScore: d.riskScore, findings: d.findings || []
        })));
      }
    } catch (err) { console.error(err); }
  };

  const loadTemplates = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/templates`);
      if (res.ok) setTemplates(await res.json());
    } catch (err) { console.error(err); }
  };

  useEffect(() => { loadDocs(); loadTemplates(); }, []);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const toastId = toast.loading(`Uploading and auditing ${files.length} document(s)...`);
    setOpen(false);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("contractFile", file);
        formData.append("title", file.name.replace(/\.[^/.]+$/, ""));
        const res = await fetch(`${API_BASE}/api/documents/upload`, { 
          method: "POST", 
          headers: { "Authorization": `Bearer ${token}` },
          body: formData 
        });
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        const d = await res.json();
        setDocs(prev => [{ id: d._id, name: d.title || d.filename, size: `${(file.size / 1024).toFixed(0)} KB`, type: d.fileType?.toUpperCase() || "PDF", status: d.riskScore < 70 ? "Needs review" : "Analyzed", uploaded: "Just now", riskScore: d.riskScore, findings: d.findings || [] }, ...prev]);
      }
      toast.success(`${files.length} document(s) uploaded successfully!`, { id: toastId });
    } catch (err) { toast.error("Failed to upload document.", { id: toastId }); }
  };

  const uploadTemplate = async (tpl: Template) => {
    const toastId = toast.loading(`Auditing template: ${tpl.name}...`);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      const blob = new Blob([tpl.text], { type: "text/plain" });
      const formData = new FormData();
      formData.append("contractFile", blob, `${tpl.id}.txt`);
      formData.append("title", tpl.name);
      const res = await fetch(`${API_BASE}/api/documents/upload`, { 
        method: "POST", 
        headers: { "Authorization": `Bearer ${token}` },
        body: formData 
      });
      if (!res.ok) throw new Error("Upload failed");
      const d = await res.json();
      setDocs(prev => [{ id: d._id, name: d.title, size: `${(tpl.text.length / 1024).toFixed(1)} KB`, type: "TXT", status: d.riskScore < 70 ? "Needs review" : "Analyzed", uploaded: "Just now", riskScore: d.riskScore, findings: d.findings || [] }, ...prev]);
      toast.success(`Template "${tpl.name}" analyzed!`, { id: toastId });
    } catch (err) { toast.error("Failed to analyze template.", { id: toastId }); }
  };

  const toggleCompare = (doc: Doc) => {
    setCompareSelection(prev => {
      const exists = prev.find(d => d.id === doc.id);
      if (exists) return prev.filter(d => d.id !== doc.id);
      if (prev.length >= 2) return [prev[1], doc];
      return [...prev, doc];
    });
  };

  const exportPDF = (doc: Doc) => {
    import("jspdf").then(({ default: jsPDF }) => {
      const pdf = new jsPDF();
      const margin = 15;
      let y = margin;

      pdf.setFontSize(18);
      pdf.text("Legal AI — Audit Report", margin, y); y += 10;
      pdf.setFontSize(12);
      pdf.text(`Document: ${doc.name}`, margin, y); y += 7;
      pdf.text(`Risk Score: ${doc.riskScore ?? "N/A"}/100`, margin, y); y += 7;
      pdf.text(`Status: ${doc.status}`, margin, y); y += 7;
      pdf.text(`Date: ${new Date().toLocaleDateString()}`, margin, y); y += 12;

      pdf.setFontSize(14);
      pdf.text("Findings:", margin, y); y += 8;

      if (!doc.findings || doc.findings.length === 0) {
        pdf.setFontSize(10);
        pdf.text("No risks or compliance issues identified.", margin, y);
      } else {
        doc.findings.forEach((f, idx) => {
          if (y > 260) { pdf.addPage(); y = margin; }
          pdf.setFontSize(11);
          pdf.text(`${idx + 1}. ${f.findingType} [${f.severity.toUpperCase()}]`, margin, y); y += 6;
          pdf.setFontSize(9);
          const details = pdf.splitTextToSize(`Details: ${f.details}`, 180);
          pdf.text(details, margin + 5, y); y += details.length * 4 + 2;
          const clause = pdf.splitTextToSize(`Clause: "${f.clause}"`, 180);
          pdf.text(clause, margin + 5, y); y += clause.length * 4 + 2;
          const rewrite = pdf.splitTextToSize(`Suggested: "${f.suggestedRewrite}"`, 180);
          pdf.text(rewrite, margin + 5, y); y += rewrite.length * 4 + 6;
        });
      }

      pdf.save(`${doc.name}_audit_report.pdf`);
      toast.success("PDF report downloaded!");
    });
  };

  return (
    <AppShell title="Document Analyzer" subtitle="Upload, analyze, and manage your legal documents">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Document Analyzer Library</h2>
            <p className="text-sm text-muted-foreground">{docs.length} documents in your workspace</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-xl text-xs" onClick={() => setShowTemplates(!showTemplates)}>
              <BookTemplate className="mr-2 h-4 w-4" />{showTemplates ? "Hide" : "Show"} Templates
            </Button>
            <Button variant={compareMode ? "default" : "outline"} className="rounded-xl text-xs" onClick={() => { setCompareMode(!compareMode); setCompareSelection([]); }}>
              <ArrowLeftRight className="mr-2 h-4 w-4" />{compareMode ? "Exit Compare" : "Compare"}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-xl shadow-sm"><Upload className="mr-2 h-4 w-4" />Upload</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Upload documents</DialogTitle>
                  <DialogDescription>PDF, DOCX, DOC, Images, CSV, JSON, MD, HTML, or TXT up to 10 MB each.</DialogDescription>
                </DialogHeader>
                <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }} onClick={() => inputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-accent/40"}`}>
                  <CloudUpload className="h-10 w-10 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium">Drop files here or click to browse</p>
                  <input ref={inputRef} type="file" multiple className="hidden" accept="image/*,.pdf,.txt,.docx,.doc,.xlsx,.xls,.csv,.json,.md,.html,.htm" onChange={e => handleFiles(e.target.files)} />
                </div>
                <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => inputRef.current?.click()}>Choose files</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Templates Library */}
        {showTemplates && (
          <Card className="rounded-xl shadow-sm p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><BookTemplate className="h-4 w-4" />Contract Templates</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {templates.map(t => (
                <Card key={t.id} className="rounded-xl p-4 hover:shadow-md transition cursor-pointer border-dashed" onClick={() => uploadTemplate(t)}>
                  <div className="flex items-start justify-between mb-2">
                    <Badge variant="outline" className={cn("rounded-full text-[10px]", t.riskLevel === "critical" ? "bg-rose-500/10 text-rose-600 border-rose-500/20" : t.riskLevel === "high" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20")}>{t.riskLevel}</Badge>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t.description?.substring(0, 80)}...</p>
                </Card>
              ))}
            </div>
          </Card>
        )}

        {/* Compare bar */}
        {compareMode && (
          <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
            <ArrowLeftRight className="h-4 w-4 text-primary" />
            <span className="text-sm">Select 2 documents to compare. Selected: <strong>{compareSelection.length}/2</strong></span>
            {compareSelection.length === 2 && (
              <Button size="sm" className="ml-auto rounded-lg text-xs" onClick={() => setCompareOpen(true)}>Compare Now</Button>
            )}
          </div>
        )}

        {/* Document cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {docs.slice(0, 4).map(d => (
            <Card key={d.id} className={cn("rounded-xl p-4 shadow-sm transition hover:shadow-md cursor-pointer", compareMode && compareSelection.find(c => c.id === d.id) && "ring-2 ring-primary")}
              onClick={() => compareMode ? toggleCompare(d) : (setSelectedDoc(d), setDetailOpen(true))}>
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileText className="h-5 w-5" /></div>
                <Badge variant="outline" className={`rounded-full text-xs ${statusVariant[d.status]}`}>{d.status}</Badge>
              </div>
              <p className="mt-3 truncate text-sm font-medium" title={d.name}>{d.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{d.size} · {d.uploaded}</p>
              {d.riskScore !== undefined && (
                <div className="mt-2 text-xs font-semibold text-muted-foreground flex items-center justify-between">
                  <span>Risk Score:</span>
                  <span className={cn(d.riskScore < 50 ? "text-rose-500" : d.riskScore < 80 ? "text-amber-500" : "text-emerald-500")}>{d.riskScore}/100</span>
                </div>
              )}
            </Card>
          ))}
        </div>

        {/* Document table */}
        <Card className="rounded-xl shadow-sm">
          <Table>
            <TableHeader><TableRow>
              {compareMode && <TableHead className="w-12">Select</TableHead>}
              <TableHead>Name</TableHead><TableHead className="hidden md:table-cell">Type</TableHead><TableHead className="hidden md:table-cell">Size</TableHead><TableHead>Status</TableHead><TableHead className="hidden sm:table-cell">Uploaded</TableHead><TableHead className="w-24"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {docs.map(d => (
                <TableRow key={d.id} className="hover:bg-accent/40 cursor-pointer" onClick={() => compareMode ? toggleCompare(d) : (setSelectedDoc(d), setDetailOpen(true))}>
                  {compareMode && <TableCell><input type="checkbox" checked={!!compareSelection.find(c => c.id === d.id)} readOnly className="rounded" /></TableCell>}
                  <TableCell className="font-medium"><div className="flex items-center gap-3"><FileText className="h-4 w-4 text-muted-foreground" /><span className="truncate">{d.name}</span></div></TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{d.type}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{d.size}</TableCell>
                  <TableCell><Badge variant="outline" className={`rounded-full text-xs ${statusVariant[d.status]}`}>{d.status}</Badge></TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{d.uploaded}</TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title="Export PDF" onClick={() => exportPDF(d)}><Download className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-500/10 rounded-lg" onClick={async () => {
                        if (confirm(`Delete "${d.name}"?`)) {
                          try { const res = await fetch(`${API_BASE}/api/documents/${d.id}`, { method: "DELETE" }); if (res.ok) { setDocs(prev => prev.filter(doc => doc.id !== d.id)); toast.success("Deleted."); } } catch { toast.error("Failed."); }
                        }
                      }}><Trash className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Audit Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl p-6 border border-border">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <span className="truncate pr-4 text-lg font-bold text-foreground">{selectedDoc?.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground uppercase font-semibold">Audit Score</span>
                <span className={cn(
                  "rounded-full text-sm font-bold py-1 px-4 border shadow-sm",
                  (selectedDoc?.riskScore ?? 100) < 50 ? "bg-rose-500/10 text-rose-600 border-rose-500/20" :
                    (selectedDoc?.riskScore ?? 100) < 80 ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                      "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                )}>
                  {selectedDoc?.riskScore ?? 100}/100
                </span>
              </div>
            </DialogTitle>
            <DialogDescription className="mt-1">
              Risk analysis summary with automated legal compliance remediation.
            </DialogDescription>

            {/* Visual Risk Breakdown Summary Pills */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {(() => {
                const findings = selectedDoc?.findings || [];
                const high = findings.filter((f: any) => f.severity === "high").length;
                const med = findings.filter((f: any) => f.severity === "medium").length;
                const low = findings.filter((f: any) => f.severity === "low").length;
                return (
                  <>
                    <Badge variant="outline" className={cn("rounded-full text-xs font-medium px-3 py-1 flex items-center gap-1.5", high > 0 ? "bg-rose-500/15 text-rose-700 border-rose-500/25" : "bg-muted text-muted-foreground border-border")}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", high > 0 ? "bg-rose-500 animate-pulse" : "bg-muted-foreground")} />
                      {high} High Risk
                    </Badge>
                    <Badge variant="outline" className={cn("rounded-full text-xs font-medium px-3 py-1 flex items-center gap-1.5", med > 0 ? "bg-amber-500/15 text-amber-700 border-amber-500/25" : "bg-muted text-muted-foreground border-border")}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", med > 0 ? "bg-amber-500" : "bg-muted-foreground")} />
                      {med} Medium Risk
                    </Badge>
                    <Badge variant="outline" className={cn("rounded-full text-xs font-medium px-3 py-1 flex items-center gap-1.5", low > 0 ? "bg-blue-500/15 text-blue-700 border-blue-500/25" : "bg-muted text-muted-foreground border-border")}>
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      {low} Low Risk
                    </Badge>
                  </>
                );
              })()}
            </div>
          </DialogHeader>

          <div className="space-y-6 my-4">
            {/* Main Risk Findings */}
            {!selectedDoc?.findings || selectedDoc.findings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                <h4 className="text-sm font-semibold">Perfect Compliance Score!</h4>
                <p className="text-xs text-muted-foreground max-w-sm">No risks, waivers, or regulatory concerns were identified in this document.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Detailed Findings</h3>
                {selectedDoc.findings.map((f: any, idx: number) => (
                  <div key={idx} className={cn(
                    "rounded-xl border p-4 space-y-3 text-left transition hover:shadow-sm",
                    f.severity === "high" ? "border-rose-500/20 bg-rose-500/[0.02]" :
                      f.severity === "medium" ? "border-amber-500/20 bg-amber-500/[0.02]" :
                        "border-blue-500/20 bg-blue-500/[0.02]"
                  )}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {f.severity === "high" ? (
                          <ShieldAlert className="h-4 w-4 text-rose-500" />
                        ) : f.severity === "medium" ? (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        ) : (
                          <Sparkles className="h-4 w-4 text-blue-500" />
                        )}
                        <span className="text-sm font-bold text-foreground">{f.findingType}</span>
                      </div>
                      <Badge variant="outline" className={cn(
                        "rounded-full text-[10px] uppercase font-bold px-2.5 py-0.5",
                        f.severity === "high" ? "bg-rose-500/10 text-rose-600 border-rose-500/20" :
                          f.severity === "medium" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                            "bg-blue-500/10 text-blue-600 border-blue-500/20"
                      )}>
                        {f.severity}
                      </Badge>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        Flagged Clause
                      </span>
                      <div className="text-xs text-foreground/90 bg-muted/60 p-3 rounded-lg border border-border/40 font-mono whitespace-pre-wrap break-words leading-relaxed">
                        "{f.clause}"
                      </div>
                    </div>

                    <div className="space-y-1 text-xs text-foreground/90 leading-relaxed">
                      <strong className="text-muted-foreground font-semibold">Audit Details:</strong> {f.details}
                    </div>

                    <div className="border-t border-dashed border-border/80 pt-3 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5" /> Suggested Remediation Clause
                      </span>
                      <div className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-500/5 dark:bg-emerald-500/[0.02] p-3 rounded-lg border border-emerald-500/15 font-medium whitespace-pre-wrap leading-relaxed">
                        "{f.suggestedRewrite}"
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-border pt-4 gap-2">
            {selectedDoc && (
              <Button variant="outline" className="rounded-xl text-xs font-semibold" onClick={() => exportPDF(selectedDoc)}>
                <Download className="mr-2 h-3.5 w-3.5" /> Export PDF Report
              </Button>
            )}
            <Button variant="outline" className="rounded-xl text-xs font-semibold" onClick={() => setDetailOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Compare Dialog */}
      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle>Document Comparison</DialogTitle>
            <DialogDescription>Side-by-side comparison of audit findings.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            {compareSelection.map((doc, colIdx) => (
              <div key={doc.id} className="space-y-3">
                <div className="rounded-xl border p-3 bg-accent/30">
                  <p className="text-sm font-semibold truncate">{doc.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className={cn("rounded-full text-[10px]", (doc.riskScore ?? 100) < 50 ? "bg-rose-500/10 text-rose-600" : (doc.riskScore ?? 100) < 80 ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600")}>
                      Score: {doc.riskScore ?? "N/A"}/100
                    </Badge>
                    <span className="text-xs text-muted-foreground">{doc.findings?.length || 0} findings</span>
                  </div>
                </div>
                {doc.findings?.map((f: any, idx: number) => (
                  <div key={idx} className="rounded-lg border p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{f.findingType}</span>
                      <Badge variant="outline" className={cn("text-[10px] rounded-full", f.severity === "high" ? "text-rose-600" : f.severity === "medium" ? "text-amber-600" : "text-blue-600")}>{f.severity}</Badge>
                    </div>
                    <p className="text-muted-foreground">{f.details}</p>
                  </div>
                )) || <p className="text-xs text-muted-foreground text-center py-4">No findings.</p>}
              </div>
            ))}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCompareOpen(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}