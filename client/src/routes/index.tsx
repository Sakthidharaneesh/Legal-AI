import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowUp, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Chat Assistant — Legal AI" },
      { name: "description", content: "Chat with your agentic AI legal assistant." },
    ],
  }),
  component: Index,
});

type Msg = { id: string; role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Summarize this NDA in plain English",
  "Identify risky clauses in my contract",
  "Draft a GDPR-compliant privacy policy",
  "What are the key obligations in MSA Section 4?",
];

function Index() {
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
  const scrollRef = useRef<HTMLDivElement>(null);

  const API_BASE = typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:8080" : "";

  const formatAnswerWithCitations = (text: string, sources?: any[]) => {
    if (!sources || sources.length === 0) return text;
    const citationList = sources.map((s, idx) => `* [${idx + 1}] **${s.title || s.documentTitle || "Document"}** (Match: ${(s.score * 100).toFixed(0)}%) - *"${s.text.length > 120 ? s.text.substring(0, 120) + '...' : s.text}"*`).join("\n");
    return `${text}\n\n### 📚 Citations:\n${citationList}`;
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await fetch(`${API_BASE}/history`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            const mapped = data.map((m: any) => ({
              id: m._id || crypto.randomUUID(),
              role: m.sender === "user" ? "user" : "assistant",
              content: m.sender === "user" ? m.text : formatAnswerWithCitations(m.text, m.sources),
            }));
            setMessages(mapped);
          }
        }
      } catch (err) {
        console.error("Failed to load chat history:", err);
      }
    };
    loadHistory();
  }, []);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content) return;
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setTyping(true);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: content }),
      });
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const data = await res.json();
      const assistantText = data.answer || data.newMessage?.text || "No response generated.";
      const assistantSources = data.sources || data.newMessage?.sources || [];
      
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: formatAnswerWithCitations(assistantText, assistantSources),
        },
      ]);
    } catch (err) {
      console.error("Chat Error:", err);
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "⚠️ Sorry, I encountered an error connecting to the Legal AI backend. Please verify that the server is running.",
        },
      ]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <AppShell title="Chat Assistant" subtitle="Ask anything about your contracts and compliance">
      <div className="flex h-[calc(100vh-3.5rem)] flex-col">
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
            <div className="flex flex-col gap-6">
              {messages.map((m) => (
                <div key={m.id} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback
                      className={cn(
                        "text-xs",
                        m.role === "assistant"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground",
                      )}
                    >
                      {m.role === "assistant" ? <Sparkles className="h-4 w-4" /> : <User className="h-4 w-4" />}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
                      m.role === "assistant"
                        ? "bg-card text-card-foreground border border-border"
                        : "bg-primary text-primary-foreground",
                    )}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {typing && (
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Sparkles className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-border bg-background/80 backdrop-blur-md">
          <div className="mx-auto max-w-3xl px-4 py-4 md:px-6">
            {messages.length <= 1 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:bg-accent hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div className="relative flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-md focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-ring/20">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Ask about your contracts, compliance, or draft new clauses…"
                rows={1}
                className="min-h-[40px] flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0"
              />
              <Button onClick={() => send()} size="icon" className="h-9 w-9 shrink-0 rounded-xl" disabled={!input.trim()}>
                <ArrowUp className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Legal AI may produce inaccurate info. Verify important details.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
