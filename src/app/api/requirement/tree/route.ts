import { db } from "@/db";
import { requirements, tasks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { cachedJson, CACHE_PRESETS } from "@/lib/api-cache";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const versionId = searchParams.get("versionId");
  const showUnversioned = searchParams.get("showUnversioned") === "true";

  try {
    // Fetch requirements, optionally filtered by version
    let allRequirements;
    if (versionId) {
      allRequirements = await db
        .select()
        .from(requirements)
        .where(eq(requirements.versionId, versionId))
        .all();
    } else if (showUnversioned) {
      allRequirements = await db
        .select()
        .from(requirements)
        .all();
    } else {
      allRequirements = await db.select().from(requirements).all();
    }

    // Get task counts for all requirements
    const allTasks = await db.select().from(tasks).all();

    // Build tree with task counts
    // For FuR, aggregate task counts from child ARs
    const requirementsWithCounts = allRequirements.map((req) => {
      if (req.type === "fur") {
        // FuR's tasks = sum of all child ARs' tasks
        const childArs = allRequirements.filter(
          (r) => r.parentId === req.id && r.type === "ar"
        );
        const arTaskCount = childArs.reduce((sum, ar) => {
          const arTasks = allTasks.filter((t) => t.requirementId === ar.id);
          return sum + arTasks.length;
        }, 0);
        const arCompletedCount = childArs.reduce((sum, ar) => {
          const arTasks = allTasks.filter((t) => t.requirementId === ar.id && t.status === "done");
          return sum + arTasks.length;
        }, 0);
        return {
          ...req,
          taskCount: arTaskCount,
          completedTaskCount: arCompletedCount,
        };
      }

      // For IR and AR, use direct task counts
      const reqTasks = allTasks.filter((t) => t.requirementId === req.id);
      const completedTasks = reqTasks.filter((t) => t.status === "done");
      return {
        ...req,
        taskCount: reqTasks.length,
        completedTaskCount: completedTasks.length,
      };
    });

    // Auto-update FuR status based on child AR task completion
    for (const req of requirementsWithCounts) {
      if (req.type === "fur" && req.taskCount > 0) {
        const allDone = req.completedTaskCount === req.taskCount;
        const newStatus = allDone ? "completed" : "in_progress";

        if (req.status !== newStatus) {
          await db
            .update(requirements)
            .set({ status: newStatus, updatedAt: new Date().toISOString() })
            .where(eq(requirements.id, req.id))
            .run();
          req.status = newStatus;
        }
      }
    }

    return cachedJson(requirementsWithCounts, CACHE_PRESETS.MODERATE);
  } catch (err) {
    console.error("Failed to fetch requirement tree:", err);
    return NextResponse.json({ error: "Failed to fetch requirements" }, { status: 500 });
  }
}
