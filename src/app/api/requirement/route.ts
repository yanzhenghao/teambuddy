import {
  RequirementEngine,
  TeamMemberProfile,
  ConversationMessage,
  RequirementResult,
} from "@/services/requirement-engine";
import { db } from "@/db";
import { members, tasks, requirementConversations, requirements, requirementHistory } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/auth";

async function getTeamProfiles(): Promise<TeamMemberProfile[]> {
  // Batch query: get all active members and all their tasks in 2 queries
  const allMembers = await db
    .select()
    .from(members)
    .where(eq(members.status, "active"))
    .all();

  if (allMembers.length === 0) {
    return [];
  }

  // Get all member IDs
  const memberIds = allMembers.map((m) => m.id);

  // Batch query: get all tasks for all members at once
  const allTasks = await db.select().from(tasks).all();

  // Group tasks by assigneeId in memory
  const tasksByMember = new Map<string, typeof allTasks>();
  for (const task of allTasks) {
    if (task.assigneeId) {
      if (!tasksByMember.has(task.assigneeId)) {
        tasksByMember.set(task.assigneeId, []);
      }
      tasksByMember.get(task.assigneeId)!.push(task);
    }
  }

  const profiles: TeamMemberProfile[] = [];
  for (const m of allMembers) {
    const memberTasks = tasksByMember.get(m.id) || [];
    const currentLoad = memberTasks
      .filter((t) => t.status === "in_progress" || t.status === "in_review")
      .length;

    profiles.push({
      id: m.id,
      name: m.name,
      role: m.role,
      skills: JSON.parse(m.skills),
      maxLoad: m.maxLoad,
      currentLoad,
    });
  }

  return profiles;
}

/** GET /api/requirement — List all requirement conversations (legacy) */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const all = await db
    .select()
    .from(requirementConversations)
    .orderBy(desc(requirementConversations.createdAt))
    .all();

  return NextResponse.json(
    all.map((c) => ({
      id: c.id,
      sessionId: c.sessionId,
      requirement: c.requirement,
      result: c.result ? JSON.parse(c.result) : null,
      status: c.status,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }))
  );
}

