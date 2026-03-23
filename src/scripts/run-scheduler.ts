/**
 * Standalone scheduler runner.
 * Run with: npx tsx src/scripts/run-scheduler.ts [cron_expression]
 *
 * Default: "0 9 * * 1-5" (9 AM on weekdays, Asia/Shanghai)
 *
 * For testing, you can use: npx tsx src/scripts/run-scheduler.ts "* * * * *"
 * (triggers every minute)
 */
import { StandupScheduler } from "@/services/scheduler";
import { StandupService } from "@/services/standup-service";
import { CLIAdapter } from "@/adapters/cli-adapter";

const cronExpr = process.argv[2] || "0 9 * * 1-5";

console.log("=== TeamBuddy Scheduler ===");
console.log(`Cron: ${cronExpr}`);
console.log(`Timezone: Asia/Shanghai`);
console.log(`Press Ctrl+C to stop\n`);

const adapter = new CLIAdapter();
const service = new StandupService(adapter);

const scheduler = new StandupScheduler({
  cronExpression: cronExpr,
  timezone: "Asia/Shanghai",
  onTrigger: async (memberId, memberName) => {
    console.log(`\n--- Starting standup for ${memberName} ---`);
    const result = await service.runForMember(memberId);
    if (result.success && result.extracted) {
      console.log(`Completed: ${result.extracted.completed_items.join(", ")}`);
      console.log(`Planned: ${result.extracted.planned_items.join(", ")}`);
      console.log(`Tasks updated: ${result.tasksUpdated}`);
    }
  },
  onComplete: (results) => {
    const success = [...results.values()].filter(Boolean).length;
    const total = results.size;
    console.log(`\n=== Standup round complete: ${success}/${total} succeeded ===\n`);
  },
});

scheduler.start();

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down scheduler...");
  scheduler.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  scheduler.stop();
  process.exit(0);
});

// Keep process alive
setInterval(() => {}, 1000 * 60);
