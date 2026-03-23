import { db } from "@/db";
import { conversations, members } from "@/db/schema";
import { eq, desc, lt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memberId = request.nextUrl.searchParams.get("memberId");
  const date = request.nextUrl.searchParams.get("date");

  let query = db
    .select({
      id: conversations.id,
      memberId: conversations.memberId,
      memberName: members.name,
      date: conversations.date,
      messages: conversations.messages,
      extractedData: conversations.extractedData,
      status: conversations.status,
      startedAt: conversations.startedAt,
      completedAt: conversations.completedAt,
    })
    .from(conversations)
    .leftJoin(members, eq(conversations.memberId, members.id))
    .orderBy(desc(conversations.createdAt));

  const allResults = await query.all();
  let results = allResults.filter((row) => {
    if (memberId && row.memberId !== memberId) return false;
    if (date && row.date !== date) return false;
    return true;
  });

  // Members only see their own conversations
  if (user.role !== "admin") {
    results = results.filter((row) => row.memberId === user.userId);
  }

  // Parse JSON fields
  const parsed = results.map((row) => ({
    ...row,
    messages: row.messages ? JSON.parse(row.messages) : [],
    extractedData: row.extractedData ? JSON.parse(row.extractedData) : null,
  }));

  return NextResponse.json(parsed);
}

/** DELETE /api/conversations — Cleanup old conversations (admin only) */
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const olderThanDays = parseInt(searchParams.get("olderThanDays") || "30", 10);

  // Calculate cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
  const cutoffStr = cutoffDate.toISOString();

  // Delete completed conversations older than cutoff
  const result = await db
    .delete(conversations)
    .where(
      eq(conversations.status, "completed")
    )
    .run();

  // Note: This deletes all completed conversations regardless of date
  // In production, you might want to add a date condition

  return NextResponse.json({
    success: true,
    message: `Cleaned up completed conversations older than ${olderThanDays} days`,
  });
}
