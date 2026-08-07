"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Bot, X, Send, Minimize2, Sparkles, ChevronDown, Lock, Maximize2, Copy, Check, ExternalLink, HelpCircle, MessageSquare, TrendingUp, TrendingDown, Activity } from "lucide-react";
import api from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function getContextChips(pathname: string): string[] {
  if (pathname.startsWith("/workspace/") || pathname.match(/\/workspace\/[^/]+/)) {
    return ["Analyze this case", "Policy match details", "Draft rationale"];
  }
  if (pathname.startsWith("/audit")) {
    return ["Explain QA score", "Show findings", "Audit summary"];
  }
  if (pathname.startsWith("/analytics")) {
    return ["Team performance", "Top reviewers", "Score trends"];
  }
  if (pathname.startsWith("/cases")) {
    return ["Recent cases", "Pending reviews", "Case search"];
  }
  return ["Show QA scores", "Recent cases", "Appeal risks", "Top reviewers"];
}

const HELP_QUESTIONS = [
  "What is the average QA score?",
  "Show me all FAIL audit results",
  "Which nurse needs coaching?",
  "Which cases have high appeal risk?",
  "Show denial trends",
  "Top documentation gaps",
];

function renderBotMarkdown(text: string, isUser: boolean) {
  const lines = text.split('\n');
  const segments: { type: 'text' | 'table'; lines: string[] }[] = [];
  let currentText: string[] = [];
  let tableLines: string[] = [];
  let inTable = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const isPipeLine = trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|');
    const isSepLine = /^\|[\s\-:|]+\|$/.test(trimmed);

    if (isPipeLine || isSepLine) {
      if (!inTable) {
        if (currentText.length > 0) {
          segments.push({ type: 'text', lines: [...currentText] });
          currentText = [];
        }
        inTable = true;
      }
      tableLines.push(trimmed);
    } else {
      if (inTable) {
        segments.push({ type: 'table', lines: [...tableLines] });
        tableLines = [];
        inTable = false;
      }
      currentText.push(line);
    }
  }
  if (inTable && tableLines.length > 0) segments.push({ type: 'table', lines: [...tableLines] });
  if (currentText.length > 0) segments.push({ type: 'text', lines: [...currentText] });

  return segments.map((seg, segIdx) => {
    if (seg.type === 'table') {
      return renderTableJSX(seg.lines, segIdx);
    }
    return seg.lines.map((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
        return (
          <div key={`${segIdx}-${i}`} style={{ display: 'flex', gap: '6px', marginTop: i > 0 ? '4px' : 0 }}>
            <span style={{ color: isUser ? 'rgba(255,255,255,0.7)' : 'var(--primary)', flexShrink: 0 }}>•</span>
            <span>{renderInlineMarkdown(trimmed.slice(2))}</span>
          </div>
        );
      }
      if (trimmed === '') return <div key={`${segIdx}-${i}`} style={{ height: '6px' }} />;
      return (
        <div key={`${segIdx}-${i}`} style={{ marginTop: i > 0 && seg.lines[i - 1]?.trim() !== '' ? '4px' : 0 }}>
          {renderInlineMarkdown(line)}
        </div>
      );
    });
  });
}

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }

    // Split for Trend tokens [UP], [DOWN], [--]
    if (part.includes('[UP]') || part.includes('[DOWN]') || part.includes('[--]')) {
      const tokens = part.split(/(\[UP\]|\[DOWN\]|\[--\])/g);
      return (
        <span key={i}>
          {tokens.map((tok, j) => {
            if (tok === '[UP]') return <TrendingUp key={j} size={13} style={{ color: 'var(--success)', display: 'inline-flex', verticalAlign: 'middle', marginRight: '2px' }} />;
            if (tok === '[DOWN]') return <TrendingDown key={j} size={13} style={{ color: 'var(--danger)', display: 'inline-flex', verticalAlign: 'middle', marginRight: '2px' }} />;
            if (tok === '[--]') return <Activity key={j} size={13} style={{ color: 'var(--info, #0ea5e9)', display: 'inline-flex', verticalAlign: 'middle', marginRight: '2px' }} />;
            return tok;
          })}
        </span>
      );
    }

    // Color-code scores inline
    const scoreMatch = part.match(/(\d{1,3})(\.\d+)?%?/);
    if (scoreMatch) {
      const val = parseFloat(scoreMatch[0]);
      if (val >= 85 && val <= 100) {
        return <span key={i}>{part.replace(scoreMatch[0], '')}<span style={{ color: 'var(--success)', fontWeight: 600 }}>{scoreMatch[0]}</span></span>;
      }
      if (val >= 70 && val < 85) {
        return <span key={i}>{part.replace(scoreMatch[0], '')}<span style={{ color: 'var(--warning)', fontWeight: 600 }}>{scoreMatch[0]}</span></span>;
      }
    }
    return <span key={i}>{part}</span>;
  });
}

