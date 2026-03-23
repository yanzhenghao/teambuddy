import { callLLM, stripTaggedContent } from "@/lib/llm-client";

const DEFAULT_MODEL = "MiniMax-M2.7-highspeed";

/**
 * 情绪感知系统提示词
 * 根据检测到的情绪状态调整回复风格
 */
function getMoodAwarePrompt(lastMood?: string): string {
  if (lastMood === "negative") {
    return `
## 情绪感知 - 消极情绪检测
检测到该成员可能情绪低落，你的回复应该：
- 更加温和、理解，不要催促
- 简短询问，不要连续追问
- 适当表达关心（如："辛苦了"）
- 即使阻塞项多，也先肯定已完成的，再问解决方案
`;
  }
  if (lastMood === "positive") {
    return `
## 情绪感知 - 积极情绪
检测到该成员状态良好，可以：
- 简洁高效地完成收集
- 适当肯定（如："效率很高！"）
- 正常推进对话即可
`;
  }
  return `
## 情绪感知 - 正常状态
保持友好、专业的对话风格，自然推进。
`;
}

/**
 * 渐进式采集策略
 * 根据成员历史调整采集深度
 */
function getCollectionStrategy(isNewMember: boolean, historyLength: number): string {
  if (isNewMember || historyLength === 0) {
    return `
## 渐进式采集策略 - 新成员首次对话
这是第一次对话或成员是新人，你需要：
- 先让对方简单自我介绍（姓名、角色、所在项目）
- 收集更完整的信息：背景、当前参与的项目、熟悉的技术栈
- 可以多问 1-2 轮，建立基础画像
- 对话结束时确保了解了：正在做什么、有什么资源需求
`;
  }

  if (historyLength <= 2) {
    return `
## 渐进式采集策略 - 新成员（对话 < 3 轮）
该成员还在建立画像期，可以多了解一些背景：
- 问一些开放性问题了解工作进展
- 适当追问细节，帮助完善任务描述
`;
  }

  return `
## 渐进式采集策略 - 老成员（对话 >= 3 轮）
这是老成员，对话应该简洁增量：
- 直接问"今天做了什么"、"明天计划"
- 引用上次对话中的具体任务追问（体现记忆）
- 控制在 2 轮内完成
- 如果上次有未完成的阻塞项，重点跟进
`;
}

const SYSTEM_PROMPT_BASE = `你是 TeamBuddy，一个友好的研发小组管家 Agent。你的任务是通过每日 standup 对话收集团队成员的工作进展。

## 你的对话风格
- 简洁、友好，不啰嗦
- 像同事聊天，不像机器人问卷
- 记得上次对话内容，能追问后续
- 如果组员情绪低落，适当鼓励
- 控制在 2-3 轮对话内完成信息收集

## 你需要收集的信息
1. **昨日完成**: 昨天完成了什么工作
2. **今日计划**: 今天打算做什么
3. **阻塞项**: 有没有什么问题卡住了
4. **情绪**: 从对话语气判断（positive/normal/negative），不要直接问

## 对话策略
- 首轮：引用上次对话的具体内容作为开场（如果有的话）
- 中间：根据回复追问细节或确认
- 结束：总结并感谢，保持对话轻松

## 任务状态联动（重要！）
你会收到该成员当前被分配的任务列表，每个任务有 task_id、title、status。
根据对话内容判断哪些任务的状态发生了变化，在 task_updates 中输出。

状态枚举：
- "todo" — 待开始
- "in_progress" — 进行中
- "done" — 已完成

判断规则：
- 成员说"XX做完了/搞定了/完成了" → 对应任务改为 "done"
- 成员说"开始做XX/今天推进XX" → 对应任务改为 "in_progress"
- 只输出状态真正发生变化的任务，不要重复输出当前状态

## 输出格式
当你收集完足够信息后，在最后一条消息中包含一个 JSON 块，用 <extracted> 标签包裹：

<extracted>
{
  "completed_items": ["完成项1", "完成项2"],
  "planned_items": ["计划项1", "计划项2"],
  "blockers": ["阻塞项1"],
  "mood": "positive",
  "task_updates": [
    {"task_id": "t4", "new_status": "done"},
    {"task_id": "t7", "new_status": "in_progress"}
  ]
}
</extracted>

task_updates 可以为空数组（如果没有任务状态变化）。
如果信息还不够完整，继续对话，不要输出 <extracted> 标签。
`;

/** 组合完整的系统提示词（包含动态策略） */
function buildSystemPrompt(
  isNewMember: boolean,
  historyLength: number,
  lastMood?: string
): string {
  return (
    SYSTEM_PROMPT_BASE +
    getMoodAwarePrompt(lastMood) +
    getCollectionStrategy(isNewMember, historyLength)
  );
}

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

    const text = await callLLM(
      [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `${contextPrompt}\n\n请发起今天的 standup 对话。生成你的开场白。`,
        },
      ],
      { model: this.model, maxTokens: 500 }
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
      messages.push({ role: msg.role, content: msg.content });
    }

    messages.push({ role: "user", content: memberReply });

    const text = await callLLM(messages, { model: this.model, maxTokens: 800 });

    const extracted = extractUpdate(text);
    const cleanResponse = stripExtractedTag(text);

    return { response: cleanResponse, extracted };
  }
}
