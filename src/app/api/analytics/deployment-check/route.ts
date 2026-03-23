import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { callLLM } from "@/lib/llm-client";

const DEPLOYMENT_CHECK_PROMPT = `你是一个上线检查助手。根据代码改动信息，生成动态的检查清单并识别潜在风险。

## 代码改动信息
{prInfo}

## 任务
1. 分析改动的范围和内容
2. 识别可能的风险点
3. 生成针对性的检查清单
4. 提供风险缓解建议

## 输出格式
请以以下JSON格式返回：
{
  "changeSummary": "改动概述（一句话）",
  "riskLevel": "low|medium|high",
  "checklist": [
    {
      "category": "检查类别（如：功能测试、安全、性能、数据迁移、配置等）",
      "item": "检查项描述",
      "priority": "high|medium|low",
      "riskIfSkipped": "跳过该项可能导致的问题",
      "suggestedAction": "建议的具体操作"
    }
  ],
  "identifiedRisks": [
    {
      "riskType": "风险类型（如：数据丢失、兼容性问题、安全漏洞、性能回退）",
      "description": "风险描述",
      "affectedAreas": ["受影响的功能区域1", "受影响的功能区域2"],
      "mitigation": "缓解措施"
    }
  ],
  "recommendations": ["建议1", "建议2"],
  "estimatedCheckTime": "预计检查耗时（如：15分钟）"
}

请只返回JSON，不要包含其他内容。`;

interface ChecklistItem {
  category: string;
  item: string;
  priority: "high" | "medium" | "low";
  riskIfSkipped: string;
  suggestedAction: string;
}

interface IdentifiedRisk {
  riskType: string;
  description: string;
  affectedAreas: string[];
  mitigation: string;
}

/** POST /api/analytics/deployment-check — Generate deployment checklist from PR/commit info */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
  }

  const body = await request.json();
  const { prTitle, prDescription, filesChanged, diffContent, baseBranch, headBranch } = body;

  // Build PR info text
  const prInfo = buildPRInfo({ prTitle, prDescription, filesChanged, diffContent, baseBranch, headBranch });

  try {
    const messages = [
      {
        role: "system" as const,
        content: "你是一个专业的上线检查助手，能够分析代码改动并生成针对性的检查清单。",
      },
      {
        role: "user" as const,
        content: DEPLOYMENT_CHECK_PROMPT.replace("{prInfo}", prInfo),
      },
    ];

    const response = await callLLM(messages, { maxTokens: 2500 });

    // Parse the JSON response
    let result;
    try {
      const match = response.match(/\{[\s\S]*\}/);
      if (match) {
        result = JSON.parse(match[0]);
      } else {
        result = JSON.parse(response);
      }
    } catch (parseErr) {
      console.error("Failed to parse deployment check response:", parseErr);
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      );
    }

    // Ensure result has required fields
    const validatedResult = validateResult(result);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      ...validatedResult,
    });
  } catch (err) {
    console.error("Deployment check generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate deployment check" },
      { status: 500 }
    );
  }
}

/** Build formatted PR info for the LLM */
function buildPRInfo(info: {
  prTitle?: string;
  prDescription?: string;
  filesChanged?: string[];
  diffContent?: string;
  baseBranch?: string;
  headBranch?: string;
}): string {
  const parts: string[] = [];

  if (info.prTitle) {
    parts.push(`标题: ${info.prTitle}`);
  }
  if (info.prDescription) {
    parts.push(`描述: ${info.prDescription}`);
  }
  if (info.baseBranch && info.headBranch) {
    parts.push(`分支: ${info.baseBranch} → ${info.headBranch}`);
  }
  if (info.filesChanged && info.filesChanged.length > 0) {
    parts.push(`变更文件 (${info.filesChanged.length}):\n${info.filesChanged.slice(0, 20).join("\n")}`);
    if (info.filesChanged.length > 20) {
      parts.push(`... 还有 ${info.filesChanged.length - 20} 个文件`);
    }
  }
  if (info.diffContent) {
    // Truncate diff if too long (first 8000 chars)
    const truncated = info.diffContent.length > 8000
      ? info.diffContent.slice(0, 8000) + "\n... (内容已截断)"
      : info.diffContent;
    parts.push(`代码差异:\n${truncated}`);
  }

  return parts.join("\n\n") || "未提供代码改动信息";
}

/** Validate and sanitize the LLM response */
function validateResult(result: unknown): {
  changeSummary: string;
  riskLevel: "low" | "medium" | "high";
  checklist: ChecklistItem[];
  identifiedRisks: IdentifiedRisk[];
  recommendations: string[];
  estimatedCheckTime: string;
} {
  const defaultResult = {
    changeSummary: "未提供改动摘要",
    riskLevel: "medium" as const,
    checklist: [] as ChecklistItem[],
    identifiedRisks: [] as IdentifiedRisk[],
    recommendations: [] as string[],
    estimatedCheckTime: "未知",
  };

  if (!result || typeof result !== "object") {
    return defaultResult;
  }

  const r = result as Record<string, unknown>;

  return {
    changeSummary: typeof r.changeSummary === "string" ? r.changeSummary : defaultResult.changeSummary,
    riskLevel: ["low", "medium", "high"].includes(r.riskLevel as string)
      ? (r.riskLevel as "low" | "medium" | "high")
      : defaultResult.riskLevel,
    checklist: Array.isArray(r.checklist) ? r.checklist.filter(isChecklistItem) : defaultResult.checklist,
    identifiedRisks: Array.isArray(r.identifiedRisks) ? r.identifiedRisks.filter(isIdentifiedRisk) : defaultResult.identifiedRisks,
    recommendations: Array.isArray(r.recommendations) ? r.recommendations.filter((v): v is string => typeof v === "string") : defaultResult.recommendations,
    estimatedCheckTime: typeof r.estimatedCheckTime === "string" ? r.estimatedCheckTime : defaultResult.estimatedCheckTime,
  };
}

function isChecklistItem(item: unknown): item is ChecklistItem {
  return (
    item !== null &&
    typeof item === "object" &&
    "category" in item &&
    "item" in item &&
    "priority" in item
  );
}

function isIdentifiedRisk(item: unknown): item is IdentifiedRisk {
  return (
    item !== null &&
    typeof item === "object" &&
    "riskType" in item &&
    "description" in item
  );
}