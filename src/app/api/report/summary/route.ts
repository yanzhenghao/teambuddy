import { db } from "@/db";
import { members, dailyUpdates, tasks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { callLLM } from "@/lib/llm-client";

const SUMMARY_SYSTEM_PROMPT = `你是 TeamBuddy，一个研发小组的日报总结助手。请根据以下数据，用简洁的中文（2-3句话）总结今日团队整体状态。`;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only admins can generate team summary
  if (user.role !== "admin") {
    return NextResponse.json({ error: "只有管理员可以生成团队日报总结" }, { status: 403 });
  }

  const { date } = await request.json();
  const targetDate = date || new Date().toISOString().slice(0, 10);

  const allMembers = await db.select().from(members).where(eq(members.status, "active")).all();
  const updates = await db.select().from(dailyUpdates).where(eq(dailyUpdates.date, targetDate)).all();
  const allTasks = await db.select().from(tasks).all();

  const summaryData = allMembers.map((m) => {
    const update = updates.find((u) => u.memberId === m.id);
    const activeTasks = allTasks.filter((t) => t.assigneeId === m.id && t.status !== "done");
    return {
      name: m.name,
      completed: update ? JSON.parse(update.completedItems) : [],
      blockers: update ? JSON.parse(update.blockers) : [],
      mood: update?.mood || null,
      activeTasks: activeTasks.length,
    };
  });

  const summary = await callLLM(
    [
      { role: "system", content: SUMMARY_SYSTEM_PROMPT },
      {
        role: "user",
        content: `请总结以下团队日报数据（日期: ${targetDate}）：\n${JSON.stringify(summaryData, null, 2)}`,
      },
    ],
    { maxTokens: 300 }
  );

  return NextResponse.json({ summary, date: targetDate });
}