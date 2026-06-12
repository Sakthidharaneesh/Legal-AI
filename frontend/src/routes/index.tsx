import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, Sparkles, User, ChevronDown, ChevronRight, Plus, Trash, Globe, Paperclip, X, FileText, BookOpen, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

export const Route = createFileRoute("/")(
  {
  head: () => ({
    meta: [
      { title: "Chat Assistant — Legal AI" },
      { name: "description", content: "Chat with your agentic AI legal assistant." },
    ],
  }),
  component: Index,
});

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoningChain?: any[];
  sources?: any[];
  images?: string[];
  attachedDocs?: any[];
};

type Session = { id: string; title: string; updatedAt: string };

const SUGGESTIONS = [
  "Summarize this NDA in plain English",
  "Identify risky clauses in my contract",
  "Draft a GDPR-compliant privacy policy",
  "What are the key obligations in MSA Section 4?",
];

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ta", label: "தமிழ் (Tamil)" },
  { code: "hi", label: "हिन्दी (Hindi)" },
];

function Index() {
  const API_BASE = typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:8080" : "";

  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Hi, I'm your Legal AI assistant. I can review contracts, flag risks, and answer compliance questions. What would you like to work on today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [showSessions, setShowSessions] = useState(false);
  const [expandedChains, setExpandedChains] = useState<Set<string>>(new Set());
  const [language, setLanguage] = useState("en");
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [useKB, setUseKB] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [attachedDocs, setAttachedDocs] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setSelectedImages(prev => [...prev, event.target.result as string]);
          }
        };
        reader.readAsDataURL(file);
      } else {
        setIsUploading(true);
        const toastId = toast.loading(`Uploading and auditing ${file.name}...`);
        try {
          const formData = new FormData();
          formData.append("contractFile", file);
          formData.append("title", file.name.replace(/\.[^/.]+$/, ""));

          const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: formData });
          if (!res.ok) throw new Error("Upload failed");

          const d = await res.json();
          setAttachedDocs(prev => [...prev, {
            id: d._id,
            name: d.title || d.filename,
            size: `${(file.size / 1024).toFixed(0)} KB`,
            riskScore: d.riskScore,
          }]);
          toast.success(`Document "${file.name}" uploaded and indexed!`, { id: toastId });
        } catch (err) {
          console.error(err);
          toast.error(`Failed to upload ${file.name}`, { id: toastId });
        } finally {
          setIsUploading(false);
        }
      }
    }
    if (mediaInputRef.current) mediaInputRef.current.value = "";
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing, streamText]);

  // Load chat sessions
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
        const res = await fetch(`${API_BASE}/api/chat/sessions`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setSessions(data.map((s: any) => ({ id: s._id, title: s.sessionTitle || s.title || `Session ${s._id.slice(-4)}`, updatedAt: s.updatedAt })));
        }
      } catch (err) { console.error("Failed to load sessions:", err); }
    };
    loadSessions();
  }, []);

  // Load history for active session
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
        const url = activeSession ? `${API_BASE}/api/chat/sessions/${activeSession}` : `${API_BASE}/history`;
        const res = await fetch(url, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const msgs = activeSession ? data.messages : data;
          if (msgs && msgs.length > 0) {
            setMessages(msgs.map((m: any) => ({
              id: m._id || crypto.randomUUID(),
              role: m.sender === "user" ? "user" : "assistant",
              content: m.text,
              sources: m.sources,
              images: m.images || [],
              attachedDocs: m.attachedDocs || [],
            })));
          } else {
            setMessages([{
              id: "1", role: "assistant",
              content: "Hi, I'm your Legal AI assistant. I can review contracts, flag risks, and answer compliance questions. What would you like to work on today?",
            }]);
          }
        }
      } catch (err) { console.error("Failed to load history:", err); }
    };
    loadHistory();
  }, [activeSession]);

  const toggleChain = (msgId: string) => {
    setExpandedChains(prev => {
      const next = new Set(prev);
      next.has(msgId) ? next.delete(msgId) : next.add(msgId);
      return next;
    });
  };

  const createSession = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      const res = await fetch(`${API_BASE}/api/chat/sessions`, { 
        method: "POST", 
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, 
        body: JSON.stringify({ title: "New Chat" }) 
      });
      if (res.ok) {
        const s = await res.json();
        setSessions(prev => [{ id: s._id, title: s.sessionTitle || s.title, updatedAt: s.updatedAt }, ...prev]);
        setActiveSession(s._id);
      }
    } catch (err) { console.error(err); }
  };

  const deleteSession = async (id: string) => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      await fetch(`${API_BASE}/api/chat/sessions/${id}`, { 
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      setSessions(prev => prev.filter(s => s.id !== id));
      if (activeSession === id) setActiveSession(null);
    } catch (err) { console.error(err); }
  };

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content && selectedImages.length === 0 && attachedDocs.length === 0) return;

    let promptWithAttachments = content;
    if (attachedDocs.length > 0) {
      const docReferences = attachedDocs.map(d => `[Document Attached: "${d.name}" (ID: ${d.id}, Risk Score: ${d.riskScore}/100)]`).join("\n");
      promptWithAttachments = `${docReferences}\n\n${content}`;
    }

    const userMsg: Msg = { 
      id: crypto.randomUUID(), 
      role: "user", 
      content: content || (selectedImages.length > 0 ? "Uploaded image attachment" : "Uploaded document attachment"),
      images: selectedImages,
      attachedDocs: attachedDocs
    };
    
    setMessages(m => [...m, userMsg]);
    setInput("");
    setTyping(true);
    setStreamText("");

    const imagesToSend = [...selectedImages];
    const docsToSend = [...attachedDocs];
    setSelectedImages([]);
    setAttachedDocs([]);

    try {
      // Use streaming endpoint
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      const res = await fetch(`${API_BASE}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ 
          text: promptWithAttachments, 
          language,
          images: imagesToSend,
          sessionId: activeSession,
          attachedDocs: docsToSend,
          useKnowledgeBase: useKB
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Server returned ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let reasoning: any[] = [];
      let sources: any[] = [];
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "reasoning") {
              reasoning.push(event.step);
            } else if (event.type === "token") {
              fullText += event.text;
              setStreamText(fullText);
            } else if (event.type === "done") {
              sources = event.sources || [];
            } else if (event.type === "error") {
              fullText += `\n\n⚠️ Error: ${event.message}`;
            }
          } catch { /* skip malformed */ }
        }
      }

      setMessages(m => [...m, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: fullText || "No response generated.",
        reasoningChain: reasoning,
        sources,
      }]);
    } catch (err) {
      console.error("Chat Error:", err);
      // Fallback to non-streaming
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
        const res = await fetch(`${API_BASE}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ 
            text: promptWithAttachments, 
            language,
            images: imagesToSend,
            sessionId: activeSession,
            attachedDocs: docsToSend
          }),
        });
        const data = await res.json();
        setMessages(m => [...m, {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.answer || data.newMessage?.text || "No response generated.",
          reasoningChain: data.reasoningChain,
          sources: data.sources || data.newMessage?.sources || [],
        }]);
      } catch {
        setMessages(m => [...m, {
          id: crypto.randomUUID(), role: "assistant",
          content: "⚠️ Sorry, I encountered an error connecting to the Legal AI backend.",
        }]);
      }
    } finally {
      setTyping(false);
      setStreamText("");
    }
  };

  const handleSendEmail = async (msgId: string) => {
    const sessionToUse = activeSession || "000000000000000000000001"; // fallback if no active session
    const toastId = toast.loading("Sending analysis summary to your email...");
    try {
      const res = await fetch(`${API_BASE}/api/chat/sessions/${sessionToUse}/send-summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token") || ""}` // include auth token if logged in
        },
        body: JSON.stringify({ messageId: msgId }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.url) {
          toast.success(
            <span className="text-xs">
              Email sent! View test inbox:{" "}
              <a href={data.url} target="_blank" rel="noreferrer" className="underline font-bold text-primary">
                Ethereal Inbox
              </a>
            </span>,
            { id: toastId, duration: 10000 }
          );
        } else {
          toast.success("Summary email sent successfully!", { id: toastId });
        }
      } else {
        throw new Error(data.error || "Failed to send email");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to send email. Check SMTP settings.", { id: toastId });
    }
  };

  return (
    <AppShell title="Chat Assistant" subtitle="Ask anything about your contracts and compliance">
      <div className="flex h-[calc(100vh-3.5rem)]">
        {/* Sessions Sidebar */}
        <div className={cn("border-r border-border bg-card/50 transition-all duration-200 flex flex-col", showSessions ? "w-64" : "w-0 overflow-hidden")}>
          <div className="p-3 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chat History</span>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={createSession}><Plus className="h-3.5 w-3.5" /></Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <button
              onClick={() => setActiveSession(null)}
              className={cn("w-full text-left rounded-lg px-3 py-2 text-xs transition hover:bg-accent", !activeSession && "bg-accent font-medium")}
            >Default Session</button>
            {sessions.map(s => (
              <div key={s.id} className={cn("group flex items-center rounded-lg px-3 py-2 text-xs transition hover:bg-accent", activeSession === s.id && "bg-accent font-medium")}>
                <button onClick={() => setActiveSession(s.id)} className="flex-1 text-left truncate">{s.title}</button>
                <button onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }} className="opacity-0 group-hover:opacity-100 ml-1 text-muted-foreground hover:text-destructive">
                  <Trash className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Main Chat */}
        <div className="flex flex-1 flex-col">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-background/50">
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowSessions(!showSessions)}>
              {showSessions ? "◀" : "▶"} Sessions
            </Button>
            <div className="flex-1" />
            {/* KB Toggle */}
            <Button variant={useKB ? "default" : "outline"} size="sm" className="text-xs gap-1.5 rounded-lg transition-all" onClick={() => setUseKB(!useKB)}>
              <BookOpen className="h-3.5 w-3.5" />
              {useKB ? "KB Analysis: ON" : "KB Analysis: OFF"}
            </Button>

            {/* Language Selector */}
            <div className="relative">
              <Button variant="outline" size="sm" className="text-xs gap-1.5 rounded-lg" onClick={() => setShowLangMenu(!showLangMenu)}>
                <Globe className="h-3.5 w-3.5" />
                {LANGUAGES.find(l => l.code === language)?.label || "English"}
              </Button>
              {showLangMenu && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[140px]">
                  {LANGUAGES.map(l => (
                    <button key={l.code} onClick={() => { setLanguage(l.code); setShowLangMenu(false); }}
                      className={cn("w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition", language === l.code && "font-semibold bg-accent")}>
                      {l.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
              <div className="flex flex-col gap-6">
                {messages.map(m => (
                  <div key={m.id}>
                    <div className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className={cn("text-xs", m.role === "assistant" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
                          {m.role === "assistant" ? <Sparkles className="h-4 w-4" /> : <User className="h-4 w-4" />}
                        </AvatarFallback>
                      </Avatar>
                      <div className={cn("max-w-[80%] flex flex-col gap-2")}>
                        <div className={cn("rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm", m.role === "assistant" ? "bg-card text-card-foreground border border-border" : "bg-primary text-primary-foreground")}>
                          {m.role === "assistant" ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                            </div>
                          ) : m.content}
                        </div>
                        {/* Attachments inside user message */}
                        {m.role === "user" && ((m.images && m.images.length > 0) || (m.attachedDocs && m.attachedDocs.length > 0)) && (
                          <div className="flex flex-wrap gap-2 justify-end">
                            {m.images?.map((img, idx) => (
                              <div key={idx} className="h-16 w-16 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center shadow-sm animate-in fade-in zoom-in-95 duration-200">
                                <img src={img} alt="attached" className="h-full w-full object-cover" />
                              </div>
                            ))}
                            {m.attachedDocs?.map((doc, idx) => (
                              <Badge key={idx} variant="outline" className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs bg-card text-card-foreground border-border animate-in fade-in zoom-in-95 duration-200">
                                <FileText className="h-3 w-3 text-muted-foreground" />
                                <span className="max-w-[120px] truncate">{doc.name}</span>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Agent Reasoning Chain */}
                    {m.role === "assistant" && m.reasoningChain && m.reasoningChain.length > 0 && (
                      <div className="ml-11 mt-2">
                        <button onClick={() => toggleChain(m.id)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition">
                          {expandedChains.has(m.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          <Sparkles className="h-3 w-3" /> Agent Reasoning Chain ({m.reasoningChain.length} steps)
                        </button>
                        {expandedChains.has(m.id) && (
                          <div className="mt-2 space-y-1.5 border-l-2 border-primary/20 pl-3">
                            {m.reasoningChain.map((step: any, idx: number) => (
                              <div key={idx} className="text-xs">
                                <span className={cn("inline-block rounded px-1.5 py-0.5 font-mono font-medium mr-1.5",
                                  step.type === "thought" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" :
                                  step.type === "tool_call" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                                  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                )}>
                                  {step.type === "thought" ? "🧠" : step.type === "tool_call" ? "🛠️" : "👀"} {step.name}
                                </span>
                                <span className="text-muted-foreground">{step.text}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Sources */}
                    {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                      <div className="ml-11 mt-2 flex flex-wrap gap-1.5">
                        {m.sources.map((s: any, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-[10px] rounded-full">
                            📚 {s.documentTitle || s.title || `Source ${idx + 1}`} ({((s.score || 0) * 100).toFixed(0)}%)
                          </Badge>
                        ))}
                      </div>
                    )}
                    {/* Action buttons (e.g. Email Summary) */}
                    {m.role === "assistant" && m.id !== "1" && (
                      <div className="ml-11 mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px] gap-1 rounded-full text-muted-foreground hover:text-foreground"
                          onClick={() => handleSendEmail(m.id)}
                        >
                          <Mail className="h-3 w-3" />
                          Email Summary
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                {/* Streaming indicator */}
                {typing && (
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-primary text-primary-foreground"><Sparkles className="h-4 w-4" /></AvatarFallback>
                    </Avatar>
                    {streamText ? (
                      <div className="max-w-[80%] rounded-2xl border border-border bg-card px-4 py-3 shadow-sm text-sm">
                        <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamText}</ReactMarkdown>
                        </div>
                        <span className="inline-block h-4 w-1 animate-pulse bg-primary rounded-full ml-0.5" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Input area */}
          <div className="border-t border-border bg-background/80 backdrop-blur-md">
            <div className="mx-auto max-w-3xl px-4 py-4 md:px-6">
              {messages.length <= 1 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => send(s)}
                      className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:bg-accent hover:text-foreground">
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <div className="relative flex flex-col gap-2 rounded-2xl border border-border bg-card p-2 shadow-md focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-ring/20">
                {/* Attachments Preview */}
                {(selectedImages.length > 0 || attachedDocs.length > 0 || isUploading) && (
                  <div className="flex flex-wrap gap-2 px-2 pt-2 border-b border-border/50 pb-2">
                    {selectedImages.map((img, idx) => (
                      <div key={idx} className="relative group h-14 w-14 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center animate-in fade-in zoom-in-95 duration-200">
                        <img src={img} alt="attachment" className="h-full w-full object-cover" />
                        <button onClick={() => setSelectedImages(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {attachedDocs.map((doc, idx) => (
                      <Badge key={idx} variant="secondary" className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs animate-in fade-in zoom-in-95 duration-200">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="max-w-[120px] truncate">{doc.name}</span>
                        {doc.riskScore !== undefined && (
                          <span className={cn("text-[10px] font-semibold", doc.riskScore < 50 ? "text-rose-500" : doc.riskScore < 80 ? "text-amber-500" : "text-emerald-500")}>
                            ({doc.riskScore}/100)
                          </span>
                        )}
                        <button onClick={() => setAttachedDocs(prev => prev.filter((_, i) => i !== idx))} className="ml-1 hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    {isUploading && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse px-2 py-1">
                        <span className="h-2 w-2 rounded-full bg-primary animate-ping" />
                        Analyzing document...
                      </div>
                    )}
                  </div>
                )}
                
                {/* Input Controls */}
                <div className="flex items-end gap-2">
                  <input type="file" ref={mediaInputRef} onChange={handleFileSelect} className="hidden" multiple accept="image/*,.pdf,.txt,.docx,.doc" />
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-xl text-muted-foreground hover:text-foreground" onClick={() => mediaInputRef.current?.click()} disabled={isUploading || typing}>
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  
                  <Textarea value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder="Ask about your contracts, compliance, or draft new clauses…" rows={1}
                    className="min-h-[40px] flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0" />
                  
                  <Button onClick={() => send()} size="icon" className="h-9 w-9 shrink-0 rounded-xl" disabled={(!input.trim() && selectedImages.length === 0 && attachedDocs.length === 0) || typing || isUploading}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Legal AI may produce inaccurate info. Verify important details.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
