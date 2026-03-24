import { renderSkill } from "@/lib/skill-loader";
import { createPipeline } from "@/lib/ai-pipeline";
import { tagCleanerMiddleware } from "@/lib/middlewares/tag-cleaner";
import { contextCompressionMiddleware } from "@/lib/middlewares/context-compression";
import { callLLM } from "@/lib/llm-client";

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
  // Strategy 1: Look for <tasks>...</tasks> tags
  const tagMatch = text.match(/<tasks>([\s\S]*?)<\/tasks>/);
  if (tagMatch) {
    try {
      const parsed = JSON.parse(tagMatch[1].trim());
      return normalizeResult(parsed);
    } catch { /* fall through */ }
  }

  // Strategy 2: JSON object with "tasks" array
  const jsonMatches = text.match(/\{[\s\S]*"tasks"\s*:\s*\[[\s\S]*\][\s\S]*\}/g);
  if (jsonMatches) {
    for (const jsonStr of jsonMatches) {
      try {
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
          return normalizeResult(parsed);
        }
      } catch { /* next */ }
    }
  }

  // Strategy 3: bare JSON array
  const arrayMatch = text.match(/\[\s*\{[\s\S]*"title"[\s\S]*\}\s*\]/g);
  if (arrayMatch) {
    for (const arrStr of arrayMatch) {
      try {
        const parsed = JSON.parse(arrStr);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].title) {
          return normalizeResult({ summary: "", tasks: parsed });
        }
      } catch { /* next */ }
    }
  }

  return null;
}

function normalizeResult(parsed: Record<string, unknown>): RequirementResult {
  const tasks = (parsed.tasks as Record<string, unknown>[]) || [];
  return {
    summary: (parsed.summary as string) || "",
    tasks: tasks.map((t) => ({
      title: (t.title as string) || "",
      description: (t.description as string) || "",
      category: (t.category as string) || "feature",
      priority: (t.priority as string) || "P2",
      estimatedDays: (t.estimatedDays as number) || 1,
      requiredSkills: (t.requiredSkills as string[]) || [],
      suggestedAssignee: (t.suggestedAssignee as TaskBreakdown["suggestedAssignee"]) || null,
    })),
  };
}

export function extractIRTitle(text: string): string | null {
  const match = text.match(/<ir_title>([\s\S]*?)<\/ir_title>/);
  return match ? match[1].trim() : null;
}

export function stripTasksTag(text: string): string {
  let result = text.replace(/<tasks>[\s\S]*?<\/tasks>/, "").trim();
  result = result.replace(/<ir_title>[\s\S]*?<\/ir_title>/g, "").trim();
  result = result.replace(/<extracted>[\s\S]*?<\/extracted>/g, "").trim();
  result = result.replace(/```json\s*\{[\s\S]*"tasks"\s*:\s*\[[\s\S]*\]\s*\}[\s\S]*?```/g, "").trim();
  result = result.replace(/\{[\s\S]*"tasks"\s*:\s*\[[\s\S]*\]\s*\}/g, "").trim();
  return result;
}

// Re-export from llm-client for compatibility
export function stripThinkTag(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/, "").trim();
}

// Shared pipeline for requirement analysis
const pipeline = createPipeline(
  contextCompressionMiddleware,
  tagCleanerMiddleware,
);

export class RequirementEngine {
  constructor() {}

  async startAnalysis(
    requirement: string,
    teamMembers: TeamMemberProfile[]
  ): Promise<{ response: string; result: RequirementResult | null; refinedTitle: string | null }> {
    const teamContext = buildTeamContext(teamMembers);
    const systemPrompt = renderSkill("requirement-analyst", { team_context: teamContext });

    const { cleaned: text } = await pipeline.execute(
      {
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `新需求：\n${requirement}\n\n请分析这个需求，如果信息不够请提出澄清问题，如果足够请直接给出任务拆解方案。`,
          },
        ],
        config: { maxTokens: 1500 },
      },
      {}
    );

    const result = extractTasks(text);
    const refinedTitle = extractIRTitle(text);
    let cleanResponse = stripThinkTag(stripTasksTag(text));

    return { response: cleanResponse, result, refinedTitle };
  }

  async continueAnalysis(
    requirement: string,
    teamMembers: TeamMemberProfile[],
    history: ConversationMessage[],
    userReply: string
  ): Promise<{ response: string; result: RequirementResult | null }> {
    const teamContext = buildTeamContext(teamMembers);
    const systemPrompt = renderSkill("requirement-analyst", { team_context: teamContext });

    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `新需求：\n${requirement}\n\n请分析这个需求。`,
      },
    ];

    for (const msg of history) {
      messages.push({ role: msg.role as "user" | "assistant", content: msg.content });
    }

    messages.push({ role: "user", content: userReply });

    const { cleaned: text } = await pipeline.execute(
      { messages: messages as import("@/lib/ai-pipeline").LLMMessage[], config: { maxTokens: 1500 } },
      {}
    );

    const result = extractTasks(text);
    const cleanResponse = stripThinkTag(stripTasksTag(text));

    return { response: cleanResponse, result };
  }
}
