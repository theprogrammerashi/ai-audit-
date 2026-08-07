"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Send, Plus, Lock, MessageSquare, Trash2, HelpCircle, ChevronDown, ChevronUp, Sparkles, PanelLeftClose, PanelLeft } from "lucide-react";
import Logo from "@/components/brand/Logo";
import UserAvatar from "@/components/shared/UserAvatar";
import api from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  structured_data?: any;
  created_at?: string;
}

interface Conversation {
  id: string;
  title: string;
  updated_at?: string;
}

interface SuggestionCategory {
  emoji: string;
  label: string;
  questions: string[];
  initialShow: number;
}

const SUGGESTION_CATEGORIES: SuggestionCategory[] = [
  {
    emoji: "01", label: "Case-Level", initialShow: 2,
    questions: [
      "Show me details for case CASE-2026-013",
      "What is the QA score for case-005?",
      "Why did case-018 get a FAIL audit result?",
      "What criteria did case-010 meet for admission?"
    ]
  },
  {
    emoji: "02", label: "Nurse Performance", initialShow: 2,
    questions: [
      "How is Jessica Harris performing?",
      "Which nurse has the lowest QA scores?",
      "Show me all cases reviewed by Matthew Jackson",
      "What are the common gaps for nurse Jessica Harris?"
    ]
  },
  {
    emoji: "03", label: "Audit & QA", initialShow: 3,
    questions: [
      "Show me all FAIL audit results",
      "What is the average QA score across the team?",
      "Which cases have critical findings?",
      "What are the most common documentation gaps?"
    ]
  },
  {
    emoji: "04", label: "Appeals & Risk", initialShow: 2,
    questions: [
      "Which cases have the highest appeal risk?",
      "Show appeal outcomes for denied cases",
      "What diagnoses have the most appeals?",
      "What is our total financial exposure?"
    ]
  },
  {
    emoji: "05", label: "Trends", initialShow: 3,
    questions: [
      "How have QA scores trended this quarter?",
      "Is the denial rate improving?",
      "Which diagnosis has the worst outcomes?"
    ]
  }
];

