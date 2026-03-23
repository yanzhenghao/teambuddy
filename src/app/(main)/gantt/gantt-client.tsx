"use client";

interface GanttTask {
  id: string;
  title: string;
  assigneeName: string;
  assigneeId: string | null;
  status: string;
  startDate: string;
  dueDate: string;
  completedDate: string | null;
  isOverdue: boolean;
}

const avatarColors: Record<string, string> = {
  m1: "bg-blue-500",
  m2: "bg-purple-500",
  m3: "bg-emerald-500",
  m4: "bg-orange-500",
};

const barColors: Record<string, string> = {
  done: "bg-green-400",
  in_progress: "bg-blue-400",
  todo: "bg-gray-300",
  unassigned: "bg-gray-200",
};

export function GanttClient({ tasks, today }: { tasks: GanttTask[]; today: string }) {
  // Calculate date range: min start - 2 days to max due + 3 days
  const allDates = tasks.flatMap((t) => [t.startDate, t.dueDate]);
  const minDate = new Date(
    Math.min(...allDates.map((d) => new Date(d).getTime())) - 2 * 86400000
  );
  const maxDate = new Date(
    Math.max(...allDates.map((d) => new Date(d).getTime())) + 3 * 86400000
  );

  const days: string[] = [];
  const cursor = new Date(minDate);
  while (cursor <= maxDate) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  const totalDays = days.length;

  function dayIndex(dateStr: string) {
    const idx = days.indexOf(dateStr);
    return idx >= 0 ? idx : 0;
  }

  function formatDay(dateStr: string) {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">甘特图</h1>

      <div className="bg-white rounded-xl border border-surface-200 overflow-x-auto">
        {/* Header */}
        <div className="flex border-b border-surface-200 sticky top-0 bg-white z-10">
          <div className="w-52 shrink-0 p-3 bg-surface-50 border-r border-surface-200">
            <span className="text-xs font-semibold text-gray-400 uppercase">任务</span>
          </div>
          <div className="flex flex-1">
            {days.map((day) => (
              <div
                key={day}
                className={`flex-1 min-w-[40px] p-1.5 text-center border-r border-surface-100 ${
                  day === today ? "bg-brand-50" : ""
                }`}
              >
                <div className={`text-[10px] ${day === today ? "text-brand-600 font-bold" : "text-gray-400"}`}>
                  {day === today ? "今天" : formatDay(day)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rows */}
        {tasks.map((task) => {
          const startIdx = dayIndex(task.startDate);
          const endIdx = dayIndex(task.dueDate);
          const leftPct = (startIdx / totalDays) * 100;
          const widthPct = ((endIdx - startIdx + 1) / totalDays) * 100;

          return (
            <div key={task.id} className={`flex border-b border-surface-100 ${task.isOverdue ? "hover:bg-red-50" : "hover:bg-surface-50"}`}>
              <div className="w-52 shrink-0 p-3 border-r border-surface-200 flex items-center gap-2">
                <div className={`w-6 h-6 ${avatarColors[task.assigneeId || ""] || "bg-gray-400"} rounded-full flex items-center justify-center text-white text-[10px] font-semibold`}>
                  {task.assigneeName[0]}
                </div>
                <div>
                  <div className={`text-sm ${task.isOverdue ? "text-red-600" : ""}`}>{task.title}</div>
                  <div className={`text-[10px] ${task.isOverdue ? "text-red-400" : "text-gray-400"}`}>
                    {task.assigneeName}
                    {task.isOverdue && " \u00b7 超期!"}
                  </div>
                </div>
              </div>
              <div className="flex-1 flex items-center relative" style={{ minHeight: 44 }}>
                <div
                  className="absolute h-7 rounded"
                  style={{ left: `${leftPct}%`, width: `${widthPct}%`, padding: "0 2px" }}
                >
                  <div className={`h-full rounded flex items-center px-2 ${
                    task.isOverdue
                      ? "bg-red-100 border border-red-200"
                      : task.status === "done"
                        ? "bg-green-100"
                        : task.status === "todo"
                          ? "bg-gray-100 border border-dashed border-gray-300"
                          : "bg-blue-100"
                  }`}>
                    <div
                      className={`h-full rounded ${task.isOverdue ? "bg-red-400" : barColors[task.status] || "bg-gray-300"}`}
                      style={{
                        width: task.status === "done" ? "100%" : task.status === "in_progress" ? "60%" : "0%",
                      }}
                    />
                    <span className="text-[10px] ml-1 font-medium text-gray-500 whitespace-nowrap">
                      {task.status === "done" ? "已完成" : task.status === "todo" ? "待开始" : ""}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-6 text-xs text-gray-400">
        <div className="flex items-center gap-1.5"><div className="w-3 h-2 bg-green-400 rounded-sm" /> 已完成</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-2 bg-blue-400 rounded-sm" /> 进行中</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-2 bg-red-400 rounded-sm" /> 超期</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-2 bg-gray-200 rounded-sm border border-dashed border-gray-300" /> 待开始</div>
      </div>
    </div>
  );
}
