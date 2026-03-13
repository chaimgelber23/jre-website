"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquare, X, Send, Bot, User, Loader2, Minus, GripHorizontal } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const STARTERS = [
  "Who needs follow-up this week?",
  "Who are our most engaged contacts?",
  "Show everyone in deepening stage",
  "Which team members are most active?",
];

export default function OutreachFloatingChat() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! Ask me anything about your contacts, follow-ups, or outreach strategy." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Dragging state
  const [pos, setPos] = useState({ x: 0, y: 0 }); // offset from bottom-right anchor
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open && !minimized) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open, minimized]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
  }, [pos]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      if (!dragStart.current) return;
      const dx = e.clientX - dragStart.current.mx;
      const dy = e.clientY - dragStart.current.my;
      setPos({ x: dragStart.current.px - dx, y: dragStart.current.py - dy });
    };
    const onUp = () => { setDragging(false); dragStart.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging]);

  async function send(text?: string) {
    const message = (text || input).trim();
    if (!message || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: message }]);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/outreach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.answer || "Sorry, couldn't get a response." }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  // FAB button when closed
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#EF8046] text-white shadow-lg hover:bg-[#d96a2f] transition-all hover:scale-105 flex items-center justify-center"
        title="Ask Claude"
      >
        <MessageSquare className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div
      ref={chatRef}
      className="fixed z-50 select-none"
      style={{
        bottom: `${Math.max(16, pos.y + 24)}px`,
        right: `${Math.max(16, pos.x + 24)}px`,
        width: minimized ? "280px" : "380px",
        cursor: dragging ? "grabbing" : "default",
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col" style={{ maxHeight: minimized ? "auto" : "520px" }}>
        {/* Header — drag handle */}
        <div
          onMouseDown={onMouseDown}
          className="flex items-center gap-2 px-4 py-3 bg-[#EF8046] cursor-grab active:cursor-grabbing"
        >
          <GripHorizontal className="w-4 h-4 text-white/60 shrink-0" />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Bot className="w-4 h-4 text-white shrink-0" />
            <span className="text-sm font-semibold text-white truncate">Ask Claude</span>
          </div>
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={() => setMinimized(m => !m)}
            className="text-white/70 hover:text-white transition-colors p-0.5"
            title={minimized ? "Expand" : "Minimize"}
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={() => setOpen(false)}
            className="text-white/70 hover:text-white transition-colors p-0.5"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!minimized && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ minHeight: "200px", maxHeight: "340px" }}>
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "assistant" && (
                    <div className="shrink-0 w-6 h-6 rounded-full bg-[#EF8046] flex items-center justify-center mt-0.5">
                      <Bot className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-[#EF8046] text-white rounded-br-sm"
                      : "bg-gray-50 border border-gray-100 text-gray-800 rounded-bl-sm"
                  }`}>
                    {m.content}
                  </div>
                  {m.role === "user" && (
                    <div className="shrink-0 w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center mt-0.5">
                      <User className="w-3 h-3 text-gray-600" />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-2">
                  <div className="shrink-0 w-6 h-6 rounded-full bg-[#EF8046] flex items-center justify-center">
                    <Bot className="w-3 h-3 text-white" />
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-xl rounded-bl-sm px-3 py-2">
                    <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />
                  </div>
                </div>
              )}

              {messages.length === 1 && !loading && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {STARTERS.map(q => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:border-[#EF8046] hover:text-[#EF8046] transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-gray-100 px-3 py-2 flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything..."
                rows={1}
                className="flex-1 resize-none text-sm outline-none bg-transparent text-gray-800 placeholder-gray-400 max-h-20"
                style={{ lineHeight: "1.5" }}
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                className="shrink-0 w-7 h-7 rounded-full bg-[#EF8046] flex items-center justify-center hover:bg-[#d96a2f] transition-colors disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
