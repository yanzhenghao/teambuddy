import { db } from "@/db";
import { members, tasks } from "@/db/schema";
import { KanbanClient } from "./kanban-client";

export const dynamic = "force-dynamic";

export default async function KanbanPage() {
  const allMembers = await db.select().from(members).all();
  const allTasks = await db.select().from(tasks).all();

  const today = new Date().toISOString().slice(0, 10);

  const tasksWithMeta = allTasks.map((t) => ({
    ...t,
    assigneeName: allMembers.find((m) => m.id === t.assigneeId)?.name || null,
    isOverdue: !!(t.dueDate && t.dueDate < today && t.status !== "done"),
  }));

  return <KanbanClient tasks={tasksWithMeta} members={allMembers} />;
}