/** POST /api/requirement — Actions: create_ir, reply, confirm */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { action, sessionId, requirement, message, tasks: confirmedTasks, irId, title, versionId } = body;

  // ---- CREATE_IR: Create new Injected Requirement ----
  if (action === "create_ir") {
    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const irIdValue = randomUUID();
    const sessionIdValue = randomUUID();
    const conversationId = randomUUID();

    // Create IR in requirements table
    await db.insert(requirements).values({
      id: irIdValue,
      parentId: null,
      title: title.trim(),
      type: "ir",
      status: "pending",
      summary: null,
      conversationId,
      taskCount: 0,
      completedTaskCount: 0,
      versionId: versionId || null,
    }).run();

    // Record creation history
    await db.insert(requirementHistory).values({
      id: randomUUID(),
      requirementId: irIdValue,
      title: title.trim(),
      summary: null,
      status: "pending",
      assigneeId: null,
      versionId: versionId || null,
      changeType: "create",
      changedBy: user.userId,
    }).run();

    // Create conversation record
    await db.insert(requirementConversations).values({
      id: conversationId,
      sessionId: sessionIdValue,
      requirement: title.trim(),
      messages: JSON.stringify([]),
      result: null,
      status: "active",
    }).run();

    // Initialize engine and start analysis (stateless, request-level)
    const teamMembers = await getTeamProfiles();
    const engine = new RequirementEngine();
    const { response } = await engine.startAnalysis(title.trim(), teamMembers);

    // Update conversation with first message
    await db
      .update(requirementConversations)
      .set({
        messages: JSON.stringify([{ role: "assistant", content: response }]),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(requirementConversations.sessionId, sessionIdValue))
      .run();

    return NextResponse.json({
      id: irIdValue,
      sessionId: sessionIdValue,
      message: response,
    });
  }

  // ---- REPLY: Continue requirement conversation ----
  if (action === "reply") {
    if (!sessionId || !message) {
      return NextResponse.json(
        { error: "sessionId and message are required" },
        { status: 400 }
      );
    }

    // Load conversation from DB (pure DB-driven, no in-memory cache)
    const conversation = await db
      .select()
      .from(requirementConversations)
      .where(eq(requirementConversations.sessionId, sessionId))
      .get();

    if (!conversation || conversation.status !== "active") {
      return NextResponse.json(
        { error: "Session not found or expired. Start a new analysis." },
        { status: 400 }
      );
    }

    // Find the IR for this conversation
    const ir = await db
      .select()
      .from(requirements)
      .where(eq(requirements.conversationId, conversation.id))
      .get();

    // Load history from DB
    const history: ConversationMessage[] = JSON.parse(conversation.messages || "[]");
    const teamMembers = await getTeamProfiles();
    const engine = new RequirementEngine();

    // Continue analysis (engine is stateless, all state passed as params)
    const { response, result } = await engine.continueAnalysis(
      conversation.requirement,
      teamMembers,
      history,
      message
    );

    // Update history
    history.push({ role: "user", content: message });
    history.push({ role: "assistant", content: response });

    // Update conversation in DB
    await db
      .update(requirementConversations)
      .set({
        messages: JSON.stringify(history),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(requirementConversations.sessionId, sessionId))
      .run();

    // If analysis complete, create FuR (Function Requirement)
    let furId: string | null = null;
    if (result) {
      // Create FuR (Function Requirement) under IR
      furId = randomUUID();
      await db.insert(requirements).values({
        id: furId,
        parentId: ir?.id || null,
        title: result.summary.slice(0, 100),
        type: "fur",
        status: "in_progress",
        summary: result.summary,
        conversationId: conversation.id,
        taskCount: result.tasks.length,
        completedTaskCount: 0,
      }).run();

      // Mark conversation as completed
      await db
        .update(requirementConversations)
        .set({
          status: "completed",
          result: JSON.stringify(result),
          messages: JSON.stringify(history),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(requirementConversations.sessionId, sessionId))
        .run();
    }

    return NextResponse.json({
      sessionId,
      message: response,
      result,
      furId,
      done: !!result,
    });
  }

  // ---- CONFIRM: Accept tasks and write them to DB ----
  // Creates FuR (if not exists) and AR with tasks allocated to specific people
  if (action === "confirm") {
    if (!confirmedTasks || !Array.isArray(confirmedTasks)) {
      return NextResponse.json(
        { error: "tasks array is required" },
        { status: 400 }
      );
    }

    if (!irId) {
      return NextResponse.json(
        { error: "irId is required for confirm action" },
        { status: 400 }
      );
    }

    // Pre-fetch FuR (outside transaction - read only)
    let furRecord = await db
      .select()
      .from(requirements)
      .where(eq(requirements.parentId, irId))
      .get();

    // Pre-fetch assignee names (outside transaction - read only)
    const assigneeIds = [...new Set(confirmedTasks.map((t) => t.suggestedAssignee?.memberId).filter(Boolean))];
    const assigneeMap = new Map<string, string>();
    if (assigneeIds.length > 0) {
      const assigneeRecords = await db.select().from(members).all();
      for (const m of assigneeRecords) {
        if (assigneeIds.includes(m.id)) {
          assigneeMap.set(m.id, m.name);
        }
      }
    }

    // Group tasks by suggested assignee to create AR per person
    const tasksByAssignee = new Map<string, typeof confirmedTasks>();
    for (const t of confirmedTasks) {
      const assigneeId = t.suggestedAssignee?.memberId || "unassigned";
      if (!tasksByAssignee.has(assigneeId)) {
        tasksByAssignee.set(assigneeId, []);
      }
      tasksByAssignee.get(assigneeId)!.push(t);
    }

    const arIds: string[] = [];
    const totalTasks = confirmedTasks.length;

    // Execute all writes inside a transaction
    await db.transaction(async (tx) => {
      // Create FuR if not exists
      if (!furRecord || furRecord.type !== "fur") {
        const furId = randomUUID();
        await tx.insert(requirements).values({
          id: furId,
          parentId: irId,
          title: "功能需求",
          type: "fur",
          status: "in_progress",
          summary: null,
          taskCount: 0,
          completedTaskCount: 0,
        });
        furRecord = await tx.select().from(requirements).where(eq(requirements.id, furId)).get();
      }

      if (!furRecord) {
        throw new Error("Failed to create FuR");
      }

      // Create AR per assignee and link tasks to AR
      for (const [assigneeId, assigneeTasks] of tasksByAssignee) {
        const arId = randomUUID();
        const assigneeName = assigneeId === "unassigned"
          ? "未分配"
          : assigneeMap.get(assigneeId) || "未知";

        await tx.insert(requirements).values({
          id: arId,
          parentId: furRecord.id,
          title: `[AR] ${assigneeName}`,
          type: "ar",
          status: "in_progress",
          summary: `分配给 ${assigneeName} 的任务`,
          assigneeId: assigneeId === "unassigned" ? null : assigneeId,
          taskCount: assigneeTasks.length,
          completedTaskCount: 0,
        });
        arIds.push(arId);

        // Create tasks linked to AR
        for (const t of assigneeTasks) {
          const taskId = `t${Date.now()}-${randomUUID().slice(0, 4)}`;
          const taskAssigneeId = t.suggestedAssignee?.memberId || null;

          await tx.insert(tasks).values({
            id: taskId,
            title: t.title,
            description: t.description,
            assigneeId: taskAssigneeId,
            priority: t.priority || "P2",
            status: taskAssigneeId ? "todo" : "unassigned",
            category: t.category || "feature",
            estimatedDays: t.estimatedDays || null,
            createdFrom: "requirement_analysis",
            requirementId: arId,
          });
        }
      }

      // Update FuR task count
      await tx
        .update(requirements)
        .set({
          taskCount: totalTasks,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(requirements.id, furRecord.id));
    });

    // Re-fetch to ensure we have the final state
    const finalFur = await db
      .select()
      .from(requirements)
      .where(eq(requirements.id, furRecord!.id))
      .get();

    return NextResponse.json({
      created: totalTasks,
      furId: finalFur?.id || furRecord!.id,
      arIds,
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

/** PATCH /api/requirement — Edit requirement (title, summary, status, versionId) */
export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, title, summary, status, versionId } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(requirements)
    .where(eq(requirements.id, id))
    .get();

  if (!existing) {
    return NextResponse.json({ error: "Requirement not found" }, { status: 404 });
  }

  // Record history before making changes
  await db.insert(requirementHistory).values({
    id: randomUUID(),
    requirementId: existing.id,
    title: existing.title,
    summary: existing.summary,
    status: existing.status,
    assigneeId: existing.assigneeId,
    versionId: existing.versionId,
    changeType: "update",
    changedBy: user.userId,
  }).run();

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (title !== undefined) updates.title = title.trim();
  if (summary !== undefined) updates.summary = summary;
  if (status !== undefined) updates.status = status;
  if (versionId !== undefined) updates.versionId = versionId;

  await db
    .update(requirements)
    .set(updates)
    .where(eq(requirements.id, id))
    .run();

  const updated = await db
    .select()
    .from(requirements)
    .where(eq(requirements.id, id))
    .get();

  return NextResponse.json(updated);
}

/** POST /api/requirement — Additional actions: create_fur, create_ar */
export async function PUT(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { action, parentId, title, type, summary, versionId } = body;

  // ---- CREATE_FUR: Freely insert FuR under any requirement (or root) ----
  if (action === "create_fur") {
    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const furId = randomUUID();
    await db.insert(requirements).values({
      id: furId,
      parentId: parentId || null,
      title: title.trim(),
      type: "fur",
      status: "pending",
      summary: summary || null,
      taskCount: 0,
      completedTaskCount: 0,
      versionId: versionId || null,
    }).run();

    // Record creation history
    await db.insert(requirementHistory).values({
      id: randomUUID(),
      requirementId: furId,
      title: title.trim(),
      summary: summary || null,
      status: "pending",
      assigneeId: null,
      versionId: versionId || null,
      changeType: "create",
      changedBy: user.userId,
    }).run();

    return NextResponse.json({ id: furId, parentId: parentId || null, type: "fur" });
  }

  // ---- CREATE_AR: Freely insert AR under any requirement (or root) ----
  if (action === "create_ar") {
    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const arId = randomUUID();
    const { assigneeId } = body;

    await db.insert(requirements).values({
      id: arId,
      parentId: parentId || null,
      title: title.trim(),
      type: "ar",
      status: "pending",
      summary: summary || null,
      assigneeId: assigneeId || null,
      taskCount: 0,
      completedTaskCount: 0,
      versionId: versionId || null,
    }).run();

    // Record creation history
    await db.insert(requirementHistory).values({
      id: randomUUID(),
      requirementId: arId,
      title: title.trim(),
      summary: summary || null,
      status: "pending",
      assigneeId: assigneeId || null,
      versionId: versionId || null,
      changeType: "create",
      changedBy: user.userId,
    }).run();

    return NextResponse.json({ id: arId, parentId: parentId || null, type: "ar", assigneeId });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
