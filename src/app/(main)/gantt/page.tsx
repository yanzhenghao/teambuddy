import { db } from "@/db";
import { members, tasks } from "@/db/schema";
import { GanttClient } from "./gantt-client";

export const dynamic = "force-dynamic";

export default async function GanttPage() {
  const allMembers = await db.select().from(members).all();
  const allTasksRaw = await db
    .select()
    .from(tasks)
    .all();
  const allTasks = allTasksRaw.filter((t) => t.startDate);

  const today = new Date().toISOString().slice(0, 10);

  const ganttData = allTasks.map((t) => ({
    id: t.id,
    title: t.title,
    assigneeName: allMembers.find((m) => m.id === t.assigneeId)?.name || "未分配",
    assigneeId: t.assigneeId,
    status: t.status,
    startDate: t.startDate!,
    dueDate: t.dueDate || t.startDate!,
    completedDate: t.completedDate,
    isOverdue: !!(t.dueDate && t.dueDate < today && t.status !== "done"),
  }));

  return <GanttClient tasks={ganttData} today={today} />;
}
