import { db } from "@/db";
import { members, tasks, dailyUpdates, conversations } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/scheduler — Trigger standup for all or a specific member (web-based).
 * This is a simplified "trigger" that doesn't use the full scheduler cron,
 * but allows the dashboard to kick off standups on demand.
 *
 * Body: { memberId?: string }
 * If memberId is provided, returns that member's status.
 * If not, returns status for all active members.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { memberId } = body;

  const activeMembers = memberId
    ? await db.select().from(members).where(eq(members.id, memberId)).all()
    : await db.select().from(members).where(eq(members.status, "active")).all();

  if (activeMembers.length === 0) {
    return NextResponse.json({ error: "No members found" }, { status: 404 });
  }

  const today = new Date().toISOString().slice(0, 10);

  // Check who already has a conversation today
  const todayConversations = await db
    .select()
    .from(conversations)
    .where(eq(conversations.date, today))
    .all();

  const results = activeMembers.map((m) => {
    const hasConversation = todayConversations.some(
      (c) => c.memberId === m.id && c.status === "completed"
    );
    const hasPendingConversation = todayConversations.some(
      (c) => c.memberId === m.id && c.status === "in_progress"
    );

    return {
      memberId: m.id,
      memberName: m.name,
      alreadyCompleted: hasConversation,
      inProgress: hasPendingConversation,
      needsStandup: !hasConversation && !hasPendingConversation,
    };
  });

  return NextResponse.json({
    date: today,
    members: results,
    totalNeedStandup: results.filter((r) => r.needsStandup).length,
    totalCompleted: results.filter((r) => r.alreadyCompleted).length,
  });
}

/** GET /api/scheduler — Get today's standup status overview */
export async function GET() {
  const today = new Date().toISOString().slice(0, 10);

  const activeMembers = await db
    .select()
    .from(members)
    .where(eq(members.status, "active"))
    .all();

  const todayConversations = await db
    .select()
    .from(conversations)
    .where(eq(conversations.date, today))
    .all();

  const todayUpdates = await db
    .select()
    .from(dailyUpdates)
    .where(eq(dailyUpdates.date, today))
    .all();

  const memberStatuses = activeMembers.map((m) => {
    const conv = todayConversations.find((c) => c.memberId === m.id);
    const update = todayUpdates.find((u) => u.memberId === m.id);

    return {
      memberId: m.id,
      memberName: m.name,
      conversationStatus: conv?.status || "not_started",
      hasUpdate: !!update,
      completedAt: conv?.completedAt || null,
    };
  });

  return NextResponse.json({
    date: today,
    members: memberStatuses,
    summary: {
      total: activeMembers.length,
      completed: memberStatuses.filter((m) => m.conversationStatus === "completed").length,
      inProgress: memberStatuses.filter((m) => m.conversationStatus === "in_progress").length,
      notStarted: memberStatuses.filter((m) => m.conversationStatus === "not_started").length,
    },
  });
}
