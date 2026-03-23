import { db } from "@/db";
import { conversations, members } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

/** GET /api/conversations/[id] — Get single conversation by ID */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const result = await db
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
    .where(eq(conversations.id, id))
    .get();

  if (!result) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  // Parse JSON fields
  return NextResponse.json({
    ...result,
    messages: result.messages ? JSON.parse(result.messages) : [],
    extractedData: result.extractedData ? JSON.parse(result.extractedData) : null,
  });
}
