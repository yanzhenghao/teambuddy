import { db } from "@/db";
import { members, conversations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

/**
 * GET/POST /api/cron/trigger-standups
 *
 * Railway cron 可配置为每天 9:00 AM Asia/Shanghai 执行此 endpoint。
 * 配置方式：Railway Dashboard → 你的 Service → Triggers → Cron Jobs
 *
 * 会自动为所有还未开始今日 standup 的成员创建 conversation 记录（状态: pending），
 * 这样成员打开 Standup 页面时可以直接看到有哪些人还没完成。
 */
export async function GET() {
  return handleTrigger();
}

export async function POST() {
  return handleTrigger();
}

async function handleTrigger() {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

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

  const existingMemberIds = new Set(todayConversations.map((c) => c.memberId));
  const pendingMembers = activeMembers.filter((m) => !existingMemberIds.has(m.id));

  let created = 0;
  for (const m of pendingMembers) {
    db.insert(conversations)
      .values({
        id: randomUUID(),
        memberId: m.id,
        date: today,
        status: "pending",
        startedAt: null,
      })
      .run();
    created++;
  }

  return NextResponse.json({
    ok: true,
    date: today,
    totalMembers: activeMembers.length,
    alreadyDone: existingMemberIds.size,
    created,
    pendingMembers: pendingMembers.map((m) => m.name),
    message:
      created === 0
        ? "所有成员今日 standup 已安排"
        : `已为 ${created} 名成员安排今日 standup`,
  });
}
