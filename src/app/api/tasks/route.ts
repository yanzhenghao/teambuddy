import { db } from "@/db";
import { tasks, requirements } from "@/db/schema";
import { NextRequest, NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getCurrentUser, requireAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const versionId = searchParams.get("versionId");

  let allTasks;

  if (versionId) {
    // Filter tasks by version: get ARs with this versionId, then get their tasks
    const arsWithVersion = await db
      .select({ id: requirements.id })
      .from(requirements)
      .where(eq(requirements.versionId, versionId))
      .all();

    const arIds = arsWithVersion.map((ar) => ar.id);

    if (arIds.length === 0) {
      return NextResponse.json([]);
    }

    allTasks = await db
      .select()
      .from(tasks)
      .where(inArray(tasks.requirementId, arIds))
      .all();
  } else {
    allTasks = await db.select().from(tasks).all();
  }

  // Members only see their own tasks
  if (user.role !== "admin") {
    allTasks = allTasks.filter((t) => t.assigneeId === user.userId);
  }

  return NextResponse.json(allTasks);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, description, assigneeId, priority, category, estimatedDays, dueDate } = body;

  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  // Non-admin users can only assign tasks to themselves
  if (user.role !== "admin" && assigneeId && assigneeId !== user.userId) {
    return NextResponse.json({ error: "只有管理员可以分配任务给他人" }, { status: 403 });
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  await db.insert(tasks).values({
    id,
    title,
    description: description || null,
    assigneeId: assigneeId || null,
    priority: priority || "P2",
    status: assigneeId ? "todo" : "unassigned",
    category: category || "feature",
    estimatedDays: estimatedDays || null,
    dueDate: dueDate || null,
    createdAt: now,
    updatedAt: now,
  }).run();

  return NextResponse.json({ id, success: true });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { taskId, title, description, assigneeId, priority, category, estimatedDays, dueDate } = body;
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  // Non-admin users can only modify their own tasks
  if (user.role !== "admin") {
    const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).get();
    if (!task || task.assigneeId !== user.userId) {
      return NextResponse.json({ error: "无权修改此任务" }, { status: 403 });
    }
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (assigneeId !== undefined) {
    // Only admins can reassign tasks
    if (user.role !== "admin") {
      return NextResponse.json({ error: "只有管理员可以重新分配任务" }, { status: 403 });
    }
    updateData.assigneeId = assigneeId;
  }
  if (priority !== undefined) updateData.priority = priority;
  if (category !== undefined) updateData.category = category;
  if (estimatedDays !== undefined) updateData.estimatedDays = estimatedDays;
  if (dueDate !== undefined) updateData.dueDate = dueDate;
  if (assigneeId !== undefined) updateData.status = assigneeId ? "todo" : "unassigned";

  await db.update(tasks).set(updateData).where(eq(tasks.id, taskId)).run();
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const forbidden = await requireAdmin(request);
  if (forbidden) return forbidden;

  const { taskId } = await request.json();
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  await db.delete(tasks).where(eq(tasks.id, taskId)).run();
  return NextResponse.json({ success: true });
}
