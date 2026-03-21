"use client";

import { useState, useEffect, useCallback } from "react";

// ========== Types ==========
type RequirementType = "ir" | "ar" | "fur";
type RequirementStatus = "pending" | "in_progress" | "completed";

interface Requirement {
  id: string;
  parentId: string | null;
  title: string;
  type: RequirementType;
  status: RequirementStatus;
  summary: string | null;
  conversationId: string | null;
  assigneeId: string | null;
  taskCount: number;
  completedTaskCount: number;
  createdAt: string;
  updatedAt: string;
  children?: Requirement[];
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  category: string;
  estimatedDays: number;
  assigneeId: string | null;
  assigneeName?: string;
  requirementId: string | null;
}

interface Member {
  id: string;
  name: string;
  role: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface RequirementConversation {
  id: string;
  sessionId: string;
  requirement: string;
  result: { summary: string; tasks: Task[] } | null;
  status: string;
  createdAt: string;
  messages?: ChatMessage[];
}

// ========== Constants ==========
const TYPE_LABELS: Record<RequirementType, { label: string; color: string }> = {
  ir: { label: "IR", color: "bg-purple-100 text-purple-700" },
  ar: { label: "AR", color: "bg-blue-100 text-blue-700" },
  fur: { label: "FuR", color: "bg-green-100 text-green-700" },
};

const STATUS_LABELS: Record<RequirementStatus, { label: string; color: string }> = {
  pending: { label: "待处理", color: "text-gray-400" },
  in_progress: { label: "进行中", color: "text-yellow-600" },
  completed: { label: "已完成", color: "text-green-600" },
};

// ========== Tree Node Component ==========
function TreeNode({
  node,
  selectedId,
  expandedIds,
  onSelect,
  onToggle,
  level = 0,
}: {
  node: Requirement;
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  level?: number;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const typeInfo = TYPE_LABELS[node.type];
  const statusInfo = STATUS_LABELS[node.status];

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
          isSelected ? "bg-brand-50 border border-brand-200" : "hover:bg-surface-50"
        }`}
        style={{ paddingLeft: `${12 + level * 20}px` }}
        onClick={() => onSelect(node.id)}
      >
        {/* Expand/Collapse */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggle(node.id);
          }}
          className={`w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 ${
            !hasChildren ? "invisible" : ""
          }`}
        >
          {hasChildren && (
            <svg
              className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>

        {/* Type Badge */}
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${typeInfo.color}`}>
          {typeInfo.label}
        </span>

        {/* Title */}
        <span className={`flex-1 text-sm truncate ${isSelected ? "text-brand-700 font-medium" : "text-gray-700"}`}>
          {node.title}
        </span>

        {/* Status & Count */}
        <div className="flex items-center gap-2">
          {node.type !== "ir" && (
            <span className="text-xs text-gray-400">
              {node.completedTaskCount}/{node.taskCount}
            </span>
          )}
          <span className={`text-xs ${statusInfo.color}`}>{statusInfo.label}</span>
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={onToggle}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ========== Main Component ==========
export function RequirementClient() {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Chat/Input mode
  const [mode, setMode] = useState<"list" | "chat" | "create">("list");
  const [newIRTitle, setNewIRTitle] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentIRId, setCurrentIRId] = useState<string | null>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [reqRes, taskRes, memberRes] = await Promise.all([
        fetch("/api/requirement/tree"),
        fetch("/api/tasks"),
        fetch("/api/members"),
      ]);

