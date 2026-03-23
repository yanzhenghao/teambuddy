import { db } from "@/db";
import { requirementHistory, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

/** GET /api/requirement/history/changes?requirementId=xxx — Get change history for a requirement */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requirementId = searchParams.get("requirementId");

  if (!requirementId) {
    return NextResponse.json({ error: "requirementId is required" }, { status: 400 });
  }

  const history = await db
    .select({
      id: requirementHistory.id,
      requirementId: requirementHistory.requirementId,
      title: requirementHistory.title,
      summary: requirementHistory.summary,
      status: requirementHistory.status,
      assigneeId: requirementHistory.assigneeId,
      versionId: requirementHistory.versionId,
      changeType: requirementHistory.changeType,
      changedBy: requirementHistory.changedBy,
      changedAt: requirementHistory.changedAt,
    })
    .from(requirementHistory)
    .where(eq(requirementHistory.requirementId, requirementId))
    .orderBy(desc(requirementHistory.changedAt))
    .all();

  // Enrich with user names
  const userIds = [...new Set(history.map((h) => h.changedBy).filter(Boolean))];
  const userMap = new Map<string, string>();

  if (userIds.length > 0) {
    const relatedUsers = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .all();

    for (const u of relatedUsers) {
      userMap.set(u.id, u.name);
    }
  }

  const enrichedHistory = history.map((h) => ({
    ...h,
    changedByName: h.changedBy ? userMap.get(h.changedBy) || h.changedBy : null,
  }));

  return NextResponse.json(enrichedHistory);
}
