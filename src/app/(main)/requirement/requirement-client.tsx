"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import useSWR from "swr";
import { useAIStream } from "@/hooks/use-ai-stream";
import { MarkdownContent } from "@/components/markdown-content";

// ========== Skeleton Components ==========
function SkeletonLine({ width = "w-full", height = "h-4" }: { width?: string; height?: string }) {
  return (
    <div
      className={`bg-gray-200 rounded animate-pulse ${width} ${height}`}
    />
  );
}

function SkeletonCard() {
  return (
    <div className="p-3 border-b border-gray-100">
      <div className="flex items-center gap-2 mb-2">
        <SkeletonLine width="w-6" height="h-6" />
        <SkeletonLine width="w-24" height="h-4" />
      </div>
      <SkeletonLine width="w-3/4" height="h-3" />
    </div>
  );
}

function SkeletonTree() {
  return (
    <div className="p-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className={i > 1 ? "ml-4 mt-2" : ""}>
          <SkeletonCard />
        </div>
      ))}
    </div>
  );
}

function SkeletonDetail() {
  return (
    <div className="p-6">
      <SkeletonLine width="w-48" height="h-6" />
      <div className="mt-4 space-y-3">
        <SkeletonLine width="w-full" height="h-4" />
        <SkeletonLine width="w-full" height="h-4" />
        <SkeletonLine width="w-3/4" height="h-4" />
      </div>
      <div className="mt-6">
        <SkeletonLine width="w-32" height="h-8" />
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <svg
        className="w-24 h-24 text-gray-200 mb-4"
        fill="none"
        viewBox="0 0 100 100"
      >
        <rect x="10" y="20" width="80" height="60" rx="4" stroke="currentColor" strokeWidth="2" fill="none" />
        <line x1="20" y1="35" x2="60" y2="35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="20" y1="50" x2="80" y2="50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="20" y1="65" x2="50" y2="65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <h3 className="text-lg font-medium text-gray-600 mb-1">{title}</h3>
      <p className="text-sm text-gray-400 mb-4 max-w-xs">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 transition"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ========== Breadcrumb Component ==========
interface BreadcrumbItem {
  id: string;
  title: string;
  type: RequirementType;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  onNavigate: (id: string) => void;
}

function Breadcrumb({ items, onNavigate }: BreadcrumbProps) {
  if (items.length === 0) return null;

  const typeLabels: Record<RequirementType, string> = {
    ir: "IR",
    fur: "FuR",
    ar: "AR",
  };

  const typeColors: Record<RequirementType, string> = {
    ir: "text-purple-600",
    fur: "text-green-600",
    ar: "text-blue-600",
  };

  return (
    <nav className="flex items-center gap-1 text-sm mb-3">
      {items.map((item, index) => (
        <span key={item.id} className="flex items-center gap-1">
          {index > 0 && <span className="text-gray-300 mx-1">›</span>}
          <button
            onClick={() => onNavigate(item.id)}
            className={`hover:underline ${typeColors[item.type]}`}
          >
            {typeLabels[item.type]}: {item.title.length > 15 ? item.title.slice(0, 15) + "..." : item.title}
          </button>
        </span>
      ))}
    </nav>
  );
}

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

interface TaskBreakdown {
  title: string;
  description: string;
  category: string;
  priority: string;
  estimatedDays: number;
  requiredSkills: string[];
  suggestedAssignee: { memberId: string; memberName: string; reason: string } | null;
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

// ========== Helper ==========
/** Strip AI response tags for clean display */
function stripAIDisplayTags(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/<ir_title>[\s\S]*?<\/ir_title>/g, "")
    .replace(/<tasks>[\s\S]*?<\/tasks>/g, "")
    // Strip only JSON code blocks containing task data, not all code blocks
    .replace(/```json\s*\{[\s\S]*?"tasks"\s*:\s*\[[\s\S]*?\]\s*\}[\s\S]*?```/g, "")
    .replace(/<extracted>[\s\S]*?<\/extracted>/g, "")
    // Strip bare JSON objects with tasks array (not inside code blocks)
    .replace(/(?<!`)\{[\s\S]*?"tasks"\s*:\s*\[[\s\S]*?\][\s\S]*?\}(?!`)/g, "")
    .trim();
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
  const { data: requirements = [], mutate: mutateRequirements, isLoading: loadingReqs } = useSWR<Requirement[]>("/api/requirement/tree");
  const { data: tasks = [], mutate: mutateTasks } = useSWR<Task[]>("/api/tasks");
  const { data: members = [] } = useSWR<Member[]>("/api/members");
  const loading = loadingReqs;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Chat/Input mode
  const [mode, setMode] = useState<"list" | "chat" | "create">("list");
  const [newIRTitle, setNewIRTitle] = useState("");
  const [editingRequirement, setEditingRequirement] = useState<Requirement | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingSummary, setEditingSummary] = useState("");
  const [showAddAR, setShowAddAR] = useState(false);
  const [newARTitle, setNewARTitle] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentIRId, setCurrentIRId] = useState<string | null>(null);
  const [pendingResult, setPendingResult] = useState<{ summary: string; tasks: TaskBreakdown[] } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [irSubmitting, setIrSubmitting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const initialExpandDone = useRef(false);

  // Auto-expand all parent nodes on initial load so ARs are visible
  useEffect(() => {
    if (!initialExpandDone.current && requirements.length > 0) {
      const parentIds = new Set<string>();
      for (const r of requirements) {
        if (r.parentId) {
          parentIds.add(r.parentId);
        }
      }
      if (parentIds.size > 0) {
        setExpandedIds((prev) => {
          const next = new Set(prev);
          for (const id of parentIds) next.add(id);
          return next;
        });
      }
      initialExpandDone.current = true;
    }
  }, [requirements]);

  // Auto-scroll chat to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading, pendingResult]);

  // Refresh all data via SWR mutate
  const refreshData = useCallback(() => {
    mutateRequirements();
    mutateTasks();
  }, [mutateRequirements, mutateTasks]);

  // Optimistically add ARs to tree cache so they appear immediately after confirm
  const optimisticAddARs = useCallback(
    (irId: string, furId: string, arIds: string[], tasks: TaskBreakdown[]) => {
      mutateRequirements(
        (prev = []) => {
          // Add FuR if not exists
          let updated = [...prev];
          if (!updated.find((r) => r.id === furId)) {
            updated.push({
              id: furId,
              parentId: irId,
              title: "功能需求",
              type: "fur" as const,
              status: "in_progress",
              taskCount: arIds.length,
              completedTaskCount: 0,
              children: [] as Requirement[],
              summary: null,
              conversationId: null,
              assigneeId: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }

          // Add AR stubs
          for (let i = 0; i < arIds.length; i++) {
            const arId = arIds[i];
            if (!updated.find((r) => r.id === arId)) {
              const task = tasks[i];
              updated.push({
                id: arId,
                parentId: furId,
                title: task?.title || "分配任务",
                type: "ar" as const,
                status: "in_progress",
                taskCount: 1,
                completedTaskCount: 0,
                children: [] as Requirement[],
                summary: task?.description || null,
                conversationId: null,
                assigneeId: task?.suggestedAssignee?.memberId || null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }
          }
          return updated;
        },
        { revalidate: true }
      );
    },
    [mutateRequirements]
  );

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

  // Handle IR selection - no longer auto-enters chat mode
  // Users can manually enter chat via "继续对话" button in IR detail view

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
    if (!newIRTitle.trim() || irSubmitting) return;

    const irTitle = newIRTitle.trim();

    // Immediately close modal and enter chat — no waiting
    setNewIRTitle("");
    setMode("chat");
    setChatMessages([]);
    setChatLoading(true);

    try {
      const res = await fetch("/api/requirement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_ir", title: irTitle }),
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentIRId(data.id);
        setCurrentSessionId(data.sessionId);
        setSelectedId(data.id);
        setExpandedIds((prev) => new Set([...prev, data.id]));
        refreshData();

        // Auto-trigger streaming first AI message
        startStream("/api/requirement", {
          action: "reply",
          sessionId: data.sessionId,
          message: `请分析这个需求：${irTitle}`,
          irId: data.id,
          stream: true,
        });
      } else {
        // API failed — go back to list
        setMode("list");
      }
    } catch (err) {
      console.error("Failed to create IR:", err);
      setMode("list");
    } finally {
      setChatLoading(false);
    }
  };

  // Chat reply (streaming)
  const { streamingText, isStreaming, startStream, doneData } = useAIStream();

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !currentSessionId) return;

    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);

    try {
      await startStream("/api/requirement", {
        action: "reply",
        sessionId: currentSessionId,
        message: userMsg,
        irId: currentIRId,
        stream: true,
      });
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  // After streaming completes, commit the message and handle doneData
  useEffect(() => {
    if (!isStreaming && streamingText && doneData !== null) {
      const finalText = stripAIDisplayTags(streamingText);
      setChatMessages((prev) => [...prev, { role: "assistant", content: finalText }]);

      const result = doneData.result as { summary?: string; tasks?: TaskBreakdown[] } | undefined;
      if (result?.tasks && Array.isArray(result.tasks) && result.tasks.length > 0) {
        setPendingResult({ summary: result.summary || "", tasks: result.tasks });
      }

      if (doneData.furId) {
        refreshData();
        setExpandedIds((prev) => {
          const next = new Set(prev);
          if (currentIRId) next.add(currentIRId);
          next.add(doneData.furId!);
          return next;
        });
      }
    }
  }, [isStreaming, streamingText, doneData]);

  // Confirm tasks and create ARs
  const handleConfirmTasks = async () => {
    if (!pendingResult || !currentIRId) return;
    setConfirmLoading(true);

    try {
      const res = await fetch("/api/requirement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          irId: currentIRId,
          summary: pendingResult.summary,
          tasks: pendingResult.tasks,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setPendingResult(null);
        // Exit chat mode
        setMode("list");
        setChatMessages([]);
        setCurrentSessionId(null);

        const irId = currentIRId;
        const furId = data.furId as string | undefined;
        const arIds: string[] = data.arIds || [];

        // Optimistically update tree cache so ARs appear immediately
        if (furId && arIds.length > 0 && irId) {
          optimisticAddARs(irId, furId, arIds, pendingResult.tasks);
        } else {
          refreshData();
        }

        // Update expanded state
        const newExpanded = new Set(expandedIds);
        if (irId) newExpanded.add(irId);
        if (furId) {
          newExpanded.add(furId);
          setSelectedId(furId);
        }
        for (const arId of arIds) {
          newExpanded.add(arId);
        }
        setExpandedIds(newExpanded);
        setCurrentIRId(null);
      }
    } catch (err) {
      console.error("Failed to confirm tasks:", err);
    } finally {
      setConfirmLoading(false);
    }
  };

  // Task status update
  const handleTaskStatusChange = async (taskId: string, newStatus: string) => {
    try {
      // Optimistic update
      mutateTasks(
        (prev) => prev?.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
        { revalidate: false }
      );

      const res = await fetch("/api/tasks/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, status: newStatus }),
      });

      if (res.ok) {
        // Refresh requirements to update FuR counts
        mutateRequirements();
      } else {
        // Revert on failure
        mutateTasks();
      }
    } catch (err) {
      console.error("Failed to update task:", err);
      mutateTasks();
    }
  };

  // Edit requirement
  const handleEditRequirement = (req: Requirement) => {
    setEditingRequirement(req);
    setEditingTitle(req.title);
    setEditingSummary(req.summary || "");
  };

  const handleSaveEdit = async () => {
    if (!editingRequirement) return;
    try {
      const res = await fetch("/api/requirement", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingRequirement.id,
          title: editingTitle.trim(),
          summary: editingSummary.trim(),
        }),
      });
      if (res.ok) {
        setEditingRequirement(null);
        refreshData();
      }
    } catch (err) {
      console.error("Failed to update requirement:", err);
    }
  };

  // Resume conversation for an existing IR
  const handleResumeChat = async (irNode: Requirement) => {
    if (!irNode.conversationId) return;
    setCurrentIRId(irNode.id);
    setSelectedId(irNode.id);
    setChatMessages([]);
    setChatLoading(true);

    try {
      const res = await fetch(`/api/requirement/history?conversationId=${irNode.conversationId}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentSessionId(data.sessionId);
        if (data.messages) {
          setChatMessages(
            data.messages.map((m: ChatMessage) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            }))
          );
        }
        setMode("chat");
      }
    } catch (err) {
      console.error("Failed to fetch conversation:", err);
    } finally {
      setChatLoading(false);
    }
  };

  // Add AR under FuR
  const handleAddAR = async () => {
    if (!newARTitle.trim() || !selectedNode || selectedNode.type !== "fur") return;
    try {
      const res = await fetch("/api/requirement", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_ar",
          parentId: selectedNode.id,
          title: newARTitle.trim(),
        }),
      });
      if (res.ok) {
        setShowAddAR(false);
        setNewARTitle("");
        refreshData();
      }
    } catch (err) {
      console.error("Failed to create AR:", err);
    }
  };

  if (loading) {
    return (
      <div className="p-6 h-[calc(100vh-64px)] flex flex-col">
        {/* Header Skeleton */}
        <div className="flex justify-between items-center mb-4">
          <SkeletonLine width="w-32" height="h-8" />
          <SkeletonLine width="w-24" height="h-10" />
        </div>
        {/* Legend Skeleton */}
        <div className="flex gap-4 mb-4">
          <SkeletonLine width="w-24" height="h-4" />
          <SkeletonLine width="w-24" height="h-4" />
          <SkeletonLine width="w-24" height="h-4" />
        </div>
        {/* Main Content Skeleton */}
        <div className="flex-1 flex gap-4 min-h-0">
          <div className="w-80 bg-white rounded-xl border border-surface-200 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-surface-100 bg-surface-50">
              <SkeletonLine width="w-20" height="h-4" />
            </div>
            <SkeletonTree />
          </div>
          <div className="flex-1 bg-white rounded-xl border border-surface-200 overflow-hidden">
            <SkeletonDetail />
          </div>
        </div>
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
          <span className="text-gray-500">IR - 初始需求</span>
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
              <EmptyState
                title="暂无需求"
                description="点击下方按钮创建一个初始需求（IR），开启智能需求分析"
                actionLabel="+ 新建 IR"
                onAction={handleCreateIR}
              />
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
          {mode === "chat" && currentIRId ? (
            /* Chat Mode — takes priority even before SWR data arrives */
            <div className="flex flex-col h-full">
              <div className="p-3 border-b border-surface-100 bg-surface-50 flex items-center justify-between">
                <div>
                  <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700 font-medium mr-2">
                    IR
                  </span>
                  <span className="text-sm font-medium">{selectedNode?.title || "需求分析中..."}</span>
                </div>
                <button
                  onClick={() => {
                    setMode("list");
                    setCurrentSessionId(null);
                    setCurrentIRId(null);
                    setChatMessages([]);
                    setPendingResult(null);
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  关闭
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* Typing indicator while waiting for first AI message */}
                {chatMessages.length === 0 && !isStreaming && !streamingText && (chatLoading || currentSessionId) && (
                  <div className="flex justify-start">
                    <div className="bg-surface-100 text-gray-500 px-4 py-3 rounded-2xl rounded-bl-md text-sm flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      <span className="ml-2 text-gray-400">AI 正在分析需求...</span>
                    </div>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                        msg.role === "user"
                          ? "bg-brand-500 text-white rounded-br-md text-sm whitespace-pre-wrap"
                          : "bg-surface-100 text-gray-800 rounded-bl-md"
                      }`}
                    >
                      {msg.role === "user" ? (
                        msg.content
                      ) : (
                        <MarkdownContent content={msg.content} variant="chat" />
                      )}
                    </div>
                  </div>
                ))}
                {isStreaming && streamingText && (
                  <div className="flex justify-start">
                    <div className="bg-surface-100 text-gray-800 px-4 py-3 rounded-2xl rounded-bl-md">
                      <MarkdownContent content={stripAIDisplayTags(streamingText)} variant="chat" />
                      <span className="inline-block w-2 h-4 bg-brand-400 ml-0.5 align-middle animate-pulse" />
                    </div>
                  </div>
                )}

                {/* Task Breakdown Review Panel */}
                {pendingResult && (
                  <div className="mt-4 border border-green-200 rounded-xl bg-green-50 p-4">
                    <h4 className="text-sm font-semibold text-green-800 mb-1">
                      任务拆解完成
                    </h4>
                    <p className="text-xs text-green-600 mb-3">{pendingResult.summary}</p>
                    <div className="space-y-2 mb-4">
                      {pendingResult.tasks.map((task, idx) => (
                        <div
                          key={idx}
                          className="bg-white rounded-lg p-3 border border-green-100"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                              task.priority === "P0" ? "bg-red-100 text-red-700" :
                              task.priority === "P1" ? "bg-orange-100 text-orange-700" :
                              task.priority === "P2" ? "bg-yellow-100 text-yellow-700" :
                              "bg-gray-100 text-gray-600"
                            }`}>
                              {task.priority}
                            </span>
                            <span className="text-sm font-medium text-gray-900">{task.title}</span>
                          </div>
                          {task.description && (
                            <p className="text-xs text-gray-500 mb-1.5">{task.description}</p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-gray-400">
                            {task.estimatedDays > 0 && (
                              <span>{task.estimatedDays} 天</span>
                            )}
                            {task.requiredSkills && task.requiredSkills.length > 0 && (
                              <span>{task.requiredSkills.join(", ")}</span>
                            )}
                            {task.suggestedAssignee && (
                              <span className="text-blue-600">
                                {task.suggestedAssignee.memberName}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleConfirmTasks}
                        disabled={confirmLoading}
                        className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition"
                      >
                        {confirmLoading ? "分配中..." : `确认并分配 (${pendingResult.tasks.length} 个任务)`}
                      </button>
                      <button
                        onClick={() => setPendingResult(null)}
                        className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg transition"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              {!pendingResult && (
                <div className="p-3 border-t border-surface-100">
                  <div className="flex gap-2">
                    <input
                      className="flex-1 border border-surface-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                      placeholder="回答澄清问题..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                      disabled={isStreaming}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!chatInput.trim() || isStreaming}
                      className="bg-brand-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition"
                    >
                      发送
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : !selectedNode ? (
            <EmptyState
              title="选择需求查看详情"
              description="从左侧需求树选择一个需求，查看详细信息和任务分配情况"
            />
          ) : (
            /* Detail View */
            <div className="flex flex-col h-full overflow-y-auto">
              {/* Detail Header */}
              <div className="p-4 border-b border-surface-100">
                {/* Breadcrumb */}
                {(() => {
                  // Build breadcrumb path
                  const path: BreadcrumbItem[] = [selectedNode];
                  let current = selectedNode;
                  while (current.parentId) {
                    const parent = requirements.find((r) => r.id === current.parentId);
                    if (parent) {
                      path.unshift(parent);
                      current = parent;
                    } else {
                      break;
                    }
                  }
                  if (path.length > 1) {
                    return <Breadcrumb items={path} onNavigate={setSelectedId} />;
                  }
                  return null;
                })()}
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${TYPE_LABELS[selectedNode.type].color}`}>
                    {TYPE_LABELS[selectedNode.type].label}
                  </span>
                  <span className={`text-xs ${STATUS_LABELS[selectedNode.status].color}`}>
                    {STATUS_LABELS[selectedNode.status].label}
                  </span>
                  <button
                    onClick={() => handleEditRequirement(selectedNode)}
                    className="ml-auto px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition"
                  >
                    编辑
                  </button>
                </div>
                <h2 className="text-lg font-semibold text-gray-900">{selectedNode.title}</h2>
                {selectedNode.summary && (
                  <div className="text-sm text-gray-500 mt-2">
                    <MarkdownContent content={selectedNode.summary} variant="detail" />
                  </div>
                )}
                <div className="text-xs text-gray-400 mt-2">
                  创建于 {new Date(selectedNode.createdAt).toLocaleDateString("zh-CN")}
                </div>
              </div>

              {/* IR Detail */}
              {selectedNode.type === "ir" && (
                <div className="p-4 space-y-4">
                  {/* Resume conversation button */}
                  {selectedNode.conversationId && (
                    <button
                      onClick={() => handleResumeChat(selectedNode)}
                      className="w-full px-4 py-2.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-sm font-medium hover:bg-purple-100 transition"
                    >
                      继续对话
                    </button>
                  )}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">子需求 (FuR)</h3>
                    {selectedIR_FuRs.length === 0 ? (
                      <div className="text-sm text-gray-400 bg-surface-50 rounded-lg p-4 text-center">
                        暂无 FuR，通过对话分析生成
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedIR_FuRs.map((fur) => {
                          const childARs = requirements.filter(
                            (r) => r.parentId === fur.id && r.type === "ar"
                          );
                          return (
                            <div key={fur.id} className="bg-surface-50 rounded-lg overflow-hidden">
                              <div
                                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-surface-100 transition"
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
                              {/* Nested AR list under each FuR */}
                              {childARs.length > 0 && (
                                <div className="border-t border-surface-200 bg-white">
                                  {childARs.map((ar) => {
                                    const assignee = members.find((m) => m.id === ar.assigneeId);
                                    return (
                                      <div
                                        key={ar.id}
                                        className="flex items-center gap-3 px-3 py-2 pl-8 hover:bg-surface-50 cursor-pointer transition border-b border-surface-100 last:border-b-0"
                                        onClick={() => setSelectedId(ar.id)}
                                      >
                                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                                          AR
                                        </span>
                                        <span className="flex-1 text-sm truncate">{ar.title}</span>
                                        {assignee && (
                                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                            {assignee.name}
                                          </span>
                                        )}
                                        <span className={`text-xs ${
                                          ar.status === "completed" ? "text-green-600" :
                                          ar.status === "in_progress" ? "text-yellow-600" :
                                          "text-gray-400"
                                        }`}>
                                          {ar.status === "completed" ? "已完成" :
                                           ar.status === "in_progress" ? "进行中" : "待处理"}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* AR Detail - single task view */}
              {selectedNode.type === "ar" && (() => {
                const assignee = members.find((m) => m.id === selectedNode.assigneeId);
                const linkedTask = selectedARTasks[0];
                return (
                  <div className="p-4 space-y-4">
                    {selectedNode.summary && (
                      <p className="text-sm text-gray-600">{selectedNode.summary}</p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-surface-50 rounded-lg p-3">
                        <div className="text-xs text-gray-400 mb-1">责任人</div>
                        <div className="text-sm font-medium text-gray-700">
                          {assignee ? assignee.name : "未分配"}
                        </div>
                      </div>
                      <div className="bg-surface-50 rounded-lg p-3">
                        <div className="text-xs text-gray-400 mb-1">状态</div>
                        {linkedTask ? (
                          <select
                            value={linkedTask.status}
                            onChange={(e) => handleTaskStatusChange(linkedTask.id, e.target.value)}
                            className={`text-sm font-medium border-0 bg-transparent p-0 ${
                              linkedTask.status === "done"
                                ? "text-green-700"
                                : linkedTask.status === "in_progress"
                                ? "text-yellow-700"
                                : "text-blue-700"
                            }`}
                          >
                            <option value="todo">待办</option>
                            <option value="in_progress">进行中</option>
                            <option value="in_review">审核中</option>
                            <option value="done">完成</option>
                          </select>
                        ) : (
                          <div className="text-sm font-medium text-gray-700">
                            {selectedNode.status === "in_progress" ? "进行中" : selectedNode.status === "completed" ? "完成" : "待处理"}
                          </div>
                        )}
                      </div>
                      {linkedTask?.priority && (
                        <div className="bg-surface-50 rounded-lg p-3">
                          <div className="text-xs text-gray-400 mb-1">优先级</div>
                          <div className={`text-sm font-medium ${
                            linkedTask.priority === "P0" ? "text-red-600" :
                            linkedTask.priority === "P1" ? "text-orange-600" :
                            linkedTask.priority === "P2" ? "text-yellow-600" : "text-gray-600"
                          }`}>
                            {linkedTask.priority}
                          </div>
                        </div>
                      )}
                      {linkedTask?.estimatedDays && (
                        <div className="bg-surface-50 rounded-lg p-3">
                          <div className="text-xs text-gray-400 mb-1">预估工期</div>
                          <div className="text-sm font-medium text-gray-700">
                            {linkedTask.estimatedDays} 天
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* FuR Detail - show child ARs */}
              {selectedNode.type === "fur" && (() => {
                const childARs = requirements.filter(
                  (r) => r.parentId === selectedNode.id && r.type === "ar"
                );
                return (
                  <div className="p-4 space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-gray-700">
                          分配需求 (AR) - {childARs.length}
                        </h3>
                        <button
                          onClick={() => setShowAddAR(true)}
                          className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                        >
                          + 添加 AR
                        </button>
                      </div>
                      {childARs.length === 0 ? (
                        <div className="text-sm text-gray-400 bg-surface-50 rounded-lg p-4 text-center">
                          暂无 AR，使用确认功能分配任务
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {childARs.map((ar) => {
                            const assignee = members.find((m) => m.id === ar.assigneeId);
                            return (
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
                                <span className="flex-1 text-sm truncate">{ar.title}</span>
                                {assignee && (
                                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                                    {assignee.name}
                                  </span>
                                )}
                                <span className="text-xs text-gray-400">
                                  {ar.status === "in_progress" ? "进行中" : ar.status === "completed" ? "完成" : "待处理"}
                                </span>
                              </div>
                            );
                          })}
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
            {irSubmitting ? (
              <div className="flex flex-col items-center py-8">
                <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin mb-4" />
                <h3 className="text-lg font-semibold text-gray-800 mb-2">AI 正在分析需求</h3>
                <p className="text-sm text-gray-500 text-center">正在理解需求并生成澄清问题，请稍候...</p>
                <div className="w-full bg-surface-100 rounded-full h-1.5 mt-6 overflow-hidden">
                  <div className="bg-brand-500 h-full rounded-full animate-pulse" style={{ width: "60%" }} />
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-semibold mb-4">新建 IR - 初始需求</h2>
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
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit Requirement Modal */}
      {editingRequirement && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold mb-4">
              编辑 {TYPE_LABELS[editingRequirement.type].label}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  标题
                </label>
                <input
                  type="text"
                  className="w-full border border-surface-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  备注
                </label>
                <textarea
                  className="w-full border border-surface-200 rounded-lg px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-200"
                  rows={3}
                  placeholder="添加备注..."
                  value={editingSummary}
                  onChange={(e) => setEditingSummary(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingRequirement(null)}
                className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!editingTitle.trim()}
                className="bg-brand-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add AR Modal */}
      {showAddAR && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold mb-4">添加 AR - 分配需求</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                AR 标题
              </label>
              <input
                type="text"
                className="w-full border border-surface-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                placeholder="输入 AR 标题..."
                value={newARTitle}
                onChange={(e) => setNewARTitle(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleAddAR()}
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowAddAR(false); setNewARTitle(""); }}
                className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition"
              >
                取消
              </button>
              <button
                onClick={handleAddAR}
                disabled={!newARTitle.trim()}
                className="bg-blue-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
