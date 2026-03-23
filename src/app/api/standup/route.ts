import { DialogueEngine, StandupContext } from "@/services/dialogue-engine";
import { db } from "@/db";
import { members, tasks, dailyUpdates, conversations } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/auth";

// In-memory conversation state for web-based standup
const activeConversations = new Map<
  string,
  {
    engine: DialogueEngine;
    history: { role: "user" | "assistant"; content: string }[];
    context: StandupContext;
    conversationId: string;
  }
>();

const roleLabels: Record<string, string> = {
  frontend: "前端开发",
  backend: "后端开发",
  fullstack: "全栈开发",
  test: "测试工程师",
};

async function buildContext(memberId: string): Promise<StandupContext | null> {
  const member = await db
    .select()
    .from(members)
    .where(eq(members.id, memberId))
    .get();
  if (!member) return null;

  const prevUpdate = await db
    .select()
    .from(dailyUpdates)
    .where(eq(dailyUpdates.memberId, memberId))
    .orderBy(desc(dailyUpdates.date))
    .limit(1)
    .get();

  // Get conversation history for conversationCount and lastMood
  const memberConversations = await db
    .select()
    .from(conversations)
    .where(eq(conversations.memberId, memberId))
    .orderBy(desc(conversations.createdAt))
    .all();

  // Count completed conversations as proxy for conversation experience
  const conversationCount = memberConversations.filter(
    (c) => c.status === "completed"
  ).length;

  // Get last mood from previous update
  const lastMood = prevUpdate?.mood || undefined;

  // Get all non-done tasks so LLM can transition their status
  const allMemberTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.assigneeId, memberId))
    .all();
  const memberTasks = allMemberTasks.filter((t) => t.status !== "done");

  return {
    memberName: member.name,
    memberRole: roleLabels[member.role] || member.role,
    previousUpdate: prevUpdate
      ? {
          completedItems: JSON.parse(prevUpdate.completedItems),
          plannedItems: JSON.parse(prevUpdate.plannedItems),
          blockers: JSON.parse(prevUpdate.blockers),
        }
      : null,
    currentTasks: memberTasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      dueDate: t.dueDate,
    })),
    conversationCount,
    lastMood,
  };
}

async function applyTaskUpdates(
  taskUpdates: { task_id: string; new_status: string }[]
): Promise<number> {
  let updated = 0;
  const validStatuses = ["todo", "in_progress", "in_review", "done"];

  for (const tu of taskUpdates) {
    if (!tu.task_id || !validStatuses.includes(tu.new_status)) continue;

    const updateData: Record<string, string> = {
      status: tu.new_status,
      updatedAt: new Date().toISOString(),
    };
    if (tu.new_status === "done") {
      updateData.completedDate = new Date().toISOString().slice(0, 10);
    }

    await db.update(tasks).set(updateData).where(eq(tasks.id, tu.task_id)).run();
    updated++;
  }

  return updated;
}

/** POST /api/standup — Start or continue a standup conversation */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { memberId, message, action } = body;

  if (!memberId) {
    return NextResponse.json(
      { error: "memberId is required" },
      { status: 400 }
    );
  }

  // Members can only manage their own standup
  if (user.role !== "admin" && memberId !== user.userId) {
    return NextResponse.json({ error: "无权操作他人的 standup" }, { status: 403 });
  }

  // ---- START ----
  if (action === "start") {
    const ctx = await buildContext(memberId);
    if (!ctx) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const engine = new DialogueEngine();
    const opening = await engine.startConversation(ctx);

    // Check if there's already a pending conversation for today
    const existingPending = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.memberId, memberId),
          eq(conversations.date, today),
          eq(conversations.status, "pending")
        )
      )
      .get();

    let convId: string;

    if (existingPending) {
      // Resume pending conversation
      convId = existingPending.id;
      await db.update(conversations)
        .set({ status: "in_progress", startedAt: new Date().toISOString() })
        .where(eq(conversations.id, convId))
        .run();
    } else {
      // Create new conversation
      convId = randomUUID();
      await db.insert(conversations)
        .values({
          id: convId,
          memberId,
          date: today,
          status: "in_progress",
          startedAt: new Date().toISOString(),
        })
        .run();
    }

    activeConversations.set(memberId, {
      engine,
      history: [{ role: "assistant", content: opening }],
      context: ctx,
      conversationId: convId,
    });

    return NextResponse.json({
      conversationId: convId,
      message: opening,
      done: false,
    });
  }

  // ---- REPLY ----
  if (action === "reply") {
    const conv = activeConversations.get(memberId);
    if (!conv) {
      return NextResponse.json(
        { error: "No active conversation. Start one first." },
        { status: 400 }
      );
    }

    const result = await conv.engine.continueConversation(
      conv.context,
      conv.history,
      message
    );

    conv.history.push({ role: "user", content: message });
    conv.history.push({ role: "assistant", content: result.response });

    if (result.extracted) {
      const today = new Date().toISOString().slice(0, 10);

      // 1. Upsert daily_updates
      await db.delete(dailyUpdates)
        .where(
          and(
            eq(dailyUpdates.memberId, memberId),
            eq(dailyUpdates.date, today)
          )
        )
        .run();
      await db.insert(dailyUpdates)
        .values({
          id: randomUUID(),
          memberId,
          date: today,
          completedItems: JSON.stringify(result.extracted.completed_items),
          plannedItems: JSON.stringify(result.extracted.planned_items),
          blockers: JSON.stringify(result.extracted.blockers),
          mood: result.extracted.mood,
        })
        .run();

      // 2. Apply task status changes → updates kanban & gantt
      const tasksUpdated = await applyTaskUpdates(result.extracted.task_updates);

      // 3. Save conversation record
      const allMessages = conv.history.map((m) => ({
        role: m.role === "assistant" ? "agent" : "member",
        content: m.content,
        timestamp: new Date().toISOString(),
      }));

      await db.update(conversations)
        .set({
          status: "completed",
          messages: JSON.stringify(allMessages),
          extractedData: JSON.stringify(result.extracted),
          completedAt: new Date().toISOString(),
        })
        .where(eq(conversations.id, conv.conversationId))
        .run();

      activeConversations.delete(memberId);

      return NextResponse.json({
        message: result.response,
        done: true,
        extracted: result.extracted,
        tasksUpdated,
      });
    }

    return NextResponse.json({
      message: result.response,
      done: false,
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

/** GET /api/standup?memberId=xx — Get conversation history */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memberId = request.nextUrl.searchParams.get("memberId");
  const today = new Date().toISOString().slice(0, 10);

  // Determine which memberId to query
  let queryMemberId = memberId;

  // Members can only view their own standup history unless admin
  if (user.role !== "admin") {
    queryMemberId = user.userId;
  }

  const query = queryMemberId
    ? await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.memberId, queryMemberId),
            eq(conversations.date, today)
          )
        )
        .all()
    : await db
        .select()
        .from(conversations)
        .where(eq(conversations.date, today))
        .all();

  return NextResponse.json(query);
}