function renderTableJSX(rows: string[], segIdx: number) {
  if (rows.length < 2) return <span key={segIdx}>{rows.join('\n')}</span>;

  const parseRow = (row: string) => row.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1).map(c => c.trim());
  const isSep = /^[\s\-:|]+$/.test(rows[1].replace(/\|/g, ''));
  const headers = parseRow(rows[0]);
  const dataRows = rows.slice(isSep ? 2 : 1).map(parseRow);

  return (
    <div key={segIdx} style={{ overflowX: 'auto', maxWidth: '100%', margin: '8px 0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', border: '1px solid var(--border-default)', borderRadius: '6px' }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={{ padding: '7px 10px', background: 'rgba(15,14,12,0.05)', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid var(--border-default)', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 1 ? 'rgba(15,14,12,0.02)' : 'transparent' }}>
              {row.map((cell, ci) => {
                const numVal = parseFloat(cell);
                let color = 'var(--text-secondary)';
                let fw = 400;
                if (!isNaN(numVal) && cell.match(/^\d+\.?\d*%?$/)) {
                  if (numVal >= 85) { color = 'var(--success)'; fw = 600; }
                  else if (numVal >= 70) { color = 'var(--warning)'; fw = 600; }
                  else if (numVal < 70 && numVal > 0) { color = 'var(--danger)'; fw = 600; }
                }

                let cellElement: React.ReactNode = cell;
                if (cell.includes('[UP]')) {
                  cellElement = (
                    <span style={{ color: 'var(--success)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                      <TrendingUp size={12} />
                      {cell.replace('[UP]', '').trim()}
                    </span>
                  );
                } else if (cell.includes('[DOWN]')) {
                  cellElement = (
                    <span style={{ color: 'var(--danger)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                      <TrendingDown size={12} />
                      {cell.replace('[DOWN]', '').trim()}
                    </span>
                  );
                } else if (cell.includes('[--]')) {
                  cellElement = (
                    <span style={{ color: 'var(--info, #0ea5e9)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                      <Activity size={12} />
                      {cell.replace('[--]', '').trim()}
                    </span>
                  );
                }

                return <td key={ci} style={{ padding: '6px 10px', borderBottom: '1px solid var(--border-default)', color, fontWeight: fw }}>{cellElement}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function FloatingAIBot() {
  const router = useRouter();
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // Default Position (bottom right)
  const [position, setPosition] = useState({ x: -1, y: -1 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; posX: number; posY: number } | null>(null);
  const hasDraggedRef = useRef(false);
  const botRef = useRef<HTMLDivElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const contextChips = getContextChips(pathname || "");

  const windowWidth = isMaximized ? 500 : 380;
  const windowHeight = isMaximized ? 650 : 540;

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: "Hi! I'm **CareAudit AI** — your clinical audit assistant.\n\nI have live access to your cases, audit results, reviewer performance, and appeals data. How can I help you today?"
      }]);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  // ── Drag handling ──
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, a, .no-drag')) return;
    if (target.closest('button') && !target.closest('.bot-trigger')) return;

    e.preventDefault();
    hasDraggedRef.current = false;
    
    const rect = botRef.current?.getBoundingClientRect();
    if (!rect) return;

    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: position.x >= 0 ? position.x : window.innerWidth - rect.width - 24,
      posY: position.y >= 0 ? position.y : window.innerHeight - rect.height - 24
    };
    setIsDragging(true);
  }, [position]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragStartRef.current || !botRef.current) return;
      
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasDraggedRef.current = true;
      }
      
      const rect = botRef.current.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width;
      const maxY = window.innerHeight - rect.height;
      
      let newX = dragStartRef.current.posX + dx;
      let newY = dragStartRef.current.posY + dy;
      
      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));
      
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || isLoading) return;

    setShowHelp(false);
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await api.post("/chat/", { 
        message: msg,
        conversation_id: conversationId 
      });
      
      // Store conversation_id from response
      if (res.data.conversation_id && !conversationId) {
        setConversationId(res.data.conversation_id);
      }

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: res.data.message?.content || res.data.content || "I couldn't retrieve that information.",
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error("Bot chat error", err);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "⚠️ I couldn't connect to the server. Please check if the backend is running."
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (msgId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { /* ignore */ }
  };

  const isCustomPosition = position.x >= 0 && position.y >= 0;
  const positionStyle: React.CSSProperties = isCustomPosition
    ? { position: "fixed", left: position.x, top: position.y }
    : { position: "fixed", right: "24px", bottom: "24px" };

  return (
    <>
      <style>{`
        @keyframes botPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(232, 82, 26, 0.4); }
          50% { box-shadow: 0 0 0 10px rgba(232, 82, 26, 0); }
        }
        @keyframes botSlideIn {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <div
        ref={botRef}
        style={{
          ...positionStyle,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end"
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Chat Window */}
        {isOpen && (
          <div
            style={{
              width: `${windowWidth}px`,
              height: isMinimized ? "0px" : `${windowHeight}px`,
              overflow: "hidden",
              marginBottom: "12px",
              borderRadius: "20px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.1)",
              display: "flex",
              flexDirection: "column",
              animation: "botSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
              transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              cursor: isDragging ? "grabbing" : "default"
            }}
          >
            {/* Header (Draggable Area) */}
            <div
              style={{
                padding: "14px 16px",
                background: "linear-gradient(135deg, #E8521A 0%, #c44015 100%)",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                cursor: isDragging ? "grabbing" : "grab",
                userSelect: "none"
              }}
            >
              <div
                style={{
                  width: "34px", height: "34px", borderRadius: "50%",
                  background: "rgba(255,255,255,0.2)", display: "flex",
                  alignItems: "center", justifyContent: "center", flexShrink: 0
                }}
              >
                <Bot size={18} color="white" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "white", letterSpacing: "0.2px" }}>
                  CareAudit AI
                </div>
                <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.75)", display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
                  Online · Enterprise DB
                </div>
              </div>
              <div style={{ display: "flex", gap: "4px" }} className="no-drag">
                {/* Open in Chat */}
                <button
                  onClick={() => router.push("/chat")}
                  style={{
                    background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "6px", padding: "6px",
                    cursor: "pointer", color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 0.15s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.25)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.15)"}
                  title="Open in full Chat"
                >
                  <ExternalLink size={13} />
                </button>
                {/* Help */}
                <button
                  onClick={() => setShowHelp(!showHelp)}
                  style={{
                    background: showHelp ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.15)", 
                    border: "none", borderRadius: "6px", padding: "6px",
                    cursor: "pointer", color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 0.15s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.25)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = showHelp ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.15)"}
                  title="What can I ask?"
                >
                  <HelpCircle size={13} />
                </button>
                {/* Maximize/Restore */}
                <button
                  onClick={() => setIsMaximized(!isMaximized)}
                  style={{
                    background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "6px", padding: "6px",
                    cursor: "pointer", color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 0.15s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.25)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.15)"}
                  title={isMaximized ? "Restore size" : "Maximize"}
                >
                  <Maximize2 size={13} />
                </button>
                {/* Minimize */}
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  style={{
                    background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "6px", padding: "6px",
                    cursor: "pointer", color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 0.15s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.25)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.15)"}
                  title="Minimize"
                >
                  <Minimize2 size={13} />
                </button>
                {/* Close */}
                <button
                  onClick={() => setIsOpen(false)}
                  style={{
                    background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "6px", padding: "6px",
                    cursor: "pointer", color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 0.15s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.25)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.15)"}
                  title="Close"
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* Help Panel */}
            {showHelp && (
              <div className="no-drag" style={{
                padding: "12px 16px", borderBottom: "1px solid var(--border-default)",
                background: "rgba(232,82,26,0.03)"
              }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  💡 Try asking...
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                  {HELP_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => { setShowHelp(false); sendMessage(q); }}
                      style={{
                        fontSize: "0.73rem", padding: "5px 10px", borderRadius: "14px",
                        border: "1px solid var(--border-default)", background: "var(--bg-surface)",
                        color: "var(--text-secondary)", cursor: "pointer", transition: "all 0.15s"
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.color = "var(--primary)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages Area */}
            <div className="no-drag" style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column" }}>
              {messages.map((msg) => {
                const isUser = msg.role === "user";

                return (
                  <div
                    key={msg.id}
                    style={{
                      display: "flex",
                      flexDirection: isUser ? "row-reverse" : "row",
                      gap: "8px",
                      alignItems: "flex-start",
                      marginBottom: "16px"
                    }}
                  >
                    {!isUser && (
                      <div
                        style={{
                          width: "28px", height: "28px", borderRadius: "50%",
                          background: "linear-gradient(135deg, #E8521A, #ff7c47)", display: "flex",
                          alignItems: "center", justifyContent: "center", flexShrink: 0,
                          boxShadow: "0 2px 8px rgba(232,82,26,0.35)"
                        }}
                      >
                        <Bot size={14} color="white" />
                      </div>
                    )}
                    <div style={{ maxWidth: "80%", position: "relative" }}>
                      <div
                        style={{
                          padding: "10px 14px",
                          borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                          background: isUser ? "linear-gradient(135deg, #E8521A, #ff7340)" : "var(--bg-body)",
                          color: isUser ? "white" : "var(--text-primary)",
                          fontSize: "0.82rem",
                          lineHeight: 1.5,
                          border: isUser ? "none" : "1px solid var(--border-default)",
                          boxShadow: isUser ? "0 2px 12px rgba(232,82,26,0.25)" : "0 1px 4px rgba(0,0,0,0.06)"
                        }}
                      >
                        {renderBotMarkdown(msg.content, isUser)}
                      </div>
                      {/* Copy button for bot messages */}
                      {!isUser && msg.id !== "welcome" && (
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="no-drag"
                          style={{
                            position: "absolute", bottom: "-4px", right: "4px",
                            background: "var(--bg-surface)", border: "1px solid var(--border-default)",
                            borderRadius: "12px", padding: "3px 8px", cursor: "pointer",
                            display: "flex", alignItems: "center", gap: "4px",
                            fontSize: "0.68rem", color: copiedId === msg.id ? "var(--success)" : "var(--text-tertiary)",
                            transition: "all 0.15s", boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                            opacity: 0.8
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.borderColor = "var(--primary)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.8"; e.currentTarget.style.borderColor = "var(--border-default)"; }}
                          title="Copy response"
                        >
                          {copiedId === msg.id ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {isLoading && (
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginBottom: "16px" }}>
                  <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "linear-gradient(135deg, #E8521A, #ff7c47)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Bot size={14} color="white" />
                  </div>
                  <div style={{ padding: "12px 16px", borderRadius: "18px 18px 18px 4px", background: "var(--bg-body)", border: "1px solid var(--border-default)", display: "flex", gap: "4px", alignItems: "center" }}>
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        style={{
                          width: "6px", height: "6px", borderRadius: "50%", background: "var(--primary)",
                          animation: `bounce 1.2s ease-in-out ${i * 0.15}s infinite`
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Context-Aware Quick Chips */}
            {messages.length <= 2 && (
              <div className="no-drag" style={{ padding: "8px 16px", display: "flex", flexWrap: "wrap", gap: "6px", borderTop: "1px solid var(--border-default)" }}>
                {contextChips.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => sendMessage(chip)}
                    disabled={isLoading}
                    style={{
                      fontSize: "0.75rem", padding: "6px 12px", borderRadius: "20px",
                      border: "1px solid var(--border-default)", background: "var(--bg-body)",
                      color: "var(--text-secondary)", cursor: "pointer", transition: "all 0.15s",
                      whiteSpace: "nowrap"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--primary)";
                      e.currentTarget.style.color = "var(--primary)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border-default)";
                      e.currentTarget.style.color = "var(--text-secondary)";
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}

            {/* Input Area */}
            <div className="no-drag" style={{ padding: "10px 16px 14px" }}>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Ask about cases, audits, reviewers..."
                  disabled={isLoading}
                  style={{
                    flex: 1, padding: "12px 16px", borderRadius: "24px",
                    border: "1.5px solid var(--border-default)", background: "var(--bg-body)",
                    color: "var(--text-primary)", fontSize: "0.9rem", outline: "none",
                    boxShadow: "inset 0 1px 3px rgba(0,0,0,0.02)", transition: "border-color 0.2s"
                  }}
                  onFocus={(e) => e.target.style.borderColor = "var(--primary)"}
                  onBlur={(e) => e.target.style.borderColor = "var(--border-default)"}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={isLoading || !input.trim()}
                  style={{
                    width: "42px", height: "42px", borderRadius: "50%",
                    background: input.trim() && !isLoading ? "linear-gradient(135deg, #E8521A, #ff7340)" : "var(--bg-hover)",
                    border: "none", cursor: input.trim() && !isLoading ? "pointer" : "default",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    transition: "all 0.2s",
                    boxShadow: input.trim() && !isLoading ? "0 4px 10px rgba(232,82,26,0.3)" : "none"
                  }}
                >
                  <Send size={18} color={input.trim() && !isLoading ? "white" : "var(--text-tertiary)"} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Floating Trigger Button */}
        <button
          className="bot-trigger"
          onClick={(e) => { 
            if (hasDraggedRef.current) return;
            setIsOpen(!isOpen); 
            setIsMinimized(false); 
          }}
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: isOpen ? "var(--bg-surface)" : "linear-gradient(135deg, #E8521A 0%, #c44015 100%)",
            border: isOpen ? "2px solid var(--border-default)" : "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: isOpen ? "0 4px 12px rgba(0,0,0,0.12)" : "0 4px 20px rgba(232,82,26,0.5)",
            animation: isOpen ? "none" : "botPulse 2.5s infinite",
            transition: "all 0.2s ease",
            position: "relative"
          }}
          title={isOpen ? "Close AI Assistant" : "Open CareAudit AI"}
        >
          {isOpen ? (
            <ChevronDown size={22} color="var(--text-secondary)" />
          ) : (
            <>
              <Sparkles size={24} color="white" />
              <span
                style={{
                  position: "absolute",
                  top: "4px",
                  right: "4px",
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: "#4ade80",
                  border: "2px solid white"
                }}
              />
            </>
          )}
        </button>
      </div>
    </>
  );
}
