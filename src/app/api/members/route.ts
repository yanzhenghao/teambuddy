import { db } from "@/db";
import { members } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { cachedJson, CACHE_PRESETS } from "@/lib/api-cache";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Non-admin users only see themselves
  if (user.role !== "admin") {
    const member = await db.select().from(members).where(eq(members.id, user.userId)).get();
    return cachedJson(member ? [member] : [], CACHE_PRESETS.STATIC);
  }

  const allMembers = await db.select().from(members).all();
  return cachedJson(allMembers, CACHE_PRESETS.STATIC);
}
