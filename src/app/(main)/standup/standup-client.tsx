"use client";

import { useState, useEffect, useCallback } from "react";

interface Member {
  id: string;
  name: string;
  role: string;
}

interface ChatMessage {
  role: "agent" | "member";
  content: string;
}

interface ExtractedData {
  completed_items: string[];
  planned_items: string[];
  blockers: string[];
  mood: string;
}

interface HistoryConversation {
  id: string;
  memberId: string;
  memberName: string;
  date: string;
  messages: ChatMessage[];
  extractedData: ExtractedData | null;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
}

const avatarColors: Record<string, string> = {
  m1: "bg-blue-500",
  m2: "bg-purple-500",
  m3: "bg-emerald-500",
  m4: "bg-orange-500",
};

const roleLabels: Record<string, string> = {
  frontend: "前端开发",
  backend: "后端开发",
  fullstack: "全栈开发",
  test: "测试工程师",
};

const moodLabels: Record<string, { label: string; color: string }> = {
  positive: { label: "积极", color: "text-green-600" },
  normal: { label: "正常", color: "text-gray-500" },
  negative: { label: "低落", color: "text-orange-500" },
};

type ViewMode = "chat" | "history";

export function StandupClient({ members }: { members: Member[] }) {
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [tasksUpdated, setTasksUpdated] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("chat");
  const [history, setHistory] = useState<HistoryConversation[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [viewingConv, setViewingConv] = useState<HistoryConversation | null>(null);
  const [pendingMemberIds, setPendingMemberIds] = useState<Set<string>>(new Set());

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/conversations");
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode === "history") {
      loadHistory();
    }
  }, [viewMode, loadHistory]);

  useEffect(() => {
    async function fetchPendingStatuses() {
      try {
        const res = await fetch("/api/standup");
        const data = await res.json();
        const pendingIds = data
          .filter((conv: { status: string }) => conv.status === "pending")
          .map((conv: { memberId: string }) => conv.memberId);
        setPendingMemberIds(new Set(pendingIds));
      } catch (err) {
        console.error("Failed to fetch pending statuses:", err);
      }
    }
    fetchPendingStatuses();
  }, []);

  async function startConversation(member: Member) {
    setSelectedMember(member);
    setMessages([]);
    setDone(false);
    setExtracted(null);
    setTasksUpdated(0);
    setViewMode("chat");
    setViewingConv(null);
    setLoading(true);

    try {
      const res = await fetch("/api/standup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id, action: "start" }),
      });
      const data = await res.json();

      if (data.message) {
        setMessages([{ role: "agent", content: data.message }]);
      }
    } catch (err) {
      console.error("Failed to start conversation:", err);
    } finally {
      setLoading(false);
    }
  }

  async function sendReply() {
    if (!input.trim() || !selectedMember || loading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "member", content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/standup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: selectedMember.id,
          message: userMsg,
          action: "reply",
        }),
      });
      const data = await res.json();

      if (data.message) {
        setMessages((prev) => [
          ...prev,
          { role: "agent", content: data.message },
        ]);
      }
      if (data.done) {
        setDone(true);
        setExtracted(data.extracted || null);
        setTasksUpdated(data.tasksUpdated || 0);
      }
    } catch (err) {
      console.error("Failed to send reply:", err);
    } finally {
      setLoading(false);
    }
  }

  function viewHistoryConv(conv: HistoryConversation) {
    setViewingConv(conv);
    const member = members.find((m) => m.id === conv.memberId);
    if (member) setSelectedMember(member);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Standup 对话</h1>
        <div className="flex bg-white border border-surface-200 rounded-lg overflow-hidden">
          <button
            onClick={() => { setViewMode("chat"); setViewingConv(null); }}
            className={`px-4 py-1.5 text-xs font-medium transition ${
              viewMode === "chat" ? "bg-brand-50 text-brand-600" : "text-gray-500"
            }`}
          >
            发起对话
          </button>
          <button
            onClick={() => setViewMode("history")}
            className={`px-4 py-1.5 text-xs font-medium transition ${
              viewMode === "history" ? "bg-brand-50 text-brand-600" : "text-gray-500"
            }`}
          >
            历史记录
          </button>
        </div>
      </div>

      {viewMode === "chat" && !viewingConv ? (
        /* ========== CHAT MODE ========== */
        <div className="grid grid-cols-4 gap-6">
          {/* Member list */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500">选择组员</h3>
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => startConversation(m)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition text-left ${
                  selectedMember?.id === m.id
                    ? "border-brand-300 bg-brand-50"
                    : "border-surface-200 bg-white hover:border-brand-200"
                }`}
              >
                <div
                  className={`w-8 h-8 ${avatarColors[m.id] || "bg-gray-400"} rounded-full flex items-center justify-center text-white text-xs font-semibold`}
                >
                  {m.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{m.name}</div>
                  <div className="text-xs text-gray-400">
                    {roleLabels[m.role] || m.role}
                  </div>
                </div>
                {pendingMemberIds.has(m.id) && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-600">
                    待完成
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Chat area */}
          <div className="col-span-3">
            {!selectedMember ? (
              <EmptyState />
            ) : (
              <ChatPanel
                member={selectedMember}
                messages={messages}
                loading={loading}
                done={done}
                extracted={extracted}
                tasksUpdated={tasksUpdated}
                input={input}
                onInputChange={setInput}
                onSend={sendReply}
              />
            )}
          </div>
        </div>
      ) : (
        /* ========== HISTORY MODE ========== */
        <div className="grid grid-cols-3 gap-6">
          {/* History list */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500">对话记录</h3>
            {historyLoading ? (
              <div className="text-sm text-gray-400 p-4">加载中...</div>
            ) : history.length === 0 ? (
              <div className="text-sm text-gray-400 p-4 bg-white rounded-xl border border-surface-200 text-center">
                暂无对话记录
              </div>
            ) : (
              history.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => viewHistoryConv(conv)}
                  className={`w-full text-left p-3 rounded-xl border transition ${
                    viewingConv?.id === conv.id
                      ? "border-brand-300 bg-brand-50"
                      : "border-surface-200 bg-white hover:border-brand-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 ${avatarColors[conv.memberId] || "bg-gray-400"} rounded-full flex items-center justify-center text-white text-[10px] font-semibold`}
                    >
                      {(conv.memberName || "?")[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{conv.memberName}</div>
                      <div className="text-xs text-gray-400">{conv.date}</div>
                    </div>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        conv.status === "completed"
                          ? "bg-green-100 text-green-600"
                          : "bg-yellow-100 text-yellow-600"
                      }`}
                    >
                      {conv.status === "completed" ? "已完成" : "进行中"}
                    </span>
                  </div>
                  {conv.extractedData && (
                    <div className="mt-2 text-xs text-gray-400 truncate">
                      完成: {conv.extractedData.completed_items.join(", ") || "无"}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>

          {/* History detail */}
          <div className="col-span-2">
            {!viewingConv ? (
              <div className="bg-white rounded-xl border border-surface-200 p-12 text-center">
                <div className="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-500">选择一条记录查看详情</h3>
                <p className="text-sm text-gray-400 mt-1">点击左侧的对话记录查看完整对话和提取信息</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-surface-200 overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-surface-200 flex items-center gap-3">
                  <div
                    className={`w-8 h-8 ${avatarColors[viewingConv.memberId] || "bg-gray-400"} rounded-full flex items-center justify-center text-white text-xs font-semibold`}
                  >
                    {(viewingConv.memberName || "?")[0]}
                  </div>
                  <div>
                    <div className="font-medium text-sm">
                      与 {viewingConv.memberName} 的 Standup
                    </div>
                    <div className="text-xs text-gray-400">{viewingConv.date}</div>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ml-auto ${
                      viewingConv.status === "completed"
                        ? "bg-green-100 text-green-600"
                        : "bg-yellow-100 text-yellow-600"
                    }`}
                  >
                    {viewingConv.status === "completed" ? "已完成" : "进行中"}
                  </span>
                </div>

                {/* Messages */}
                <div className="max-h-[400px] overflow-y-auto p-5 space-y-4">
                  {viewingConv.messages.map((msg, i) =>
                    msg.role === "agent" ? (
                      <div key={i} className="flex gap-3">
                        <div className="w-8 h-8 bg-brand-500 rounded-full flex items-center justify-center shrink-0">
                          <AgentIcon />
                        </div>
                        <div className="max-w-[75%] bg-surface-50 rounded-2xl rounded-tl-md px-4 py-3">
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    ) : (
                      <div key={i} className="flex gap-3 justify-end">
                        <div className="max-w-[75%] bg-brand-500 text-white rounded-2xl rounded-tr-md px-4 py-3">
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                        <div
                          className={`w-8 h-8 ${avatarColors[viewingConv.memberId] || "bg-gray-400"} rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0`}
                        >
                          {(viewingConv.memberName || "?")[0]}
                        </div>
                      </div>
                    )
                  )}
                </div>

                {/* Extracted data */}
                {viewingConv.extractedData && (
                  <div className="border-t border-surface-200 p-4 bg-surface-50">
                    <div className="text-xs font-medium text-gray-400 mb-3">
                      Agent 提取的结构化信息
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="bg-white p-3 rounded-lg border border-surface-200">
                        <div className="text-[10px] text-gray-400 mb-1.5">昨日完成</div>
                        <ul className="text-xs space-y-1">
                          {viewingConv.extractedData.completed_items.length > 0 ? (
                            viewingConv.extractedData.completed_items.map((item, i) => (
                              <li key={i} className="flex items-start gap-1">
                                <span className="text-green-500 mt-0.5">&#10003;</span>
                                <span>{item}</span>
                              </li>
                            ))
                          ) : (
                            <li className="text-gray-300">无</li>
                          )}
                        </ul>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-surface-200">
                        <div className="text-[10px] text-gray-400 mb-1.5">今日计划</div>
                        <ul className="text-xs space-y-1">
                          {viewingConv.extractedData.planned_items.length > 0 ? (
                            viewingConv.extractedData.planned_items.map((item, i) => (
                              <li key={i} className="flex items-start gap-1">
                                <span className="text-blue-400 mt-0.5">&#9675;</span>
                                <span>{item}</span>
                              </li>
                            ))
                          ) : (
                            <li className="text-gray-300">无</li>
                          )}
                        </ul>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-surface-200">
                        <div className="text-[10px] text-gray-400 mb-1.5">阻塞项</div>
                        <ul className="text-xs space-y-1">
                          {viewingConv.extractedData.blockers.length > 0 ? (
                            viewingConv.extractedData.blockers.map((item, i) => (
                              <li key={i} className="text-red-600 flex items-start gap-1">
                                <span className="mt-0.5">!</span>
                                <span>{item}</span>
                              </li>
                            ))
                          ) : (
                            <li className="text-green-600">无</li>
                          )}
                        </ul>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-surface-200">
                        <div className="text-[10px] text-gray-400 mb-1.5">情绪状态</div>
                        <div className={`text-sm font-medium ${
                          moodLabels[viewingConv.extractedData.mood]?.color || "text-gray-500"
                        }`}>
                          {moodLabels[viewingConv.extractedData.mood]?.label || viewingConv.extractedData.mood}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ========== Sub Components ========== */

function AgentIcon() {
  return (
    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
      />
    </svg>
  );
}

function EmptyState() {
  return (
    <div className="bg-white rounded-xl border border-surface-200 p-12 text-center">
      <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-600">选择一位组员开始 Standup</h3>
      <p className="text-sm text-gray-400 mt-2">点击左侧组员卡片，Agent 会自动发起对话</p>
    </div>
  );
}

function ChatPanel({
  member,
  messages,
  loading,
  done,
  extracted,
  tasksUpdated,
  input,
  onInputChange,
  onSend,
}: {
  member: Member;
  messages: ChatMessage[];
  loading: boolean;
  done: boolean;
  extracted: ExtractedData | null;
  tasksUpdated: number;
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-surface-200 overflow-hidden flex flex-col h-[600px]">
      {/* Header */}
      <div className="p-4 border-b border-surface-200 flex items-center gap-3">
        <div
          className={`w-8 h-8 ${avatarColors[member.id] || "bg-gray-400"} rounded-full flex items-center justify-center text-white text-xs font-semibold`}
        >
          {member.name[0]}
        </div>
        <div>
          <div className="font-medium text-sm">与 {member.name} 的 Standup</div>
          <div className="text-xs text-gray-400">{new Date().toLocaleDateString("zh-CN")}</div>
        </div>
        {done && (
          <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full ml-auto">
            已完成
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.map((msg, i) =>
          msg.role === "agent" ? (
            <div key={i} className="flex gap-3">
              <div className="w-8 h-8 bg-brand-500 rounded-full flex items-center justify-center shrink-0">
                <AgentIcon />
              </div>
              <div className="max-w-[75%] bg-surface-50 rounded-2xl rounded-tl-md px-4 py-3">
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ) : (
            <div key={i} className="flex gap-3 justify-end">
              <div className="max-w-[75%] bg-brand-500 text-white rounded-2xl rounded-tr-md px-4 py-3">
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
              <div
                className={`w-8 h-8 ${avatarColors[member.id] || "bg-gray-400"} rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0`}
              >
                {member.name[0]}
              </div>
            </div>
          )
        )}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-brand-500 rounded-full flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <div className="bg-surface-50 rounded-2xl rounded-tl-md px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:0.1s]" />
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:0.2s]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Extracted */}
      {extracted && (
        <div className="border-t border-surface-200 p-4 bg-surface-50">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-gray-400">Agent 提取的结构化信息</div>
            {tasksUpdated > 0 && (
              <div className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                已同步 {tasksUpdated} 个任务状态到看板
              </div>
            )}
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white p-2.5 rounded-lg border border-surface-200">
              <div className="text-[10px] text-gray-400 mb-1">昨日完成</div>
              <div className="text-xs">{extracted.completed_items.join("、") || "无"}</div>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-surface-200">
              <div className="text-[10px] text-gray-400 mb-1">今日计划</div>
              <div className="text-xs">{extracted.planned_items.join("、") || "无"}</div>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-surface-200">
              <div className="text-[10px] text-gray-400 mb-1">阻塞项</div>
              <div className={`text-xs ${extracted.blockers.length > 0 ? "text-red-600" : "text-green-600"}`}>
                {extracted.blockers.join("、") || "无"}
              </div>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-surface-200">
              <div className="text-[10px] text-gray-400 mb-1">情绪</div>
              <div className={`text-xs ${moodLabels[extracted.mood]?.color || "text-gray-500"}`}>
                {moodLabels[extracted.mood]?.label || extracted.mood}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      {!done && (
        <div className="p-4 border-t border-surface-200">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSend()}
              placeholder="输入回复..."
              className="flex-1 border border-surface-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
              disabled={loading}
            />
            <button
              onClick={onSend}
              disabled={loading || !input.trim()}
              className="bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 transition disabled:opacity-50"
            >
              发送
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
