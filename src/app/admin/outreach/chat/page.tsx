"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const STARTER_QUESTIONS = [
  "Who hasn't heard from us in over 2 weeks?",
  "Show me everyone in the deepening stage",
  "What's been working best this month?",
  "Who are our most engaged contacts?",
  "Which team members have been most active?",
  "Draft an outreach plan for the coming week",
];

export default function OutreachChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I have full access to your outreach data. Ask me anything — who needs follow-up, what's working, how the team is doing, or any questions about specific contacts.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text?: string) {
    const message = (text || input).trim();
    if (!message || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setLoading(true);

    try {
      const res  = await fetch("/api/admin/outreach/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, {
        role:    "assistant",
        content: data.answer || "Sorry, I couldn't get a response.",
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        role:    "assistant",
        content: "Something went wrong. Please try again.",
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] max-w-3xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Outreach Assistant</h1>
        <p className="text-gray-500 mt-1 text-sm">Ask anything about your contacts, team, or strategy.</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="shrink-0 w-8 h-8 rounded-full bg-[#EF8046] flex items-center justify-center mt-1">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-[#EF8046] text-white rounded-br-sm"
                  : "bg-white border border-gray-100 shadow-sm text-gray-800 rounded-bl-sm"
              }`}
            >
              {m.content}
            </div>
            {m.role === "user" && (
              <div className="shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center mt-1">
                <User className="w-4 h-4 text-gray-600" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="shrink-0 w-8 h-8 rounded-full bg-[#EF8046] flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-bl-sm px-4 py-3">
              <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
            </div>
          </div>
        )}

        {/* Starter questions — only show at the start */}
        {messages.length === 1 && !loading && (
          <div className="flex flex-wrap gap-2 pt-2">
            {STARTER_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:border-[#EF8046] hover:text-[#EF8046] transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm flex items-end gap-3 px-4 py-3">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about contacts, follow-ups, what's working..."
          rows={1}
          className="flex-1 resize-none text-sm outline-none bg-transparent text-gray-800 placeholder-gray-400 max-h-32"
          style={{ lineHeight: "1.5" }}
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || loading}
          className="shrink-0 w-8 h-8 rounded-full bg-[#EF8046] flex items-center justify-center hover:bg-[#d96a2f] transition-colors disabled:opacity-40"
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>
      <p className="text-xs text-gray-400 text-center mt-2">Press Enter to send · Shift+Enter for new line</p>
    </div>
  );
}
