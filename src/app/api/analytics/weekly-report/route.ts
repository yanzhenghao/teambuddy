import { db } from "@/db";
import { tasks, dailyUpdates, members } from "@/db/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { callLLM } from "@/lib/llm-client";

const WEEKLY_REPORT_PROMPT = `你是一个研发周报生成助手。根据以下团队数据，生成一份结构化的周报。

## 数据
{memberData}

## 任务
请生成一份包含以下部分的周报：
1. **本周概览**：整体完成情况
2. **完成任务**：列出已完成的主要任务
3. **进行中工作**：正在进行的重点工作
4. **遇到的问题**：如果有的话
5. **下周计划**：基于当前进展的预测

## 输出格式
请以以下JSON格式返回：
{
  "weekSummary": "本周概览（一段话）",
  "completedTasks": ["任务1", "任务2"],
  "inProgressWork": ["工作1", "工作2"],
  "issues": ["问题1", "问题2"],
  "nextWeekPlan": "下周计划描述",
  "highlights": ["亮点1", "亮点2"]
}

请只返回JSON，不要包含其他内容。`;

/** POST /api/analytics/weekly-report — Generate weekly report */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
  }

  const body = await request.json();
  const { startDate, endDate, includeActivity } = body;

  // Default to last 7 days
  const end = endDate || new Date().toISOString().slice(0, 10);
  const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Get all members
  const allMembers = await db
    .select()
    .from(members)
    .where(eq(members.status, "active"))
    .all();

  // Get all tasks
  const allTasks = await db.select().from(tasks).all();

  // Get daily updates in date range
  const allUpdates = await db.select().from(dailyUpdates).all();
  const recentUpdates = allUpdates.filter(
    (u) => u.date >= start && u.date <= end
  );

  // Build member data
  const memberData = allMembers.map((m) => {
    const memberTasks = allTasks.filter(
      (t) => t.assigneeId === m.id && t.completedDate && t.completedDate >= start && t.completedDate <= end
    );
    const memberUpdates = recentUpdates.filter((u) => u.memberId === m.id);

    const completedItems: string[] = [];
    const blockers: string[] = [];

    for (const update of memberUpdates) {
      completedItems.push(...JSON.parse(update.completedItems || "[]"));
      blockers.push(...JSON.parse(update.blockers || "[]"));
    }

    return {
      name: m.name,
      completedTasks: memberTasks.map((t) => t.title),
      completedItems,
      blockers,
      standupCount: memberUpdates.length,
    };
  });

  // Build the prompt data
  const dataText = memberData
    .map(
      (m) =>
        `【${m.name}】\n` +
        `完成任务: ${m.completedTasks.join(", ") || "无"}\n` +
        `进展汇报: ${m.completedItems.join(", ") || "无"}\n` +
        `Blockers: ${m.blockers.join(", ") || "无"}\n` +
        `Standup次数: ${m.standupCount}/7`
    )
    .join("\n\n");

  try {
    const messages = [
      {
        role: "system",
        content: "你是一个专业的研发周报生成助手，能够从团队数据中提取关键信息并生成结构化周报。",
      },
      {
        role: "user",
        content: WEEKLY_REPORT_PROMPT.replace("{memberData}", dataText),
      },
    ];

    const response = await callLLM(messages, { maxTokens: 2000 });

    // Parse the JSON response
    let report;
    try {
      const match = response.match(/\{[\s\S]*\}/);
      if (match) {
        report = JSON.parse(match[0]);
      } else {
        report = JSON.parse(response);
      }
    } catch (parseErr) {
      console.error("Failed to parse report response:", parseErr);
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      dateRange: { start, end },
      generatedAt: new Date().toISOString(),
      ...report,
    });
  } catch (err) {
    console.error("Weekly report generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate weekly report" },
      { status: 500 }
    );
  }
}
