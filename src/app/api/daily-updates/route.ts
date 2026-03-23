import { db } from "@/db";
import { dailyUpdates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = request.nextUrl.searchParams.get("date");

  let allUpdates = date
    ? await db.select().from(dailyUpdates).where(eq(dailyUpdates.date, date)).all()
    : await db.select().from(dailyUpdates).all();

  // Members only see their own daily updates
  if (user.role !== "admin") {
    allUpdates = allUpdates.filter((u) => u.memberId === user.userId);
  }

  return NextResponse.json(allUpdates);
}