      if (reqRes.ok) {
        const data = await reqRes.json();
        setRequirements(data);
      }
      if (taskRes.ok) {
        const data = await taskRes.json();
        setTasks(data);
      }
      if (memberRes.ok) {
        const data = await memberRes.json();
        setMembers(data);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build tree structure
  const buildTree = (items: Requirement[]): Requirement[] => {
    const map = new Map<string, Requirement>();
    const roots: Requirement[] = [];

    items.forEach((item) => {
      map.set(item.id, { ...item, children: [] });
    });

    items.forEach((item) => {
      const node = map.get(item.id)!;
      if (item.parentId && map.has(item.parentId)) {
        map.get(item.parentId)!.children!.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const treeData = buildTree(requirements);

  // Find selected node
  const selectedNode = requirements.find((r) => r.id === selectedId);

  // Get tasks for selected AR
  const selectedARTasks = selectedNode?.type === "ar"
    ? tasks.filter((t) => t.requirementId === selectedNode.id)
    : [];

  // Get FuRs under selected IR
  const selectedIR_FuRs = selectedNode?.type === "ir"
    ? requirements.filter((r) => r.parentId === selectedNode.id && r.type === "fur")
    : [];

  // Toggle expand
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Start new IR
  const handleCreateIR = () => {
    setNewIRTitle("");
    setMode("create");
  };

  const handleSubmitIR = async () => {
    if (!newIRTitle.trim()) return;

    try {
      const res = await fetch("/api/requirement", {
        method: "POST",
        headers: { "Content-Type": "json" },
        body: JSON.stringify({ action: "create_ir", title: newIRTitle.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentIRId(data.id);
        setCurrentSessionId(data.sessionId);
        setMode("chat");
        setExpandedIds((prev) => new Set([...prev, data.id]));
        fetchData();
      }
    } catch (err) {
      console.error("Failed to create IR:", err);
    }
  };

  // Chat reply
  const handleSendMessage = async () => {
    if (!chatInput.trim() || !currentSessionId) return;

    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setChatLoading(true);

    try {
      const res = await fetch("/api/requirement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reply",
          sessionId: currentSessionId,
          message: userMsg,
          irId: currentIRId,
        }),
      });

      const data = await res.json();

      if (data.message) {
        setChatMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
      }

      if (data.furId) {
        // FuR created, refresh tree
        fetchData();
        setExpandedIds((prev) => new Set([...prev, data.furId]));
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setChatLoading(false);
    }
  };

  // Task status update
  const handleTaskStatusChange = async (taskId: string, newStatus: string) => {
    try {
      const res = await fetch("/api/tasks/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, status: newStatus }),
      });

      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
        );
        // Refresh requirements to update FuR counts
        fetchData();
      }
    } catch (err) {
      console.error("Failed to update task:", err);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="p-6 h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">需求管理</h1>
        <div className="flex gap-2">
          <button
            onClick={handleCreateIR}
            className="bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 transition"
          >
            + 新建 IR
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-purple-100 border border-purple-200"></span>
          <span className="text-gray-500">IR - 注入需求</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-green-100 border border-green-200"></span>
          <span className="text-gray-500">FuR - 功能需求</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-blue-100 border border-blue-200"></span>
          <span className="text-gray-500">AR - 分配需求</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Tree Panel */}
        <div className="w-80 bg-white rounded-xl border border-surface-200 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-surface-100 bg-surface-50">
            <h2 className="text-sm font-semibold text-gray-700">需求树</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {treeData.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                暂无需求<br />点击&quot;新建 IR&quot;开始
              </div>
            ) : (
              treeData.map((node) => (
                <TreeNode
                  key={node.id}
                  node={node}
                  selectedId={selectedId}
                  expandedIds={expandedIds}
                  onSelect={setSelectedId}
                  onToggle={toggleExpand}
                />
              ))
            )}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="flex-1 bg-white rounded-xl border border-surface-200 overflow-hidden flex flex-col">
          {!selectedNode ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              选择左侧需求查看详情
            </div>
          ) : mode === "chat" && selectedId === currentIRId ? (
            /* Chat Mode for current IR */
            <div className="flex flex-col h-full">
              <div className="p-3 border-b border-surface-100 bg-surface-50 flex items-center justify-between">
                <div>
                  <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700 font-medium mr-2">
                    IR
                  </span>
                  <span className="text-sm font-medium">{selectedNode.title}</span>
                </div>
                <button
                  onClick={() => {
                    setMode("list");
                    setCurrentSessionId(null);
                    setCurrentIRId(null);
                    setChatMessages([]);
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  关闭
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-brand-500 text-white rounded-br-md"
                          : "bg-surface-100 text-gray-800 rounded-bl-md"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-surface-100 text-gray-500 px-4 py-3 rounded-2xl rounded-bl-md text-sm">
                      <span className="inline-flex gap-1">
                        <span className="animate-bounce">.</span>
                        <span className="animate-bounce" style={{ animationDelay: "0.1s" }}>.</span>
                        <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>.</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="p-3 border-t border-surface-100">
                <div className="flex gap-2">
                  <input
                    className="flex-1 border border-surface-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                    placeholder="回答澄清问题..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                    disabled={chatLoading}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!chatInput.trim() || chatLoading}
                    className="bg-brand-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition"
                  >
                    发送
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Detail View */
            <div className="flex flex-col h-full overflow-y-auto">
              {/* Detail Header */}
              <div className="p-4 border-b border-surface-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${TYPE_LABELS[selectedNode.type].color}`}>
                    {TYPE_LABELS[selectedNode.type].label}
                  </span>
                  <span className={`text-xs ${STATUS_LABELS[selectedNode.status].color}`}>
                    {STATUS_LABELS[selectedNode.status].label}
                  </span>
                </div>
                <h2 className="text-lg font-semibold text-gray-900">{selectedNode.title}</h2>
                {selectedNode.summary && (
                  <p className="text-sm text-gray-500 mt-2">{selectedNode.summary}</p>
                )}
                <div className="text-xs text-gray-400 mt-2">
                  创建于 {new Date(selectedNode.createdAt).toLocaleDateString("zh-CN")}
                </div>
              </div>

              {/* IR Detail */}
              {selectedNode.type === "ir" && (
                <div className="p-4 space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">子需求 (FuR)</h3>
                    {selectedIR_FuRs.length === 0 ? (
                      <div className="text-sm text-gray-400 bg-surface-50 rounded-lg p-4 text-center">
                        暂无 FuR，点击上方对话创建
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedIR_FuRs.map((fur) => (
                          <div
                            key={fur.id}
                            className="flex items-center gap-3 p-3 bg-surface-50 rounded-lg cursor-pointer hover:bg-surface-100 transition"
                            onClick={() => {
                              setSelectedId(fur.id);
                              setExpandedIds((prev) => new Set([...prev, fur.id]));
                            }}
                          >
                            <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                              FuR
                            </span>
                            <span className="flex-1 text-sm">{fur.title}</span>
                            <span className="text-xs text-gray-400">
                              {fur.completedTaskCount}/{fur.taskCount}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* AR Detail */}
              {selectedNode.type === "ar" && (
                <div className="p-4 space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">
                      关联任务 ({selectedARTasks.length})
                    </h3>
                    {selectedARTasks.length === 0 ? (
                      <div className="text-sm text-gray-400 bg-surface-50 rounded-lg p-4 text-center">
                        暂无任务
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedARTasks.map((task) => {
                          const assignee = members.find((m) => m.id === task.assigneeId);
                          return (
                            <div
                              key={task.id}
                              className="flex items-center gap-3 p-3 bg-surface-50 rounded-lg"
                            >
                              <select
                                value={task.status}
                                onChange={(e) => handleTaskStatusChange(task.id, e.target.value)}
                                className={`text-xs px-2 py-1 rounded-full border-0 ${
                                  task.status === "done"
                                    ? "bg-green-100 text-green-700"
                                    : task.status === "in_progress"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : task.status === "todo"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                <option value="todo">待办</option>
                                <option value="in_progress">进行中</option>
                                <option value="in_review">审核中</option>
                                <option value="done">完成</option>
                              </select>
                              <span className="flex-1 text-sm">{task.title}</span>
                              {assignee && (
                                <span className="text-xs text-gray-500">{assignee.name}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* FuR Detail - show child ARs */}
              {selectedNode.type === "fur" && (() => {
                const childARs = requirements.filter(
                  (r) => r.parentId === selectedNode.id && r.type === "ar"
                );
                return (
                  <div className="p-4 space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">
                        分配需求 (AR) - {childARs.length}
                      </h3>
                      {childARs.length === 0 ? (
                        <div className="text-sm text-gray-400 bg-surface-50 rounded-lg p-4 text-center">
                          暂无 AR，使用确认功能分配任务
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {childARs.map((ar) => (
                            <div
                              key={ar.id}
                              className="flex items-center gap-3 p-3 bg-surface-50 rounded-lg cursor-pointer hover:bg-surface-100 transition"
                              onClick={() => {
                                setSelectedId(ar.id);
                              }}
                            >
                              <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                                AR
                              </span>
                              <span className="flex-1 text-sm">{ar.title}</span>
                              <span className="text-xs text-gray-400">
                                {ar.completedTaskCount}/{ar.taskCount}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Create IR Modal */}
      {mode === "create" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold mb-4">新建 IR - 注入需求</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  需求描述
                </label>
                <textarea
                  className="w-full border border-surface-200 rounded-lg px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-200"
                  rows={4}
                  placeholder="描述你的需求..."
                  value={newIRTitle}
                  onChange={(e) => setNewIRTitle(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setMode("list")}
                className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition"
              >
                取消
              </button>
              <button
                onClick={handleSubmitIR}
                disabled={!newIRTitle.trim()}
                className="bg-brand-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition"
              >
                开始分析
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
