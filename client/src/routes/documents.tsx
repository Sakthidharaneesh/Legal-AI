import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, FileText, Trash, CloudUpload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/documents")({
  head: () => ({
    meta: [
      { title: "Documents — Legal AI" },
      { name: "description", content: "Upload and manage legal documents." },
    ],
  }),
  component: DocumentsPage,
});

type Doc = {
  id: string;
  name: string;
  size: string;
  type: string;
  status: "Analyzed" | "Processing" | "Needs review";
  uploaded: string;
  riskScore?: number;
  findings?: Array<{
    id: string;
    clause: string;
    severity: "high" | "medium" | "low";
    findingType: string;
    details: string;
    suggestedRewrite: string;
  }>;
};

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
  const inputRef = useRef<HTMLInputElement>(null);

  const API_BASE = typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:8080" : "";

  // Load documents
  const loadDocs = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/documents`);
      if (res.ok) {
        const data = await res.json();
        const mapped = data.map((d: any) => ({
          id: d._id,
          name: d.title || d.filename,
          size: d.extractedText ? `${(d.extractedText.length / 1024).toFixed(1)} KB` : "150 KB",
          type: d.fileType ? d.fileType.toUpperCase() : "PDF",
          status: d.riskScore < 70 ? "Needs review" : "Analyzed",
          uploaded: new Date(d.createdAt).toLocaleDateString(),
          riskScore: d.riskScore,
          findings: d.findings || []
        }));
        setDocs(mapped);
      }
    } catch (err) {
      console.error("Failed to load documents:", err);
    }
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const toastId = toast.loading(`Uploading and auditing ${files.length} document(s)...`);
    setOpen(false);

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("contractFile", file);
        formData.append("title", file.name.replace(/\.[^/.]+$/, ""));
        
        const res = await fetch(`${API_BASE}/upload`, {
          method: "POST",
          body: formData,
        });
        
        if (!res.ok) {
          throw new Error(`Upload failed with status ${res.status}`);
        }
        
        const uploadedDoc = await res.json();
        
        // Map to Doc structure
        const nextDoc: Doc = {
          id: uploadedDoc._id,
          name: uploadedDoc.title || uploadedDoc.filename,
          size: `${(file.size / 1024).toFixed(0)} KB`,
          type: uploadedDoc.fileType ? uploadedDoc.fileType.toUpperCase() : "PDF",
          status: uploadedDoc.riskScore < 70 ? "Needs review" : "Analyzed",
          uploaded: "Just now",
          riskScore: uploadedDoc.riskScore,
          findings: uploadedDoc.findings || []
        };
        
        setDocs((d) => [nextDoc, ...d]);
      }
      toast.success(`${files.length} document(s) uploaded and analyzed successfully!`, { id: toastId });
    } catch (err) {
      console.error("Upload Error:", err);
      toast.error("Failed to upload and analyze document. Please check backend connection.", { id: toastId });
    }
  };

  return (
    <AppShell title="Documents" subtitle="Upload, analyze, and manage your legal documents">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Document Library</h2>
            <p className="text-sm text-muted-foreground">{docs.length} documents in your workspace</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl shadow-sm">
                <Upload className="mr-2 h-4 w-4" /> Upload
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Upload documents</DialogTitle>
                <DialogDescription>PDF, DOCX, or TXT up to 25 MB each.</DialogDescription>
              </DialogHeader>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => dragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleFiles(e.dataTransfer.files);
                }}
                onClick={() => inputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition ${
                  dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-accent/40"
                }`}
              >
                <CloudUpload className="h-10 w-10 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">Drop files here or click to browse</p>
                <p className="mt-1 text-xs text-muted-foreground">Max file size 25 MB</p>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => inputRef.current?.click()}>Choose files</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {docs.slice(0, 4).map((d) => (
            <Card 
              key={d.id} 
              className="rounded-xl p-4 shadow-sm transition hover:shadow-md cursor-pointer"
              onClick={() => {
                setSelectedDoc(d);
                setDetailOpen(true);
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <Badge variant="outline" className={`rounded-full text-xs ${statusVariant[d.status]}`}>
                  {d.status}
                </Badge>
              </div>
              <p className="mt-3 truncate text-sm font-medium" title={d.name}>{d.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{d.size} · {d.uploaded}</p>
              {d.riskScore !== undefined && (
                <div className="mt-2 text-xs font-semibold text-muted-foreground flex items-center justify-between">
                  <span>Risk Score:</span>
                  <span className={cn(
                    d.riskScore < 50 ? "text-rose-500" :
                    d.riskScore < 80 ? "text-amber-500" :
                    "text-emerald-500"
                  )}>{d.riskScore}/100</span>
                </div>
              )}
            </Card>
          ))}
        </div>

        <Card className="rounded-xl shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead className="hidden md:table-cell">Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Uploaded</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((d) => (
                <TableRow 
                  key={d.id} 
                  className="hover:bg-accent/40 cursor-pointer"
                  onClick={() => {
                    setSelectedDoc(d);
                    setDetailOpen(true);
                  }}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{d.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{d.type}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{d.size}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`rounded-full text-xs ${statusVariant[d.status]}`}>
                      {d.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{d.uploaded}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 rounded-lg"
                      onClick={async () => {
                        if (confirm(`Are you sure you want to delete "${d.name}"?`)) {
                          try {
                            const res = await fetch(`${API_BASE}/api/documents/${d.id}`, {
                              method: "DELETE"
                            });
                            if (res.ok) {
                              setDocs((prev) => prev.filter((doc) => doc.id !== d.id));
                              toast.success("Document deleted successfully");
                            } else {
                              toast.error("Failed to delete document");
                            }
                          } catch (err) {
                            console.error(err);
                            toast.error("Error deleting document");
                          }
                        }
                      }}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Audit Findings Details Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-4">
              <span className="truncate pr-4 text-base font-semibold">{selectedDoc?.name}</span>
              <Badge className={cn(
                "rounded-full text-xs py-1 px-3 shrink-0",
                (selectedDoc?.riskScore ?? 100) < 50 ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20" :
                (selectedDoc?.riskScore ?? 100) < 80 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" :
                "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              )}>
                Score: {selectedDoc?.riskScore ?? 100}/100
              </Badge>
            </DialogTitle>
            <DialogDescription>
              Risk Analysis & Regulatory Audit Findings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 my-2">
            {!selectedDoc?.findings || selectedDoc.findings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">✅ No risks or compliance issues identified in this contract.</p>
            ) : (
              selectedDoc.findings.map((f: any, idx: number) => (
                <div key={idx} className="rounded-xl border border-border bg-card p-4 space-y-2 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold tracking-tight">{f.findingType}</span>
                    <Badge variant="outline" className={cn(
                      "rounded-full text-[10px] uppercase font-bold px-2 py-0.5",
                      f.severity === "high" ? "bg-rose-500/10 text-rose-600 border-rose-500/20" :
                      f.severity === "medium" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                      "bg-blue-500/10 text-blue-600 border-blue-500/20"
                    )}>
                      {f.severity}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground bg-accent/40 p-2.5 rounded-lg font-mono whitespace-pre-wrap break-words leading-relaxed">
                    <strong>Flagged Clause:</strong><br />
                    "{f.clause}"
                  </div>
                  <div className="text-xs text-foreground/90 leading-normal">
                    <strong>Details:</strong> {f.details}
                  </div>
                  <div className="text-xs border-t border-dashed border-border pt-2 text-emerald-600 dark:text-emerald-400 font-medium whitespace-pre-wrap leading-relaxed">
                    <strong>Suggested Rewrite:</strong><br />
                    "{f.suggestedRewrite}"
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}