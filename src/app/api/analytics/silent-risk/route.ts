import { db } from "@/db";
import { members, tasks, dailyUpdates, conversations } from "@/db/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

interface RiskAlert {
  memberId: string;
  memberName: string;
  riskType: "silent" | "isolated" | "overloaded" | "stale";
  severity: "low" | "medium" | "high";
  message: string;
  recommendation: string;
}

/** GET /api/analytics/silent-risk — Detect silent risks from collaboration patterns */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "7", 10);

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = endDate.toISOString().slice(0, 10);
  const today = endDate.toISOString().slice(0, 10);

  // Get all active members
  const allMembers = await db
    .select()
    .from(members)
    .where(eq(members.status, "active"))
    .all();

  // Get all tasks
  const allTasks = await db.select().from(tasks).all();

  // Get recent daily updates
  const recentUpdates = await db
    .select()
    .from(dailyUpdates)
    .all();

  // Get recent conversations
  const recentConversations = await db
    .select()
    .from(conversations)
    .all();

  const alerts: RiskAlert[] = [];

  for (const member of allMembers) {
    // 1. Silent risk: No standup for N days
    const memberConvs = recentConversations.filter(
      (c) => c.memberId === member.id && c.date >= startStr && c.date <= endStr
    );
    if (memberConvs.length === 0 && days >= 3) {
      alerts.push({
        memberId: member.id,
        memberName: member.name,
        riskType: "silent",
        severity: days >= 7 ? "high" : "medium",
        message: `${member.name} 已经 ${days} 天没有进行 standup 对话`,
        recommendation: "建议主动联系该成员了解情况",
      });
    }

    // 2. Isolated risk: Assigned tasks but no recent updates
    const memberTasks = allTasks.filter(
      (t) => t.assigneeId === member.id && t.status !== "done"
    );
    const memberUpdates = recentUpdates.filter(
      (u) => u.memberId === member.id && u.date >= startStr && u.date <= endStr
    );

    if (memberTasks.length > 0 && memberUpdates.length === 0) {
      alerts.push({
        memberId: member.id,
        memberName: member.name,
        riskType: "isolated",
        severity: "medium",
        message: `${member.name} 有 ${memberTasks.length} 个进行中的任务但没有每日进展汇报`,
        recommendation: "建议提醒该成员提交每日更新",
      });
    }

    // 3. Stale tasks: Tasks not updated in 3+ days
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const staleTasks = memberTasks.filter((t) => {
      if (!t.updatedAt) return false;
      return new Date(t.updatedAt) < threeDaysAgo;
    });

    if (staleTasks.length > 0) {
      alerts.push({
        memberId: member.id,
        memberName: member.name,
        riskType: "stale",
        severity: staleTasks.length >= 3 ? "high" : "low",
        message: `${member.name} 有 ${staleTasks.length} 个任务超过 3 天没有更新`,
        recommendation: "建议联系成员了解任务是否遇到阻碍",
      });
    }

    // 4. Overloaded: More tasks than maxLoad
    if (memberTasks.length > member.maxLoad) {
      alerts.push({
        memberId: member.id,
        memberName: member.name,
        riskType: "overloaded",
        severity: memberTasks.length > member.maxLoad * 1.5 ? "high" : "medium",
        message: `${member.name} 当前有 ${memberTasks.length} 个任务，超过了 ${member.maxLoad} 的容量`,
        recommendation: "建议重新分配部分任务以避免过载",
      });
    }
  }

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return NextResponse.json({
    dateRange: { start: startStr, end: endStr },
    alertCount: alerts.length,
    alerts,
  });
}
