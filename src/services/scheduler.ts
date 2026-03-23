import cron, { ScheduledTask } from "node-cron";
import { db } from "@/db";
import { members } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface SchedulerConfig {
  /** Cron expression for standup time, default: "0 9 * * 1-5" (9 AM weekdays) */
  cronExpression: string;
  /** Timezone, default: "Asia/Shanghai" */
  timezone: string;
  /** Callback when standup should be triggered for a member */
  onTrigger: (memberId: string, memberName: string) => Promise<void>;
  /** Callback when all standups are complete */
  onComplete?: (results: Map<string, boolean>) => void;
}

const DEFAULT_CONFIG: Partial<SchedulerConfig> = {
  cronExpression: "0 9 * * 1-5",
  timezone: "Asia/Shanghai",
};

export class StandupScheduler {
  private task: ScheduledTask | null = null;
  private config: SchedulerConfig;
  private running = false;

  constructor(config: SchedulerConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  start(): void {
    if (this.task) {
      console.log("[Scheduler] Already running");
      return;
    }

    console.log(
      `[Scheduler] Starting with cron: "${this.config.cronExpression}" (${this.config.timezone})`
    );

    this.task = cron.schedule(
      this.config.cronExpression,
      () => {
        this.triggerStandups();
      },
      {
        timezone: this.config.timezone,
      }
    );

    console.log("[Scheduler] Started successfully");
  }

  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log("[Scheduler] Stopped");
    }
  }

  /** Manually trigger standups for all active members */
  async triggerStandups(): Promise<Map<string, boolean>> {
    if (this.running) {
      console.log("[Scheduler] Already running standups, skipping");
      return new Map();
    }

    this.running = true;
    const results = new Map<string, boolean>();

    try {
      const activeMembers = await db
        .select()
        .from(members)
        .where(eq(members.status, "active"))
        .all();

      console.log(
        `[Scheduler] Triggering standups for ${activeMembers.length} members`
      );

      for (const member of activeMembers) {
        try {
          await this.config.onTrigger(member.id, member.name);
          results.set(member.id, true);
          console.log(`[Scheduler] ✓ ${member.name} standup completed`);
        } catch (error) {
          results.set(member.id, false);
          console.error(`[Scheduler] ✗ ${member.name} standup failed:`, error);
        }
      }

      this.config.onComplete?.(results);
    } finally {
      this.running = false;
    }

    return results;
  }

  isRunning(): boolean {
    return this.task !== null;
  }

  getNextRun(): Date | null {
    // node-cron doesn't expose next run directly, calculate it
    if (!this.task) return null;
    try {
      const interval = cron.validate(this.config.cronExpression);
      return interval ? new Date() : null;
    } catch {
      return null;
    }
  }
}
