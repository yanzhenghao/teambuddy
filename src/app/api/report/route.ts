import { db } from "@/db";
import { members, dailyUpdates, tasks } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = request.nextUrl.searchParams.get("date") || new Date().toISOString().slice(0, 10);

  const allMembers = await db
    .select()
    .from(members)
    .where(eq(members.status, "active"))
    .all();

  // Non-admin users only see their own report
  const visibleMembers = user.role !== "admin"
    ? allMembers.filter((m) => m.id === user.userId)
    : allMembers;

  const updates = await db
    .select()
    .from(dailyUpdates)
    .where(eq(dailyUpdates.date, date))
    .all();

  const allTasks = await db.select().from(tasks).all();
  const today = new Date().toISOString().slice(0, 10);

  const memberReports = visibleMembers.map((m) => {
    const update = updates.find((u) => u.memberId === m.id);
    const activeTasks = allTasks.filter(
      (t) => t.assigneeId === m.id && t.status !== "done"
    );
    const overdueTasks = activeTasks.filter(
      (t) => t.dueDate && t.dueDate < today
    );

    return {
      id: m.id,
      name: m.name,
      role: m.role,
      completed: update ? JSON.parse(update.completedItems) : [],
      planned: update ? JSON.parse(update.plannedItems) : [],
      blockers: update ? JSON.parse(update.blockers) : [],
      mood: update?.mood || null,
      activeTaskCount: activeTasks.length,
      overdueTaskCount: overdueTasks.length,
    };
  });

  const totalCompleted = memberReports.reduce((s, m) => s + m.completed.length, 0);
  const totalPlanned = memberReports.reduce((s, m) => s + m.planned.length, 0);
  const totalBlockers = memberReports.reduce((s, m) => s + m.blockers.length, 0);

  // Get available dates for navigation
  const allDates = await db
    .select({ date: dailyUpdates.date })
    .from(dailyUpdates)
    .orderBy(desc(dailyUpdates.date))
    .all();
  const uniqueDates = [...new Set(allDates.map((d) => d.date))];

  return NextResponse.json({
    date,
    members: memberReports,
    totalCompleted,
    totalPlanned,
    totalBlockers,
    availableDates: uniqueDates,
  });
}
