import {
  RequirementEngine,
  TeamMemberProfile,
  ConversationMessage,
  RequirementResult,
} from "@/services/requirement-engine";
import { db } from "@/db";
import { members, tasks, requirementConversations, requirements } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

// In-memory session state
const activeSessions = new Map<
  string,
  {
    engine: RequirementEngine;
    history: ConversationMessage[];
    requirement: string;
    teamMembers: TeamMemberProfile[];
    dbId: string;
    irId: string | null;
  }
>();

async function getTeamProfiles(): Promise<TeamMemberProfile[]> {
  const allMembers = await db
    .select()
    .from(members)
    .where(eq(members.status, "active"))
    .all();

  const profiles: TeamMemberProfile[] = [];
  for (const m of allMembers) {
    const allMemberTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.assigneeId, m.id))
      .all();
    const currentLoad = allMemberTasks
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
export async function GET() {
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
  const body = await request.json();
  const { action, sessionId, requirement, message, tasks: confirmedTasks, irId, title } = body;

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

    // Initialize session
    const teamMembers = await getTeamProfiles();
    const engine = new RequirementEngine();
    const { response } = await engine.startAnalysis(title.trim(), teamMembers);

    activeSessions.set(sessionIdValue, {
      engine,
      history: [{ role: "assistant", content: response }],
      requirement: title.trim(),
      teamMembers,
      dbId: conversationId,
      irId: irIdValue,
    });

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

    const session = activeSessions.get(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Session not found. Start a new analysis." },
        { status: 400 }
      );
    }

    const { response, result } = await session.engine.continueAnalysis(
      session.requirement,
      session.teamMembers,
      session.history,
      message
    );

    session.history.push({ role: "user", content: message });
    session.history.push({ role: "assistant", content: response });

    // Update conversation in DB
    await db
      .update(requirementConversations)
      .set({
        messages: JSON.stringify(session.history),
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
        parentId: session.irId,
        title: result.summary.slice(0, 100),
        type: "fur",
        status: "in_progress",
        summary: result.summary,
        conversationId: session.dbId,
        taskCount: result.tasks.length,
        completedTaskCount: 0,
      }).run();

      // Mark conversation as completed
      await db
        .update(requirementConversations)
        .set({
          status: "completed",
          result: JSON.stringify(result),
          messages: JSON.stringify(session.history),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(requirementConversations.sessionId, sessionId))
        .run();

      activeSessions.delete(sessionId);
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

    // Find the FuR under this IR
    const furRecord = await db
      .select()
      .from(requirements)
      .where(eq(requirements.parentId, irId))
      .get();

    if (!furRecord || furRecord.type !== "fur") {
      return NextResponse.json(
        { error: "FuR not found. Complete requirement analysis first." },
        { status: 400 }
      );
    }

    const created: string[] = [];

    for (const t of confirmedTasks) {
      const id = `t${Date.now()}-${randomUUID().slice(0, 4)}`;
      const assigneeId = t.suggestedAssignee?.memberId || null;

      await db.insert(tasks)
        .values({
          id,
          title: t.title,
          description: t.description,
          assigneeId,
          priority: t.priority || "P2",
          status: assigneeId ? "todo" : "unassigned",
          category: t.category || "feature",
          estimatedDays: t.estimatedDays || null,
          createdFrom: "requirement_analysis",
          requirementId: furRecord.id,
        })
        .run();

      created.push(id);
    }

    // Update FuR task count
    await db
      .update(requirements)
      .set({
        taskCount: created.length,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(requirements.id, furRecord.id))
      .run();

    return NextResponse.json({
      created: created.length,
      taskIds: created,
      furId: furRecord.id,
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

/** PATCH /api/requirement — Edit requirement (title, summary, status) */
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, title, summary, status } = body;

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

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (title !== undefined) updates.title = title.trim();
  if (summary !== undefined) updates.summary = summary;
  if (status !== undefined) updates.status = status;

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
  const body = await request.json();
  const { action, parentId, title, type, summary } = body;

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
    }).run();

    return NextResponse.json({ id: furId, parentId: parentId || null, type: "fur" });
  }

  // ---- CREATE_AR: Freely insert AR under any requirement (or root) ----
  if (action === "create_ar") {
    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const arId = randomUUID();
    await db.insert(requirements).values({
      id: arId,
      parentId: parentId || null,
      title: title.trim(),
      type: "ar",
      status: "pending",
      summary: summary || null,
      taskCount: 0,
      completedTaskCount: 0,
    }).run();

    return NextResponse.json({ id: arId, parentId: parentId || null, type: "ar" });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
