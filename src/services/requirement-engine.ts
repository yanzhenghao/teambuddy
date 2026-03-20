import OpenAI from "openai";

const MINIMAX_BASE_URL = "https://api.minimaxi.com/v1";
const DEFAULT_MODEL = "MiniMax-M2.7-highspeed";

const REQUIREMENT_SYSTEM_PROMPT = `你是 TeamBuddy，一个研发小组管家 Agent。你的任务是帮助管理者将模糊需求拆解为可执行的开发任务。

## 你的工作流程

### 阶段一：需求澄清
当收到一个模糊需求时，你需要：
1. 理解需求的核心意图
2. 识别信息缺失的地方
3. 提出 2-3 个关键澄清问题（不要超过 3 个）
4. 问题要具体、有选项，方便回答

### 阶段二：任务拆解
当信息足够后，你需要输出结构化任务拆解方案。

## 对话策略
- 用中文对话，语气友好专业
- 澄清问题要具体，给出选项让管理者选择
- 不要一次问太多问题，2-3 个就够了
- 当你认为信息足够拆解任务时，直接输出任务方案

## 输出格式
当你准备好拆解方案时，在消息中包含以下 JSON，用 <tasks> 标签包裹：

<tasks>
{
  "summary": "需求概述（一句话）",
  "tasks": [
    {
      "title": "任务标题",
      "description": "任务详细描述",
      "category": "feature|bug|optimization|test",
      "priority": "P0|P1|P2|P3",
      "estimatedDays": 3,
      "requiredSkills": ["React", "TypeScript"],
      "suggestedAssignee": {
        "memberId": "m1",
        "memberName": "李明",
        "reason": "前端开发，擅长 React，当前负载较低"
      }
    }
  ]
}
</tasks>

## 分配策略
你会收到团队成员列表，包含技能标签和当前负载。分配时考虑：
1. **技能匹配**：任务所需技能与成员技能的匹配度
2. **负载均衡**：优先分配给负载较低的成员
3. **避免过载**：不要让一个人同时承担超过 maxLoad 个任务
4. 如果没有完美匹配的成员，标记 suggestedAssignee 为 null

如果信息还不够拆解，继续对话，不要输出 <tasks> 标签。
`;

export interface TeamMemberProfile {
  id: string;
  name: string;
  role: string;
  skills: string[];
  maxLoad: number;
  currentLoad: number;
}

export interface SuggestedAssignment {
  memberId: string;
  memberName: string;
  reason: string;
}

export interface TaskBreakdown {
  title: string;
  description: string;
  category: string;
  priority: string;
  estimatedDays: number;
  requiredSkills: string[];
  suggestedAssignee: SuggestedAssignment | null;
}

export interface RequirementResult {
  summary: string;
  tasks: TaskBreakdown[];
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

function buildTeamContext(teamMembers: TeamMemberProfile[]): string {
  let prompt = `\n团队成员信息：\n`;
  for (const m of teamMembers) {
    prompt += `- [${m.id}] ${m.name}（${m.role}）技能: ${m.skills.join(", ")} | 负载: ${m.currentLoad}/${m.maxLoad}\n`;
  }
  return prompt;
}

export function extractTasks(text: string): RequirementResult | null {
  const match = text.match(/<tasks>([\s\S]*?)<\/tasks>/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1].trim());
    return {
      summary: parsed.summary || "",
      tasks: (parsed.tasks || []).map((t: Record<string, unknown>) => ({
        title: t.title || "",
        description: t.description || "",
        category: t.category || "feature",
        priority: t.priority || "P2",
        estimatedDays: t.estimatedDays || 1,
        requiredSkills: t.requiredSkills || [],
        suggestedAssignee: t.suggestedAssignee || null,
      })),
    };
  } catch {
    return null;
  }
}

export function stripTasksTag(text: string): string {
  return text.replace(/<tasks>[\s\S]*?<\/tasks>/, "").trim();
}

export function stripThinkTag(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/, "").trim();
}

export class RequirementEngine {
  private client: OpenAI;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.MINIMAX_API_KEY,
      baseURL: MINIMAX_BASE_URL,
    });
    this.model = model || DEFAULT_MODEL;
  }

  async startAnalysis(
    requirement: string,
    teamMembers: TeamMemberProfile[]
  ): Promise<{ response: string; result: RequirementResult | null }> {
    const teamContext = buildTeamContext(teamMembers);

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 1500,
      messages: [
        { role: "system", content: REQUIREMENT_SYSTEM_PROMPT },
        {
          role: "user",
          content: `${teamContext}\n\n新需求：\n${requirement}\n\n请分析这个需求，如果信息不够请提出澄清问题，如果足够请直接给出任务拆解方案。`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content || "";
    const result = extractTasks(text);
    const cleanResponse = stripThinkTag(stripTasksTag(text));

    return { response: cleanResponse, result };
  }

  async continueAnalysis(
    requirement: string,
    teamMembers: TeamMemberProfile[],
    history: ConversationMessage[],
    userReply: string
  ): Promise<{ response: string; result: RequirementResult | null }> {
    const teamContext = buildTeamContext(teamMembers);

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: REQUIREMENT_SYSTEM_PROMPT },
      {
        role: "user",
        content: `${teamContext}\n\n新需求：\n${requirement}\n\n请分析这个需求。`,
      },
    ];

    for (const msg of history) {
      messages.push({ role: msg.role, content: msg.content });
    }

    messages.push({ role: "user", content: userReply });

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 1500,
      messages,
    });

    const text = response.choices[0]?.message?.content || "";
    const result = extractTasks(text);
    const cleanResponse = stripThinkTag(stripTasksTag(text));

    return { response: cleanResponse, result };
  }
}
