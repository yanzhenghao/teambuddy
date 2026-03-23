import { db } from "@/db";
import { requirements, members, tasks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { callLLM } from "@/lib/llm-client";

const DECOMPOSE_PROMPT = `你是 TeamBuddy，一个研发小组管家 Agent。你的任务是将一个功能需求（FuR）分解为具体的开发任务。

## 任务类型定义
- **feature**: 新功能开发
- **bug**: 缺陷修复
- **optimization**: 性能优化
- **test**: 测试相关
- **new_req**: 新需求

## 优先级定义
- **P0**: 紧急重要，必须立即处理
- **P1**: 重要，计划内处理
- **P2**: 普通，日常任务
- **P3**: 低优先，可以延后

## 技能标签
前端: React, Vue, TypeScript, CSS, HTML, 移动端
后端: Node.js, Python, Java, 数据库, API
全栈: React, Node.js, TypeScript
测试: 自动化测试, 手动测试

## 团队成员信息
{teamMembers}

## FuR 需求内容
- 标题: {furTitle}
- 描述: {furSummary}

请分析这个 FuR，输出一套任务拆分方案。每个任务需要包含：
- title: 任务标题（简洁明了）
- description: 任务详细描述
- category: 任务类型（feature/bug/optimization/test）
- priority: 优先级（P0/P1/P2/P3）
- estimatedDays: 预估工期（天）
- requiredSkills: 所需技能数组
- suggestedAssignee: 推荐人选（考虑技能匹配和负载均衡）

请以以下JSON格式返回：
<tasks>
{{
  "tasks": [
    {{
      "title": "任务标题",
      "description": "任务详细描述",
      "category": "feature",
      "priority": "P1",
      "estimatedDays": 2,
      "requiredSkills": ["React", "TypeScript"],
      "suggestedAssignee": {{
        "memberId": "成员ID",
        "memberName": "成员名字",
        "reason": "推荐理由"
      }}
    }}
  ]
}}
</tasks>

请只返回JSON，不要包含其他内容。`;

/** POST /api/requirement/decompose — AI decompose FuR into tasks */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { furId } = body;

  if (!furId) {
    return NextResponse.json({ error: "furId is required" }, { status: 400 });
  }

  // Fetch the FuR
  const fur = await db
    .select()
    .from(requirements)
    .where(eq(requirements.id, furId))
    .get();

  if (!fur) {
    return NextResponse.json({ error: "FuR not found" }, { status: 404 });
  }

  if (fur.type !== "fur") {
    return NextResponse.json({ error: "Only FuR can be decomposed" }, { status: 400 });
  }

  // Fetch team members for assignment suggestions
  const allMembers = await db
    .select()
    .from(members)
    .where(eq(members.status, "active"))
    .all();

  const memberTasks = await db.select().from(tasks).all();

  const teamMembersContext = allMembers.map((m) => {
    const currentLoad = memberTasks.filter(
      (t) => t.assigneeId === m.id && (t.status === "in_progress" || t.status === "in_review")
    ).length;
    return {
      id: m.id,
      name: m.name,
      role: m.role,
      skills: JSON.parse(m.skills),
      maxLoad: m.maxLoad,
      currentLoad,
    };
  });

  const teamMembersStr = teamMembersContext
    .map(
      (m) =>
        `- [${m.id}] ${m.name}（${m.role}）技能: ${m.skills.join(", ")} | 负载: ${m.currentLoad}/${m.maxLoad}`
    )
    .join("\n");

  try {
    const messages = [
      {
        role: "system",
        content: "你是一个专业的研发任务分解助手。",
      },
      {
        role: "user",
        content: DECOMPOSE_PROMPT.replace("{teamMembers}", teamMembersStr)
          .replace("{furTitle}", fur.title)
          .replace("{furSummary}", fur.summary || "无详细描述"),
      },
    ];

    const response = await callLLM(messages, { maxTokens: 2000 });

    // Parse the response
    let result;
    try {
      const match = response.match(/<tasks>([\s\S]*?)<\/tasks>/);
      if (match) {
        result = JSON.parse(match[1]);
      } else {
        result = JSON.parse(response);
      }
    } catch (parseErr) {
      console.error("Failed to parse decompose response:", parseErr);
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      );
    }

    if (!result.tasks || !Array.isArray(result.tasks)) {
      return NextResponse.json(
        { error: "Invalid response format from AI" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      furId,
      furTitle: fur.title,
      tasks: result.tasks,
    });
  } catch (err) {
    console.error("Decompose failed:", err);
    return NextResponse.json(
      { error: "Failed to decompose FuR" },
      { status: 500 }
    );
  }
}