export default function ChatPage() {
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [hoveredConv, setHoveredConv] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await api.get("/chat/history");
      setConversations(res.data);
    } catch (err) {
      console.error("Failed to fetch chat history", err);
    }
  };

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) {
      setInput(q);
      setTimeout(() => handleSend(q), 500);
    }
  }, [searchParams]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleNewConversation = () => {
    setMessages([]);
    setConversationId(null);
    setIsLoading(false);
  };

  const handleSelectConversation = async (conv: Conversation) => {
    setConversationId(conv.id);
    setIsLoading(true);
    try {
      const res = await api.get(`/chat/${conv.id}/messages`);
      setMessages(res.data);
    } catch (err) {
      console.error("Failed to load messages", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    try {
      await api.delete(`/chat/${convId}`);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (conversationId === convId) {
        setConversationId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to delete conversation", err);
    }
  };

  const handleSend = async (overrideMessage?: string) => {
    const msg = overrideMessage || input;
    if (!msg.trim() || isLoading) return;

    setShowSuggestions(false);
    setIsSidebarOpen(false);

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: msg,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await api.post("/chat/", {
        message: msg,
        conversation_id: conversationId,
      });
      const data = res.data;
      
      if (!conversationId) {
        setConversationId(data.conversation_id);
        fetchHistory();
      }
      
      setMessages((prev) => [...prev, data.message]);
    } catch (err) {
      console.error("Chat API error:", err);
      setMessages((prev) => [...prev, {
        id: `msg-${Date.now()}-err`,
        role: "assistant",
        content: "Sorry, I encountered an error communicating with the server. Please check that the backend is running."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCategory = (label: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const renderMarkdown = (text: string) => {
    // Check if there's a table (pipe-delimited lines)
    const lines = text.split('\n');
    const segments: { type: 'text' | 'table'; content: string }[] = [];
    let currentText: string[] = [];
    let tableLines: string[] = [];
    let inTable = false;

    for (const line of lines) {
      const trimmed = line.trim();
      const isPipeLine = trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|');
      const isSeparatorLine = /^\|[\s\-:|]+\|$/.test(trimmed);

      if (isPipeLine || isSeparatorLine) {
        if (!inTable) {
          if (currentText.length > 0) {
            segments.push({ type: 'text', content: currentText.join('\n') });
            currentText = [];
          }
          inTable = true;
        }
        tableLines.push(trimmed);
      } else {
        if (inTable) {
          segments.push({ type: 'table', content: tableLines.join('\n') });
          tableLines = [];
          inTable = false;
        }
        currentText.push(line);
      }
    }
    if (inTable && tableLines.length > 0) {
      segments.push({ type: 'table', content: tableLines.join('\n') });
    }
    if (currentText.length > 0) {
      segments.push({ type: 'text', content: currentText.join('\n') });
    }

    // Render
    let html = '';
    for (const seg of segments) {
      if (seg.type === 'table') {
        html += renderTable(seg.content);
      } else {
        let content = seg.content
          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
          .replace(/\n/g, "<br />")
          .replace(/^- /gm, "&#8226; ");

        // Also replace in plain text
        content = content
          .replace(/\[UP\]/g, `<span style="color:var(--success);font-weight:600;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;flex-shrink:0;"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg></span>`)
          .replace(/\[DOWN\]/g, `<span style="color:var(--danger);font-weight:600;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;flex-shrink:0;"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg></span>`)
          .replace(/\[--\]/g, `<span style="color:var(--info, #0ea5e9);font-weight:600;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;flex-shrink:0;"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg></span>`);

        html += content;
      }
    }
    return html;
  };

  const renderTable = (tableText: string) => {
    const rows = tableText.split('\n').filter(r => r.trim());
    if (rows.length < 2) return tableText;

    const parseRow = (row: string) => {
      return row.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1).map(c => c.trim());
    };

    // Check if row 2 is separator
    const isSep = /^[\s\-:|]+$/.test(rows[1].replace(/\|/g, ''));
    const headerRow = parseRow(rows[0]);
    const dataRows = rows.slice(isSep ? 2 : 1).map(parseRow);

    let tableHtml = `<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.84rem;border-radius:8px;overflow:hidden;border:1px solid var(--border-default);">`;
    tableHtml += '<thead><tr>';
    for (const h of headerRow) {
      tableHtml += `<th style="padding:10px 14px;background:rgba(15,14,12,0.05);text-align:left;font-weight:600;color:var(--text-primary);border-bottom:2px solid var(--border-default);white-space:nowrap;">${h}</th>`;
    }
    tableHtml += '</tr></thead><tbody>';
    for (let ri = 0; ri < dataRows.length; ri++) {
      const row = dataRows[ri];
      tableHtml += `<tr style="background:${ri % 2 === 1 ? 'rgba(15,14,12,0.02)' : 'transparent'};">`;
      for (const cell of row) {
        // Color code score values
        const numVal = parseFloat(cell);
        let cellStyle = 'padding:8px 14px;border-bottom:1px solid var(--border-default);color:var(--text-secondary);';
        if (!isNaN(numVal) && cell.match(/^\d+\.?\d*%?$/)) {
          const v = cell.includes('%') ? numVal : numVal;
          if (v >= 85) cellStyle += 'color:var(--success);font-weight:600;';
          else if (v >= 70) cellStyle += 'color:var(--warning);font-weight:600;';
          else if (v < 70 && v > 0) cellStyle += 'color:var(--danger);font-weight:600;';
        }

        let cellContent = cell.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        if (cell.includes('[UP]')) {
          cellContent = `
            <span style="color:var(--success);font-weight:600;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                <polyline points="17 6 23 6 23 12"></polyline>
              </svg>
              ${cell.replace('[UP]', '').trim()}
            </span>
          `;
        } else if (cell.includes('[DOWN]')) {
          cellContent = `
            <span style="color:var(--danger);font-weight:600;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
                <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline>
                <polyline points="17 18 23 18 23 12"></polyline>
              </svg>
              ${cell.replace('[DOWN]', '').trim()}
            </span>
          `;
        } else if (cell.includes('[--]')) {
          cellContent = `
            <span style="color:var(--info, #0ea5e9);font-weight:600;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
              ${cell.replace('[--]', '').trim()}
            </span>
          `;
        }

        tableHtml += `<td style="${cellStyle}">${cellContent}</td>`;
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</tbody></table>';
    return `<div style="overflow-x:auto;max-width:100%;">${tableHtml}</div>`;
  };

  // Suggestions panel component
  const SuggestionsPanel = ({ isEmptyState }: { isEmptyState: boolean }) => (
    <div style={{
      ...(isEmptyState ? { maxWidth: "700px", width: "100%", marginTop: "20px" } : {
        position: "absolute" as const, bottom: "100%", left: "0", right: "0", 
        maxHeight: "450px", overflowY: "auto" as const,
        background: "var(--bg-surface)", borderTop: "1px solid var(--border-default)",
        boxShadow: "0 -8px 24px rgba(0,0,0,0.08)", borderRadius: "16px 16px 0 0",
        padding: "0"
      })
    }}>
      {!isEmptyState && (
        <div style={{ 
          padding: "14px 20px", borderBottom: "1px solid var(--border-default)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          position: "sticky" as const, top: 0, background: "var(--bg-surface)", zIndex: 1
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Sparkles size={15} style={{ color: "var(--primary)" }} />
            <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-primary)" }}>What can I ask?</span>
          </div>
          <button 
            onClick={() => setShowSuggestions(false)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: "4px", display: "flex" }}
          >
            <ChevronDown size={16} />
          </button>
        </div>
      )}
      <div style={{ padding: isEmptyState ? "0" : "8px 16px 16px" }}>
        {SUGGESTION_CATEGORIES.map((cat) => {
          const isExpanded = expandedCategories.has(cat.label);
          const visibleQuestions = isExpanded ? cat.questions : cat.questions.slice(0, cat.initialShow);
          const hasMore = cat.questions.length > cat.initialShow;

          return (
            <div key={cat.label} style={{ marginBottom: "16px" }}>
              <div style={{ 
                fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em",
                color: "var(--text-secondary)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px"
              }}>
                <span style={{ 
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: "20px", height: "20px", borderRadius: "4px",
                  background: "var(--bg-body)", border: "1px solid var(--border-default)",
                  color: "var(--primary)", fontSize: "0.65rem", fontWeight: 700
                }}>
                  {cat.emoji}
                </span> {cat.label}
              </div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {visibleQuestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); handleSend(q); }}
                    style={{
                      padding: "7px 14px", borderRadius: "var(--radius-full)",
                      border: "1px solid var(--border-default)", background: "var(--bg-surface)",
                      cursor: "pointer", fontSize: "0.8rem", color: "var(--text-secondary)",
                      transition: "all 0.15s ease", whiteSpace: "nowrap"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--primary)";
                      e.currentTarget.style.color = "var(--primary)";
                      e.currentTarget.style.background = "rgba(232,82,26,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border-default)";
                      e.currentTarget.style.color = "var(--text-secondary)";
                      e.currentTarget.style.background = "var(--bg-surface)";
                    }}
                  >
                    {q}
                  </button>
                ))}
                {hasMore && (
                  <button
                    onClick={() => toggleCategory(cat.label)}
                    style={{
                      padding: "7px 12px", borderRadius: "var(--radius-full)",
                      border: "1px dashed var(--border-default)", background: "transparent",
                      cursor: "pointer", fontSize: "0.75rem", color: "var(--text-tertiary)",
                      transition: "all 0.15s ease", display: "flex", alignItems: "center", gap: "4px"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--primary)";
                      e.currentTarget.style.color = "var(--primary)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border-default)";
                      e.currentTarget.style.color = "var(--text-tertiary)";
                    }}
                  >
                    {isExpanded ? (<><ChevronUp size={12} /> Show less</>) : (<><ChevronDown size={12} /> +{cat.questions.length - cat.initialShow} more</>)}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* ── Chat Sidebar ── */}
      {isSidebarOpen && (
      <div
        style={{
          width: "280px",
          borderRight: "1px solid var(--border-default)",
          background: "var(--bg-surface)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        <div style={{ padding: "16px" }}>
          <button
            onClick={handleNewConversation}
            className="btn btn-primary"
            style={{ width: "100%", borderRadius: "var(--radius-md)" }}
          >
            <Plus size={16} /> New Conversation
          </button>
        </div>

        <div style={{ padding: "0 16px 8px" }}>
          <span className="label">Chat History</span>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 8px" }}>
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => handleSelectConversation(conv)}
              onMouseEnter={() => setHoveredConv(conv.id)}
              onMouseLeave={() => setHoveredConv(null)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "6px",
                width: "100%",
                padding: "10px 12px",
                marginBottom: "2px",
                borderRadius: "var(--radius-md)",
                background: conversationId === conv.id ? "var(--bg-active)" : hoveredConv === conv.id ? "var(--bg-hover)" : "transparent",
                cursor: "pointer",
                textAlign: "left",
                color: conversationId === conv.id ? "var(--primary)" : "var(--text-primary)",
                fontSize: "0.825rem",
                fontWeight: conversationId === conv.id ? 500 : 400,
                transition: "background 0.15s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden", flex: 1 }}>
                <MessageSquare size={14} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {conv.title}
                </span>
              </div>
              {hoveredConv === conv.id && (
                <button
                  onClick={(e) => handleDeleteConversation(e, conv.id)}
                  title="Delete conversation"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-tertiary)",
                    display: "flex",
                    alignItems: "center",
                    flexShrink: 0,
                    transition: "color 0.15s ease",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--danger)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-tertiary)"; }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          {conversations.length === 0 && (
             <div style={{ padding: "16px", textAlign: "center", color: "var(--text-tertiary)", fontSize: "0.85rem" }}>
               No recent conversations
             </div>
          )}
        </div>
      </div>
      )}

      {/* ── Main Chat Area ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Top Bar */}
        <div
          style={{
            padding: "12px 24px",
            borderBottom: "1px solid var(--border-default)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--bg-surface)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              title={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
              style={{
                background: "none", border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-md)", cursor: "pointer",
                padding: "6px", display: "flex", alignItems: "center",
                color: "var(--text-secondary)", transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.color = "var(--primary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
            >
              {isSidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
            </button>
            <span className="status-dot green" />
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              Available — Connected to Enterprise DB & LLM
            </span>
          </div>
          {/* Info toggle for suggestions */}
          {messages.length > 0 && (
            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              title="What can I ask?"
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "6px 12px", borderRadius: "var(--radius-full)",
                border: "1px solid var(--border-default)", background: showSuggestions ? "rgba(232,82,26,0.06)" : "var(--bg-surface)",
                cursor: "pointer", fontSize: "0.78rem", color: showSuggestions ? "var(--primary)" : "var(--text-tertiary)",
                transition: "all 0.15s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--primary)";
                e.currentTarget.style.color = "var(--primary)";
              }}
              onMouseLeave={(e) => {
                if (!showSuggestions) {
                  e.currentTarget.style.borderColor = "var(--border-default)";
                  e.currentTarget.style.color = "var(--text-tertiary)";
                }
              }}
            >
              <HelpCircle size={14} />
              What can I ask?
            </button>
          )}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          {messages.length === 0 && !isLoading && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "var(--text-tertiary)",
                gap: "16px",
              }}
            >
              <Logo size="default" />
              <p style={{ fontSize: "0.95rem" }}>Ask anything about your clinical audit data</p>
              <SuggestionsPanel isEmptyState={true} />
            </div>
          )}

          {messages.map((msg, index) => (
            <div
              key={msg.id}
              className="animate-fade-in"
              style={{
                display: "flex",
                gap: "12px",
                marginBottom: "24px",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                animationDelay: `${index * 0.05}s`,
              }}
            >
              {msg.role === "assistant" && <UserAvatar name="CareAudit" isAI size={32} />}
              
              <div
                style={{
                  maxWidth: msg.role === "assistant" ? "88%" : "75%",
                  padding: msg.role === "assistant" ? "20px 24px" : "12px 18px",
                  borderRadius: "var(--radius-lg)",
                  background: msg.role === "assistant" ? "var(--bg-surface)" : "var(--primary)",
                  color: msg.role === "assistant" ? "var(--text-primary)" : "#FFFFFF",
                  border: msg.role === "assistant" ? "1px solid var(--border-default)" : "none",
                  boxShadow: msg.role === "assistant" ? "var(--shadow-sm)" : "none",
                  overflow: "hidden",
                  overflowWrap: "break-word" as const,
                  wordBreak: "break-word" as const,
                }}
              >
                {msg.role === "assistant" && (
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, marginBottom: "10px", color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    CareAudit AI
                  </div>
                )}
                <div
                  style={{
                    fontSize: "0.9rem",
                    lineHeight: 1.7,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "break-word" as const,
                    wordBreak: "break-word" as const,
                  }}
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(msg.content),
                  }}
                />
              </div>

              {msg.role === "user" && <UserAvatar name="Admin User" size={32} />}
            </div>
          ))}

          {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === "user" && (
            <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
              <UserAvatar name="CareAudit" isAI size={32} />
              <div className="card" style={{ padding: "16px 24px" }}>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: "var(--primary)",
                        animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                        opacity: 0.4,
                      }}
                    />
                  ))}
                  <span style={{ marginLeft: "8px", fontSize: "0.8rem", color: "var(--text-tertiary)" }}>Analyzing your data...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div style={{ padding: "0", borderTop: "1px solid var(--border-default)", background: "var(--bg-surface)", position: "relative" }}>
          {/* Suggestions panel overlay */}
          {showSuggestions && messages.length > 0 && <SuggestionsPanel isEmptyState={false} />}

          <div style={{ padding: "16px 24px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                background: "var(--bg-body)",
                border: "1px solid var(--border-input)",
                borderRadius: "var(--radius-lg)",
                padding: "4px 4px 4px 16px",
              }}
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Ask a question about cases, reviewers, or appeal risks..."
                style={{
                  flex: 1, border: "none", outline: "none", background: "transparent",
                  fontSize: "0.9rem", color: "var(--text-primary)", padding: "10px 0",
                }}
              />
              <button
                onClick={() => handleSend()}
                className="btn btn-primary"
                style={{ borderRadius: "var(--radius-md)", padding: "8px 18px" }}
                disabled={isLoading}
              >
                Ask <Send size={14} />
              </button>
            </div>
            <div
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: "6px", marginTop: "10px", color: "var(--text-tertiary)", fontSize: "0.75rem",
              }}
            >
              <Lock size={12} />
              Powered by Groq LLM inference — Enterprise data stays secure
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
