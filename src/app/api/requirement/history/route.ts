import { db } from "@/db";
import { requirementConversations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

/** GET /api/requirement/history?sessionId=xxx — Get messages for a session */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = request.nextUrl.searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const conv = await db
    .select()
    .from(requirementConversations)
    .where(eq(requirementConversations.sessionId, sessionId))
    .get();

  if (!conv) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  return NextResponse.json({
    messages: JSON.parse(conv.messages),
    requirement: conv.requirement,
    result: conv.result ? JSON.parse(conv.result) : null,
    status: conv.status,
  });
}
