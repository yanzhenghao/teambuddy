import { db } from "@/db";
import { tasks, requirements } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: taskId, status } = await request.json();

  if (!taskId || !status) {
    return NextResponse.json(
      { error: "id (taskId) and status are required" },
      { status: 400 }
    );
  }

  // Members can only update their own tasks
  if (user.role !== "admin") {
    const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).get();
    if (!task || task.assigneeId !== user.userId) {
      return NextResponse.json({ error: "无权修改此任务" }, { status: 403 });
    }
  }

  const validStatuses = ["unassigned", "todo", "in_progress", "in_review", "done"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
      { status: 400 }
    );
  }

  const updateData: Record<string, string> = {
    status,
    updatedAt: new Date().toISOString(),
  };

  if (status === "done") {
    updateData.completedDate = new Date().toISOString().slice(0, 10);
  }

  await db.update(tasks).set(updateData).where(eq(tasks.id, taskId)).run();

  // Update AR task counts
  const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).get();
  if (task?.requirementId) {
    const arTasks = await db.select().from(tasks).where(eq(tasks.requirementId, task.requirementId)).all();
    const completedCount = arTasks.filter((t) => t.status === "done").length;

    await db
      .update(requirements)
      .set({
        completedTaskCount: completedCount,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(requirements.id, task.requirementId))
      .run();

    // If all tasks done, create FuR (Fulfilled Requirement)
    if (completedCount === arTasks.length && arTasks.length > 0) {
      const ar = await db.select().from(requirements).where(eq(requirements.id, task.requirementId)).get();
      if (ar && ar.type === "ar" && ar.status !== "completed") {
        // Create FuR as child of AR
        const furId = `fur-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        await db.insert(requirements).values({
          id: furId,
          parentId: ar.id,
          title: ar.title,
          type: "fur",
          status: "completed",
          summary: ar.summary,
          conversationId: ar.conversationId,
          taskCount: arTasks.length,
          completedTaskCount: arTasks.length,
        }).run();

        // Update AR status to completed
        await db
          .update(requirements)
          .set({
            status: "completed",
            updatedAt: new Date().toISOString(),
          })
          .where(eq(requirements.id, ar.id))
          .run();
      }
    }
  }

  return NextResponse.json({ success: true });
}
