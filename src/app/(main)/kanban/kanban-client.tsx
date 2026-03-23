"use client";

import { useState, DragEvent } from "react";

interface Task {
  id: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  priority: string;
  status: string;
  category: string | null;
  estimatedDays: number | null;
  dueDate: string | null;
  isOverdue: boolean;
}

interface Member {
  id: string;
  name: string;
}

interface TaskFormData {
  title: string;
  description: string;
  assigneeId: string;
  priority: string;
  category: string;
  estimatedDays: string;
  dueDate: string;
}

const columns = [
  { key: "unassigned", label: "待分配", dotColor: "bg-gray-400", badgeBg: "bg-gray-100", badgeText: "text-gray-500" },
  { key: "todo", label: "待开始", dotColor: "bg-blue-400", badgeBg: "bg-blue-100", badgeText: "text-blue-500" },
  { key: "in_progress", label: "进行中", dotColor: "bg-amber-400", badgeBg: "bg-amber-100", badgeText: "text-amber-500" },
  { key: "done", label: "已完成", dotColor: "bg-green-400", badgeBg: "bg-green-100", badgeText: "text-green-500" },
];

const categoryLabels: Record<string, { label: string; color: string }> = {
  feature: { label: "功能", color: "bg-blue-100 text-blue-600" },
  bug: { label: "Bug", color: "bg-red-100 text-red-600" },
  optimization: { label: "优化", color: "bg-orange-100 text-orange-600" },
  test: { label: "测试", color: "bg-green-100 text-green-600" },
  new_req: { label: "新需求", color: "bg-purple-100 text-purple-600" },
};

const avatarColors: Record<string, string> = {
  m1: "bg-blue-500",
  m2: "bg-purple-500",
  m3: "bg-emerald-500",
  m4: "bg-orange-500",
};

