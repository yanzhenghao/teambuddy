import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { callLLM } from "@/lib/llm-client";

const CLASSIFICATION_PROMPT = `你是一个需求分类助手。根据输入的需求描述，判断该需求属于哪种类型。

需求类型定义：
- **IR (注入需求/Initial Requirement)**：原始业务需求，通常来自客户、市场或产品战略，描述一个完整的业务目标或问题。适合作为顶层需求。
- **FuR (功能需求/Function Requirement)**：将IR分解为具体的功能模块，描述系统应提供的功能和服务。
- **AR (分配需求/Allocation Requirement)**：将FuR进一步分解为可分配给具体开发人员的具体任务，通常与特定模块或功能实现相关。

请分析以下需求描述，返回推荐的类型和理由：

<requirement>
{requirement}
</requirement>

请以以下JSON格式返回：
{
  "type": "IR" | "FuR" | "AR",
  "confidence": 0.0-1.0,
  "reasoning": "推荐理由"
}

请只返回JSON，不要包含其他内容。`;

/** POST /api/requirement/classify — AI auto-classify requirement type */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { requirement } = body;

  if (!requirement || typeof requirement !== "string") {
    return NextResponse.json({ error: "requirement text is required" }, { status: 400 });
  }

  try {
    const messages = [
      { role: "system", content: "你是一个专业的需求分析师。" },
      { role: "user", content: CLASSIFICATION_PROMPT.replace("{requirement}", requirement) },
    ];

    const response = await callLLM(messages, { maxTokens: 500 });

    // Try to parse the JSON response
    let classification;
    try {
      // Try direct JSON parse first
      classification = JSON.parse(response);
    } catch {
      // Try to extract from tags
      const match = response.match(/\{[\s\S]*\}/);
      if (match) {
        classification = JSON.parse(match[0]);
      } else {
        throw new Error("Failed to parse classification response");
      }
    }

    // Validate the classification object
    if (!classification.type || !["IR", "FuR", "AR"].includes(classification.type)) {
      throw new Error("Invalid classification type in response");
    }

    return NextResponse.json({
      type: classification.type,
      confidence: classification.confidence || 0.5,
      reasoning: classification.reasoning || "",
    });
  } catch (err) {
    console.error("Classification failed:", err);
    return NextResponse.json(
      { error: "Failed to classify requirement" },
      { status: 500 }
    );
  }
}
