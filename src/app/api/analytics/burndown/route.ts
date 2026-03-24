import { db } from "@/db";
import { requirements, tasks } from "@/db/schema";
import { eq, gte, lte, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { cachedJson, CACHE_PRESETS } from "@/lib/api-cache";

interface BurndownDataPoint {
  date: string;
  totalTasks: number;
  completedTasks: number;
  remainingTasks: number;
  idealRemaining: number;
}

/** GET /api/analytics/burndown — Get burndown chart data */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const versionId = searchParams.get("versionId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  // Default to last 30 days if no dates specified
  const end = endDate || new Date().toISOString().slice(0, 10);
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Get all requirements (optionally filtered by version)
  let allRequirements;
  if (versionId) {
    allRequirements = await db
      .select()
      .from(requirements)
      .where(eq(requirements.versionId, versionId))
      .all();
  } else {
    allRequirements = await db.select().from(requirements).all();
  }

  // Get all tasks linked to these requirements
  const reqIds = new Set(allRequirements.map((r) => r.id));
  const allTasks = await db.select().from(tasks).all();
  const relevantTasks = allTasks.filter((t) => t.requirementId && reqIds.has(t.requirementId));

  // Get all daily updates for the date range to calculate completion
  const totalTaskCount = relevantTasks.length;
  const completedTaskCount = relevantTasks.filter((t) => t.status === "done").length;

  // Generate date range
  const dates: string[] = [];
  const current = new Date(start);
  const endDateObj = new Date(end);
  while (current <= endDateObj) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }

  // For each date, calculate remaining tasks
  // A task is considered completed if its completedDate <= that date
  const burndownData: BurndownDataPoint[] = [];
  const idealSlope = totalTaskCount / Math.max(dates.length - 1, 1);

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const completedByDate = relevantTasks.filter(
      (t) => t.status === "done" && t.completedDate && t.completedDate <= date
    ).length;

    burndownData.push({
      date,
      totalTasks: totalTaskCount,
      completedTasks: completedByDate,
      remainingTasks: totalTaskCount - completedByDate,
      idealRemaining: Math.max(0, Math.round(totalTaskCount - idealSlope * i)),
    });
  }

  // Calculate prediction
  const lastPoint = burndownData[burndownData.length - 1];
  const velocity = burndownData.length > 1
    ? burndownData[burndownData.length - 1].completedTasks - burndownData[0].completedTasks
    : 0;
  const avgDailyCompletion = velocity / Math.max(dates.length - 1, 1);

  let predictedCompletionDate: string | null = null;
  if (avgDailyCompletion > 0 && lastPoint.remainingTasks > 0) {
    const daysToComplete = Math.ceil(lastPoint.remainingTasks / avgDailyCompletion);
    const predictedDate = new Date(endDateObj);
    predictedDate.setDate(predictedDate.getDate() + daysToComplete);
    predictedCompletionDate = predictedDate.toISOString().slice(0, 10);
  } else if (lastPoint.remainingTasks === 0) {
    predictedCompletionDate = end;
  }

  return cachedJson({
    startDate: start,
    endDate: end,
    versionId: versionId || null,
    totalTasks: totalTaskCount,
    completedTasks: completedTaskCount,
    remainingTasks: totalTaskCount - completedTaskCount,
    dataPoints: burndownData,
    prediction: {
      predictedCompletionDate,
      avgDailyCompletion: Math.round(avgDailyCompletion * 100) / 100,
    },
  }, CACHE_PRESETS.ANALYTICS);
}
