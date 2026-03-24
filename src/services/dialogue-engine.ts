import { renderSkill } from "@/lib/skill-loader";
import { createPipeline } from "@/lib/ai-pipeline";
import { tagCleanerMiddleware } from "@/lib/middlewares/tag-cleaner";
import { contextCompressionMiddleware } from "@/lib/middlewares/context-compression";
import { callLLM } from "@/lib/llm-client";

const DEFAULT_MODEL = "MiniMax-M2.7-highspeed";

export interface StandupContext {
  memberName: string;
  memberRole: string;
  previousUpdate: {
    completedItems: string[];
    plannedItems: string[];
    blockers: string[];
  } | null;
  currentTasks: {
    id: string;
    title: string;
    status: string;
    dueDate: string | null;
  }[];
  /** 对话历史长度，用于判断是否为新成员 */
  conversationCount?: number;
  /** 上次检测到的情绪状态 */
  lastMood?: string;
}

export interface TaskUpdate {
  task_id: string;
  new_status: string;
}

export interface ExtractedUpdate {
  completed_items: string[];
  planned_items: string[];
  blockers: string[];
  mood: string;
  task_updates: TaskUpdate[];
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

// Shared pipeline for dialogue
const pipeline = createPipeline(
  contextCompressionMiddleware,
  tagCleanerMiddleware,
);

function buildSystemPrompt(
  isNewMember: boolean,
  historyLength: number,
  lastMood?: string
): string {
  const base = renderSkill("standup-collector");

  let moodPrompt = "";
  if (lastMood === "negative") {
    moodPrompt = renderSkill("standup-mood-negative");
  } else if (lastMood === "positive") {
    moodPrompt = renderSkill("standup-mood-positive");
  } else {
    moodPrompt = renderSkill("standup-mood-neutral");
  }

  let strategyPrompt = "";
  if (isNewMember || historyLength === 0) {
    strategyPrompt = renderSkill("standup-strategy-new");
  } else if (historyLength <= 2) {
    strategyPrompt = renderSkill("standup-strategy-early");
  } else {
    strategyPrompt = renderSkill("standup-strategy-veteran");
  }

  return base + "\n" + moodPrompt + "\n" + strategyPrompt;
}

function buildContextPrompt(ctx: StandupContext): string {
  let prompt = `当前对话对象: ${ctx.memberName}（${ctx.memberRole}）\n`;

  if (ctx.previousUpdate) {
    prompt += `\n上次更新:\n`;
    if (ctx.previousUpdate.completedItems.length > 0) {
      prompt += `- 完成: ${ctx.previousUpdate.completedItems.join("、")}\n`;
    }
    if (ctx.previousUpdate.plannedItems.length > 0) {
      prompt += `- 计划: ${ctx.previousUpdate.plannedItems.join("、")}\n`;
    }
    if (ctx.previousUpdate.blockers.length > 0) {
      prompt += `- 阻塞: ${ctx.previousUpdate.blockers.join("、")}\n`;
    }
  } else {
    prompt += `\n这是第一次与该成员对话，先做个简单自我介绍。\n`;
  }

  if (ctx.currentTasks.length > 0) {
    prompt += `\n当前分配的任务（含 task_id，用于 task_updates）:\n`;
    for (const t of ctx.currentTasks) {
      prompt += `- [${t.id}] ${t.title} (状态: ${t.status}${t.dueDate ? `, 截止 ${t.dueDate}` : ""})\n`;
    }
  }

  return prompt;
}

export function extractUpdate(text: string): ExtractedUpdate | null {
  const match = text.match(/<extracted>([\s\S]*?)<\/extracted>/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1].trim());
    return {
      completed_items: parsed.completed_items || [],
      planned_items: parsed.planned_items || [],
      blockers: parsed.blockers || [],
      mood: parsed.mood || "normal",
      task_updates: parsed.task_updates || [],
    };
  } catch {
    return null;
  }
}

export function stripExtractedTag(text: string): string {
  return text.replace(/<extracted>[\s\S]*?<\/extracted>/, "").trim();
}

export class DialogueEngine {
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.model = model || DEFAULT_MODEL;
  }

  async startConversation(ctx: StandupContext): Promise<string> {
    const contextPrompt = buildContextPrompt(ctx);
    const isNewMember = !ctx.previousUpdate;
    const historyLength = ctx.conversationCount || 0;

    const systemPrompt = buildSystemPrompt(isNewMember, historyLength, ctx.lastMood);

    const { cleaned: text } = await pipeline.execute(
      {
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `${contextPrompt}\n\n请发起今天的 standup 对话。生成你的开场白。`,
          },
        ],
        config: { model: this.model, maxTokens: 500 },
      },
      {}
    );

    return stripExtractedTag(text);
  }

  async continueConversation(
    ctx: StandupContext,
    history: ConversationMessage[],
    memberReply: string
  ): Promise<{ response: string; extracted: ExtractedUpdate | null }> {
    const contextPrompt = buildContextPrompt(ctx);
    const isNewMember = !ctx.previousUpdate;
    const historyLength = ctx.conversationCount || 0;

    const systemPrompt = buildSystemPrompt(isNewMember, historyLength, ctx.lastMood);

    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `${contextPrompt}\n\n请发起今天的 standup 对话。`,
      },
    ];

    for (const msg of history) {
      messages.push({ role: msg.role as "user" | "assistant", content: msg.content });
    }

    messages.push({ role: "user", content: memberReply });

    const { cleaned: text } = await pipeline.execute(
      { messages: messages as import("@/lib/ai-pipeline").LLMMessage[], config: { model: this.model, maxTokens: 800 } },
      {}
    );

    const extracted = extractUpdate(text);
    const cleanResponse = stripExtractedTag(text);

    return { response: cleanResponse, extracted };
  }
}
