import { db } from "@/db";
import { riskWarnings, requirements, tasks, members } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { cachedJson, CACHE_PRESETS } from "@/lib/api-cache";

/** GET /api/risk-warnings — List risk warnings */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status"); // active | acknowledged | resolved
  const memberId = searchParams.get("memberId");

  let query = db.select().from(riskWarnings);

  const conditions = [];
  if (status) {
    conditions.push(eq(riskWarnings.status, status));
  }
  if (memberId) {
    conditions.push(eq(riskWarnings.memberId, memberId));
  }

  let warnings;
  if (conditions.length > 0) {
    warnings = await db
      .select()
      .from(riskWarnings)
      .where(and(...conditions))
      .orderBy(desc(riskWarnings.createdAt))
      .all();
  } else {
    warnings = await db
      .select()
      .from(riskWarnings)
      .orderBy(desc(riskWarnings.createdAt))
      .all();
  }

  // Enrich with requirement, task, and member names
  const reqIds = [...new Set(warnings.map((w) => w.requirementId).filter(Boolean))];
  const taskIds = [...new Set(warnings.map((w) => w.taskId).filter(Boolean))];
  const memberIds = [...new Set(warnings.map((w) => w.memberId).filter(Boolean))];

  const [relatedReqs, relatedTasks, relatedMembers] = await Promise.all([
    reqIds.length > 0
      ? db
          .select({ id: requirements.id, title: requirements.title })
          .from(requirements)
          .all()
      : [],
    taskIds.length > 0
      ? db.select({ id: tasks.id, title: tasks.title }).from(tasks).all()
      : [],
    memberIds.length > 0
      ? db.select({ id: members.id, name: members.name }).from(members).all()
      : [],
  ]);

  const reqMap = new Map(relatedReqs.map((r) => [r.id, r.title]));
  const taskMap = new Map(relatedTasks.map((t) => [t.id, t.title]));
  const memberMap = new Map(relatedMembers.map((m) => [m.id, m.name]));

  const enriched = warnings.map((w) => ({
    ...w,
    requirementTitle: w.requirementId ? reqMap.get(w.requirementId) : null,
    taskTitle: w.taskId ? taskMap.get(w.taskId) : null,
    memberName: w.memberId ? memberMap.get(w.memberId) : null,
  }));

  return cachedJson(enriched, CACHE_PRESETS.STATIC);
}

/** POST /api/risk-warnings — Generate risk warnings (scan for risks) */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const createdWarnings: string[] = [];

  // 1. Scan for overdue tasks linked to ARs
  const allTasks = await db.select().from(tasks).all();
  const allArs = await db
    .select({ id: requirements.id, title: requirements.title, status: requirements.status })
    .from(requirements)
    .where(eq(requirements.type, "ar"))
    .all();

  const arMap = new Map(allArs.map((ar) => [ar.id, ar]));
  const arTaskMap = new Map<string, typeof allTasks>();

  for (const task of allTasks) {
    if (task.requirementId) {
      if (!arTaskMap.has(task.requirementId)) {
        arTaskMap.set(task.requirementId, []);
      }
      arTaskMap.get(task.requirementId)!.push(task);
    }
  }

  for (const [arId, tasks] of arTaskMap) {
    const ar = arMap.get(arId);
    if (!ar) continue;

    for (const task of tasks) {
      if (task.status !== "done" && task.dueDate && task.dueDate < today) {
        // Check if warning already exists for this task
        const existing = await db
          .select()
          .from(riskWarnings)
          .where(
            and(
              eq(riskWarnings.taskId, task.id),
              eq(riskWarnings.type, "overdue"),
              eq(riskWarnings.status, "active")
            )
          )
          .all();

        if (existing.length === 0) {
          const id = randomUUID();
          await db.insert(riskWarnings).values({
            id,
            type: "overdue",
            severity: task.priority === "P0" ? "critical" : task.priority === "P1" ? "high" : "medium",
            title: `任务超期：${task.title}`,
            message: `任务"${task.title}"已超期（截止日期：${task.dueDate}）`,
            requirementId: arId,
            taskId: task.id,
            memberId: task.assigneeId,
            status: "active",
          }).run();
          createdWarnings.push(id);
        }
      }
    }
  }

  // 2. Scan for stale tasks (no updates in 3+ days)
  for (const task of allTasks) {
    if (task.status === "in_progress" && task.updatedAt) {
      const updatedDate = new Date(task.updatedAt);
      const daysSinceUpdate = Math.floor(
        (Date.now() - updatedDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceUpdate >= 3) {
        const existing = await db
          .select()
          .from(riskWarnings)
          .where(
            and(
              eq(riskWarnings.taskId, task.id),
              eq(riskWarnings.type, "stale"),
              eq(riskWarnings.status, "active")
            )
          )
          .all();

        if (existing.length === 0) {
          const id = randomUUID();
          await db.insert(riskWarnings).values({
            id,
            type: "stale",
            severity: "medium",
            title: `任务停滞：${task.title}`,
            message: `任务"${task.title}"已有 ${daysSinceUpdate} 天无进展`,
            requirementId: task.requirementId,
            taskId: task.id,
            memberId: task.assigneeId,
            status: "active",
          }).run();
          createdWarnings.push(id);
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    createdCount: createdWarnings.length,
    warningIds: createdWarnings,
  });
}

/** PATCH /api/risk-warnings — Update warning status (acknowledge/resolve) */
export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, status } = body;

  if (!id || !status) {
    return NextResponse.json({ error: "id and status are required" }, { status: 400 });
  }

  if (!["acknowledged", "resolved"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(riskWarnings)
    .where(eq(riskWarnings.id, id))
    .get();

  if (!existing) {
    return NextResponse.json({ error: "Warning not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = { status };
  if (status === "acknowledged") {
    updates.acknowledgedAt = new Date().toISOString();
  } else if (status === "resolved") {
    updates.resolvedAt = new Date().toISOString();
  }

  await db.update(riskWarnings).set(updates).where(eq(riskWarnings.id, id)).run();

  return NextResponse.json({ success: true });
}
