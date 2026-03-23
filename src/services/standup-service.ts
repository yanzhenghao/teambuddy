import { db } from "@/db";
import { members, tasks, dailyUpdates, conversations } from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { ChannelAdapter, Message } from "@/adapters";
import {
  DialogueEngine,
  StandupContext,
  ConversationMessage,
  ExtractedUpdate,
} from "./dialogue-engine";
import { randomUUID } from "crypto";

const REPLY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ROUNDS = 5;

const roleLabels: Record<string, string> = {
  frontend: "前端开发",
  backend: "后端开发",
  fullstack: "全栈开发",
  test: "测试工程师",
};

/**
 * Apply task status updates extracted from standup conversation.
 */
async function applyTaskUpdates(extracted: ExtractedUpdate): Promise<number> {
  let updated = 0;
  const validStatuses = ["todo", "in_progress", "in_review", "done"];

  for (const tu of extracted.task_updates) {
    if (!tu.task_id || !validStatuses.includes(tu.new_status)) continue;

    const updateData: Record<string, string> = {
      status: tu.new_status,
      updatedAt: new Date().toISOString(),
    };

    if (tu.new_status === "done") {
      updateData.completedDate = new Date().toISOString().slice(0, 10);
    }

    await db.update(tasks)
      .set(updateData)
      .where(eq(tasks.id, tu.task_id))
      .run();
    updated++;
  }

  return updated;
}

export class StandupService {
  private engine: DialogueEngine;
  private adapter: ChannelAdapter;

  constructor(adapter: ChannelAdapter, engine?: DialogueEngine) {
    this.adapter = adapter;
    this.engine = engine || new DialogueEngine();
  }

  /**
   * Run standup for a single member.
   */
  async runForMember(memberId: string): Promise<{
    success: boolean;
    extracted: ExtractedUpdate | null;
    tasksUpdated: number;
    messages: Message[];
  }> {
    const member = await db
      .select()
      .from(members)
      .where(eq(members.id, memberId))
      .get();

    if (!member) {
      return { success: false, extracted: null, tasksUpdated: 0, messages: [] };
    }

    const today = new Date().toISOString().slice(0, 10);

    // Get previous update for context
    const prevUpdate = await db
      .select()
      .from(dailyUpdates)
      .where(eq(dailyUpdates.memberId, memberId))
      .orderBy(desc(dailyUpdates.date))
      .limit(1)
      .get();

    // Get ALL tasks assigned to this member (not just in_progress)
    // so the LLM can transition todo→in_progress or in_progress→done
    const allMemberTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.assigneeId, memberId))
      .all();
    const memberTasks = allMemberTasks.filter((t) => t.status !== "done"); // exclude already-done tasks

    const ctx: StandupContext = {
      memberName: member.name,
      memberRole: roleLabels[member.role] || member.role,
      previousUpdate: prevUpdate
        ? {
            completedItems: JSON.parse(prevUpdate.completedItems),
            plannedItems: JSON.parse(prevUpdate.plannedItems),
            blockers: JSON.parse(prevUpdate.blockers),
          }
        : null,
      currentTasks: memberTasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        dueDate: t.dueDate,
      })),
    };

    const allMessages: Message[] = [];
    const history: ConversationMessage[] = [];

    // Create conversation record
    const convId = randomUUID();
    await db.insert(conversations)
      .values({
        id: convId,
        memberId,
        date: today,
        status: "in_progress",
        startedAt: new Date().toISOString(),
      })
      .run();

    try {
      // 1. Agent sends opening message
      const opening = await this.engine.startConversation(ctx);
      await this.adapter.sendMessage(memberId, opening);
      allMessages.push({
        role: "agent",
        content: opening,
        timestamp: new Date().toISOString(),
      });
      history.push({ role: "assistant", content: opening });

      // 2. Multi-round conversation
      let extracted: ExtractedUpdate | null = null;

      for (let round = 0; round < MAX_ROUNDS; round++) {
        const reply = await this.adapter.waitForReply(
          memberId,
          REPLY_TIMEOUT_MS
        );

        if (!reply) {
          await this.adapter.sendMessage(
            memberId,
            "好的，看起来你现在不方便，我们稍后再聊！"
          );
          break;
        }

        allMessages.push({
          role: "member",
          content: reply,
          timestamp: new Date().toISOString(),
        });

        const result = await this.engine.continueConversation(
          ctx,
          history,
          reply
        );

        history.push({ role: "user", content: reply });
        history.push({ role: "assistant", content: result.response });

        await this.adapter.sendMessage(memberId, result.response);
        allMessages.push({
          role: "agent",
          content: result.response,
          timestamp: new Date().toISOString(),
        });

        if (result.extracted) {
          extracted = result.extracted;
          break;
        }
      }

      // 3. Save results
      let tasksUpdated = 0;

      if (extracted) {
        // a) Update daily_updates (upsert)
        await db.delete(dailyUpdates)
          .where(
            and(
              eq(dailyUpdates.memberId, memberId),
              eq(dailyUpdates.date, today)
            )
          )
          .run();
        await db.insert(dailyUpdates)
          .values({
            id: randomUUID(),
            memberId,
            date: today,
            completedItems: JSON.stringify(extracted.completed_items),
            plannedItems: JSON.stringify(extracted.planned_items),
            blockers: JSON.stringify(extracted.blockers),
            mood: extracted.mood,
          })
          .run();

        // b) Apply task status updates to tasks table
        tasksUpdated = await applyTaskUpdates(extracted);
      }

      // 4. Update conversation record
      await db.update(conversations)
        .set({
          status: "completed",
          messages: JSON.stringify(allMessages),
          extractedData: extracted ? JSON.stringify(extracted) : null,
          completedAt: new Date().toISOString(),
        })
        .where(eq(conversations.id, convId))
        .run();

      return { success: true, extracted, tasksUpdated, messages: allMessages };
    } catch (error) {
      await db.update(conversations)
        .set({
          status: "completed",
          messages: JSON.stringify(allMessages),
          completedAt: new Date().toISOString(),
        })
        .where(eq(conversations.id, convId))
        .run();

      throw error;
    }
  }

  /**
   * Run standup for all active members sequentially.
   */
  async runForAll(): Promise<
    Map<
      string,
      { success: boolean; extracted: ExtractedUpdate | null; tasksUpdated: number }
    >
  > {
    const allMembers = await db
      .select()
      .from(members)
      .where(eq(members.status, "active"))
      .all();

    const results = new Map<
      string,
      { success: boolean; extracted: ExtractedUpdate | null; tasksUpdated: number }
    >();

    for (const member of allMembers) {
      try {
        const result = await this.runForMember(member.id);
        results.set(member.id, {
          success: result.success,
          extracted: result.extracted,
          tasksUpdated: result.tasksUpdated,
        });
      } catch (error) {
        console.error(`Standup failed for ${member.name}:`, error);
        results.set(member.id, {
          success: false,
          extracted: null,
          tasksUpdated: 0,
        });
      }
    }

    return results;
  }
}
