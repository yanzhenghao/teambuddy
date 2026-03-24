import { db } from "@/db";
import { requirementConversations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

/** GET /api/requirement/history?sessionId=xxx or ?conversationId=xxx — Get messages for a session */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = request.nextUrl.searchParams.get("sessionId");
  const conversationId = request.nextUrl.searchParams.get("conversationId");

  if (!sessionId && !conversationId) {
    return NextResponse.json({ error: "sessionId or conversationId required" }, { status: 400 });
  }

  const conv = sessionId
    ? await db
        .select()
        .from(requirementConversations)
        .where(eq(requirementConversations.sessionId, sessionId))
        .get()
    : await db
        .select()
        .from(requirementConversations)
        .where(eq(requirementConversations.id, conversationId!))
        .get();

  if (!conv) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  return NextResponse.json({
    sessionId: conv.sessionId,
    messages: JSON.parse(conv.messages),
    requirement: conv.requirement,
    result: conv.result ? JSON.parse(conv.result) : null,
    status: conv.status,
  });
}