export function KanbanClient({
  tasks: initialTasks,
  members,
}: {
  tasks: Task[];
  members: Member[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [filter, setFilter] = useState("all");
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState<TaskFormData>({
    title: "",
    description: "",
    assigneeId: "",
    priority: "P2",
    category: "feature",
    estimatedDays: "",
    dueDate: "",
  });

  const openCreateModal = () => {
    setEditingTask(null);
    setFormData({
      title: "",
      description: "",
      assigneeId: "",
      priority: "P2",
      category: "feature",
      estimatedDays: "",
      dueDate: "",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || "",
      assigneeId: task.assigneeId || "",
      priority: task.priority,
      category: task.category || "feature",
      estimatedDays: task.estimatedDays?.toString() || "",
      dueDate: task.dueDate ? task.dueDate.split("T")[0] : "",
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTask(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    try {
      if (editingTask) {
        // Update existing task
        const response = await fetch("/api/tasks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId: editingTask.id,
            title: formData.title,
            description: formData.description || null,
            assigneeId: formData.assigneeId || null,
            priority: formData.priority,
            category: formData.category,
            estimatedDays: formData.estimatedDays ? parseInt(formData.estimatedDays) : null,
            dueDate: formData.dueDate || null,
          }),
        });
        if (response.ok) {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === editingTask.id
                ? {
                    ...t,
                    title: formData.title,
                    description: formData.description || null,
                    assigneeId: formData.assigneeId || null,
                    assigneeName: members.find((m) => m.id === formData.assigneeId)?.name || null,
                    priority: formData.priority,
                    category: formData.category,
                    estimatedDays: formData.estimatedDays ? parseInt(formData.estimatedDays) : null,
                    dueDate: formData.dueDate || null,
                    status: formData.assigneeId ? (t.status === "unassigned" ? "todo" : t.status) : "unassigned",
                  }
                : t
            )
          );
          closeModal();
        }
      } else {
        // Create new task
        const response = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formData.title,
            description: formData.description || null,
            assigneeId: formData.assigneeId || null,
            priority: formData.priority,
            category: formData.category,
            estimatedDays: formData.estimatedDays ? parseInt(formData.estimatedDays) : null,
            dueDate: formData.dueDate || null,
          }),
        });
        if (response.ok) {
          const { id } = await response.json();
          const newTask: Task = {
            id,
            title: formData.title,
            description: formData.description || null,
            assigneeId: formData.assigneeId || null,
            assigneeName: members.find((m) => m.id === formData.assigneeId)?.name || null,
            priority: formData.priority,
            status: formData.assigneeId ? "todo" : "unassigned",
            category: formData.category,
            estimatedDays: formData.estimatedDays ? parseInt(formData.estimatedDays) : null,
            dueDate: formData.dueDate || null,
            isOverdue: false,
          };
          setTasks((prev) => [...prev, newTask]);
          closeModal();
        }
      }
    } catch (error) {
      console.error("Failed to save task:", error);
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm("确定要删除这个任务吗？")) return;
    try {
      const response = await fetch("/api/tasks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      if (response.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
      }
    } catch (error) {
      console.error("Failed to delete task:", error);
    }
  };

  const filteredTasks =
    filter === "all"
      ? tasks
      : tasks.filter((t) => t.assigneeId === filter);

  function handleDragStart(e: DragEvent, taskId: string) {
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: DragEvent, colKey: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(colKey);
  }

  function handleDragLeave() {
    setDragOverCol(null);
  }

  async function handleDrop(e: DragEvent, newStatus: string) {
    e.preventDefault();
    setDragOverCol(null);

    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    // Persist to server
    try {
      await fetch("/api/tasks/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, status: newStatus }),
      });
    } catch {
      // Revert on error
      setTasks(initialTasks);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">看板</h1>
        <div className="flex items-center gap-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="text-sm border border-surface-200 rounded-lg px-3 py-2 bg-white"
          >
            <option value="all">全部成员</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button
            onClick={openCreateModal}
            className="bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 transition"
          >
            + 新建任务
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-5">
        {columns.map((col) => {
          const colTasks = filteredTasks.filter((t) =>
            col.key === "in_progress"
              ? t.status === "in_progress" || t.status === "in_review"
              : t.status === col.key
          );

          return (
            <div
              key={col.key}
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.key)}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-2.5 h-2.5 ${col.dotColor} rounded-full`} />
                <span className="text-sm font-semibold text-gray-600">
                  {col.label}
                </span>
                <span
                  className={`text-xs ${col.badgeBg} ${col.badgeText} px-1.5 py-0.5 rounded-full ml-1`}
                >
                  {colTasks.length}
                </span>
              </div>
              <div
                className={`min-h-[400px] space-y-3 rounded-xl p-2 transition-colors ${
                  dragOverCol === col.key
                    ? "bg-brand-50 border-2 border-dashed border-brand-300"
                    : "border-2 border-transparent"
                }`}
              >
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                  >
                    <TaskCard task={task} onEdit={openEditModal} onDelete={handleDelete} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 text-center">
        拖拽任务卡片到不同列可改变状态
      </p>

      {/* Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md mx-4 shadow-2xl">
            <div className="flex justify-between items-center px-6 py-4 border-b border-surface-200">
              <h2 className="text-lg font-semibold">
                {editingTask ? "编辑任务" : "新建任务"}
              </h2>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  标题 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="输入任务标题"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
                  rows={3}
                  placeholder="输入任务描述"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    负责人
                  </label>
                  <select
                    value={formData.assigneeId}
                    onChange={(e) => setFormData({ ...formData, assigneeId: e.target.value })}
                    className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  >
                    <option value="">待分配</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    优先级
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  >
                    <option value="P0">P0</option>
                    <option value="P1">P1</option>
                    <option value="P2">P2</option>
                    <option value="P3">P3</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    类别
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  >
                    <option value="feature">功能</option>
                    <option value="bug">Bug</option>
                    <option value="optimization">优化</option>
                    <option value="test">测试</option>
                    <option value="new_req">新需求</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    预估天数
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.estimatedDays}
                    onChange={(e) => setFormData({ ...formData, estimatedDays: e.target.value })}
                    className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    placeholder="天数"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  截止日期
                </label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 border border-surface-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 transition"
                >
                  {editingTask ? "保存" : "创建"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, onEdit, onDelete }: { task: Task; onEdit: (task: Task) => void; onDelete: (taskId: string) => void }) {
  const cat = categoryLabels[task.category || ""] || {
    label: task.category,
    color: "bg-gray-100 text-gray-600",
  };

  return (
    <div
      className={`bg-white rounded-xl p-4 border hover:shadow-md transition cursor-grab active:cursor-grabbing active:shadow-lg ${
        task.isOverdue
          ? "border-red-200 border-l-4 border-l-red-400"
          : "border-surface-200"
      } ${task.status === "done" ? "opacity-70" : ""}`}
    >
      <div className="flex justify-between items-start">
        <span className={`text-xs px-2 py-0.5 rounded-full ${cat.color}`}>
          {cat.label}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(task); }}
            className="w-6 h-6 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition"
            title="编辑"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
            className="w-6 h-6 rounded-full hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500 transition"
            title="删除"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          {task.isOverdue ? (
            <span className="text-xs text-red-500 font-medium animate-pulse ml-1">
              超期!
            </span>
          ) : (
            <span className="text-xs text-gray-400 ml-1">{task.priority}</span>
          )}
        </div>
      </div>
      <p
        className={`text-sm font-medium mt-2 ${
          task.status === "done" ? "line-through text-gray-400" : ""
        }`}
      >
        {task.title}
      </p>
      {task.description && (
        <p className="text-xs text-gray-400 mt-1 truncate">
          {task.description}
        </p>
      )}
      <div className="flex justify-between items-center mt-3 pt-3 border-t border-surface-100">
        <span className="text-xs text-gray-400">
          {task.estimatedDays ? `预估 ${task.estimatedDays} 天` : ""}
        </span>
        {task.assigneeId ? (
          <div
            className={`w-6 h-6 ${avatarColors[task.assigneeId] || "bg-gray-400"} rounded-full flex items-center justify-center text-white text-[10px] font-semibold`}
          >
            {task.assigneeName?.[0] || "?"}
          </div>
        ) : (
          <span className="text-xs text-gray-300">待分配</span>
        )}
      </div>
    </div>
  );
}
