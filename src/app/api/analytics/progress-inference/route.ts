import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { callLLM } from "@/lib/llm-client";

const PROGRESS_INFERENCE_PROMPT = `你是一个研发进展分析助手。根据团队成员的 Git commits、PR reviews 和 IM 消息记录，分析并推断每个成员的进展。

## 输入数据
{memberActivity}

## 任务
1. 分析每个成员的工作进展
2. 识别已完成的任务（从 commit message/PR title 推断）
3. 识别进行中的工作
4. 识别可能的 blockers（关键词：blocked, stuck, waiting, depends on）
5. 评估整体进展是否符合预期

## 输出格式
请以以下JSON格式返回：
{
  "analysis": [
    {
      "memberName": "成员名字",
      "inferredProgress": "进展描述",
      "completedWork": ["已完成的工作1", "已完成的工作2"],
      "inProgressWork": ["进行中的工作1"],
      "potentialBlockers": ["可能的阻碍1"],
      "moodIndicator": "positive|neutral|concerned",
      "confidence": 0.0-1.0
    }
  ],
  "teamSummary": "团队整体进展概述",
  "alerts": ["需要关注的alert1"]
}

请只返回JSON，不要包含其他内容。`;

/** POST /api/analytics/progress-inference — Infer progress from activity data */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
  }

  const body = await request.json();
  const { memberActivity } = body;

  if (!memberActivity || !Array.isArray(memberActivity)) {
    return NextResponse.json(
      { error: "memberActivity array is required" },
      { status: 400 }
    );
  }

  // Format the activity data for the prompt
  const activityText = memberActivity
    .map(
      (m: { name: string; commits?: string[]; prs?: string[]; imMessages?: string[] }) =>
        `【${m.name}】\n` +
        `Commits: ${(m.commits || []).join("; ")}\n` +
        `PRs: ${(m.prs || []).join("; ")}\n` +
        `IM Messages: ${(m.imMessages || []).slice(0, 5).join("; ")}`
    )
    .join("\n\n");

  try {
    const messages = [
      { role: "system", content: "你是一个专业的研发进展分析助手，能够从代码和沟通记录中推断工作进展。" },
      { role: "user", content: PROGRESS_INFERENCE_PROMPT.replace("{memberActivity}", activityText) },
    ];

    const response = await callLLM(messages, { maxTokens: 2000 });

    // Try to parse the JSON response
    let analysis;
    try {
      const match = response.match(/\{[\s\S]*\}/);
      if (match) {
        analysis = JSON.parse(match[0]);
      } else {
        analysis = JSON.parse(response);
      }
    } catch (parseErr) {
      console.error("Failed to parse analysis response:", parseErr);
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      );
    }

    return NextResponse.json(analysis);
  } catch (err) {
    console.error("Progress inference failed:", err);
    return NextResponse.json(
      { error: "Failed to infer progress" },
      { status: 500 }
    );
  }
}
