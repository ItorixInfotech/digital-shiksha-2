import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, Loader2, MessageSquareText, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiGet, apiStream, ApiError } from "@/lib/api";
import type { ChatEvent, ChatHistory, ChatIn, ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

const SESSION_KEY = "ds_chat_session_v1"; // random chat id only (no personal data)
const sessionId = () => {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(SESSION_KEY, id); }
  return id;
};
const SUGGESTIONS = ["Best engineering colleges in Pune?", "What is the MHT CET CAP process?", "Which MBA entrance exams should I take?"];

/** Renders /relative links in the assistant's answer as in-app links; everything else as plain text. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\/(?:colleges|courses|exams|news|predictor|compare|consultation)(?:\/[a-z0-9-]+)?)/g);
  return <>{parts.map((p, i) => (i % 2 ? <Link key={`${i}-${p}`} to={p} className="font-medium text-brand-blue underline underline-offset-2">{p}</Link> : <span key={`${i}-t`}>{p}</span>))}</>;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || loaded) return;
    apiGet<ChatHistory>(`/chat/${sessionId()}`).then((h) => setMsgs(h.messages)).catch(() => undefined).finally(() => setLoaded(true));
  }, [open, loaded]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, open]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setInput(""); setError(""); setBusy(true);
    setMsgs((m) => [...m, { role: "user", content: message }, { role: "assistant", content: "" }]);
    const append = (d: string) => setMsgs((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", content: c[c.length - 1].content + d }; return c; });
    try {
      await apiStream<ChatEvent>("/chat/stream", { session_id: sessionId(), message } satisfies ChatIn, (e) => {
        if ("delta" in e) append(e.delta);
        else if ("error" in e) setError(e.error);
      });
    } catch (e) {
      const d = e instanceof ApiError ? (e.body as { detail?: unknown } | null)?.detail : undefined;
      setError(typeof d === "string" ? d : "Couldn't reach the assistant — please try again");
    } finally {
      setMsgs((m) => (m.length && m[m.length - 1].role === "assistant" && !m[m.length - 1].content ? m.slice(0, -1) : m));
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen((o) => !o)} data-testid="chat-widget-toggle" aria-label="Chat with Shiksha Assistant"
        className="fixed bottom-5 left-5 z-40 flex items-center gap-2 rounded-full bg-brand-navy px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-slate-900/25 transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-brand-blue active:scale-95">
        {open ? <X className="size-4" /> : <MessageSquareText className="size-4" />} <span className="hidden sm:inline">{open ? "Close" : "Ask AI counsellor"}</span>
      </button>
      {open && (
        <section className="fixed bottom-20 left-3 right-3 z-40 flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-white/40 bg-white/95 shadow-2xl backdrop-blur-xl animate-fade-up sm:left-5 sm:right-auto sm:w-[380px]" data-testid="chat-widget-panel">
          <header className="flex items-center gap-3 bg-brand-navy px-4 py-3 text-white">
            <span className="grid size-9 place-items-center rounded-full bg-white/10"><Bot className="size-5 text-green-300" /></span>
            <div className="min-w-0"><p className="text-sm font-semibold">Shiksha Assistant</p><p className="text-[11px] text-slate-300">AI answers on colleges, courses & exams</p></div>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm" data-testid="chat-widget-messages">
            {!msgs.length && (
              <div className="space-y-2">
                <p className="text-slate-600">Hi! Ask me anything about admissions in India.</p>
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => void send(s)} className="block w-full rounded-xl border bg-slate-50 px-3 py-2 text-left text-slate-700 transition-colors hover:border-brand-leaf hover:bg-green-50" data-testid={`chat-suggestion-${s.slice(0, 12).toLowerCase().replace(/[^a-z]+/g, "-")}`}>{s}</button>
                ))}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={`${i}-${m.role}`} className={cn("max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 leading-relaxed", m.role === "user" ? "ml-auto bg-brand-navy text-white" : "bg-slate-100 text-slate-800")} data-testid={`chat-message-${m.role}`}>
                {m.content ? (m.role === "assistant" ? <Rich text={m.content} /> : m.content) : <Loader2 className="size-4 animate-spin text-slate-400" />}
              </div>
            ))}
            {error && <p className="rounded-lg bg-red-50 p-2 text-xs text-red-700" data-testid="chat-widget-error">{error}</p>}
            <div ref={endRef} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="flex items-center gap-2 border-t p-3">
            <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={800} placeholder="Type your question…" data-testid="chat-widget-input"
              className="h-10 flex-1 rounded-full border border-slate-200 bg-white px-4 text-sm outline-none transition-shadow focus:ring-2 focus:ring-brand-leaf/40" />
            <Button type="submit" size="icon" disabled={busy || !input.trim()} className="size-10 rounded-full bg-brand-leaf text-white hover:bg-brand-leaf/90" data-testid="chat-widget-send-button">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </form>
          <p className="px-4 pb-2 text-[10px] text-slate-400">AI can make mistakes. For confirmed details call +91 8149 68 9468.</p>
        </section>
      )}
    </>
  );
}
