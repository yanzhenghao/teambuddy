import { db } from "@/db";
import { requirements, tasks } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function GET() {
  try {
    // Fetch all requirements
    const allRequirements = await db.select().from(requirements).all();

    // Get task counts for ARs and FuRs
    const allTasks = await db.select().from(tasks).all();

    // Build tree with task counts
    const requirementsWithCounts = allRequirements.map((req) => {
      const reqTasks = allTasks.filter((t) => t.requirementId === req.id);
      const completedTasks = reqTasks.filter((t) => t.status === "done");

      return {
        ...req,
        taskCount: reqTasks.length,
        completedTaskCount: completedTasks.length,
      };
    });

    // Auto-update FuR status based on task completion
    // When all tasks done, auto-create AR (Allocation Requirement)
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

        // Auto-create AR when all tasks completed
        if (allDone) {
          const existingAr = requirementsWithCounts.find(
            (r) => r.parentId === req.id && r.type === "ar"
          );
          if (!existingAr) {
            const arId = randomUUID();
            await db.insert(requirements).values({
              id: arId,
              parentId: req.id,
              title: `[AR] ${req.title}`,
              type: "ar",
              status: "completed",
              summary: `分配需求：${req.summary || req.title}`,
              taskCount: 0,
              completedTaskCount: 0,
            }).run();
            req._autoArCreated = arId;
          }
        }
      }
    }

    return NextResponse.json(requirementsWithCounts);
  } catch (err) {
    console.error("Failed to fetch requirement tree:", err);
    return NextResponse.json({ error: "Failed to fetch requirements" }, { status: 500 });
  }
}
