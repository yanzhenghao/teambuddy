import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@libsql/client";
import {
  requirements,
  requirementHistory,
  requirementDependencies,
  requirementConversations,
  riskWarnings,
  tasks,
} from "./schema";
import { drizzle } from "drizzle-orm/libsql";
import { inArray } from "drizzle-orm";

/**
 * Clean up all requirement-related data from the database.
 * Run with: npx tsx src/db/cleanup-requirements.ts
 */
async function cleanup() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL || "file:teambuddy.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const db = drizzle(client);

  console.log("Cleaning up requirement data...");
  console.log("DB URL:", process.env.TURSO_DATABASE_URL ? "remote Turso" : "local file");

  // 1. Get all requirement IDs
  const allReqs = await db.select({ id: requirements.id }).from(requirements).all();
  const reqIds = allReqs.map((r) => r.id);
  console.log(`Found ${reqIds.length} requirements to delete`);

  if (reqIds.length === 0) {
    console.log("Nothing to clean up.");
    return;
  }

  // 2. Delete in FK-safe order
  const depCount = await db.delete(requirementDependencies).run();
  console.log(`Deleted requirement_dependencies: ${depCount.rowsAffected}`);

  const histCount = await db.delete(requirementHistory).run();
  console.log(`Deleted requirement_history: ${histCount.rowsAffected}`);

  const riskCount = await db.delete(riskWarnings).run();
  console.log(`Deleted risk_warnings: ${riskCount.rowsAffected}`);

  // Delete tasks linked to requirements
  if (reqIds.length > 0) {
    const taskList = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(inArray(tasks.requirementId, reqIds))
      .all();
    if (taskList.length > 0) {
      await db.delete(tasks).where(inArray(tasks.id, taskList.map((t) => t.id))).run();
    }
    console.log(`Deleted tasks linked to requirements: ${taskList.length}`);
  }

  // Delete conversations
  const convCount = await db.delete(requirementConversations).run();
  console.log(`Deleted requirement_conversations: ${convCount.rowsAffected}`);

  // Delete all requirements
  const reqCount = await db.delete(requirements).run();
  console.log(`Deleted requirements: ${reqCount.rowsAffected}`);

  console.log("Cleanup complete!");
}

cleanup().catch(console.error);
