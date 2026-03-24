import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { callLLM } from "@/lib/llm-client";
import { db } from "@/db";
import { members, tasks, dailyUpdates, conversations } from "@/db/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { cachedJson, CACHE_PRESETS } from "@/lib/api-cache";

interface MemberEnergy {
  memberId: string;
  memberName: string;
  energyIndex: number; // 0-100
  moodTrend: "rising" | "stable" | "declining";
  activityLevel: "low" | "normal" | "high" | "overloaded";
  riskSignals: string[];
  recommendations: string[];
}

interface TeamEnergyReport {
  teamEnergyIndex: number;
  overallTrend: "rising" | "stable" | "declining";
  members: MemberEnergy[];
  teamRecommendations: string[];
  overloadedMembers: string[];
  lowEnergyMembers: string[];
  earlyWarningSigns?: string[];
}

/** GET /api/analytics/team-energy — Analyze team energy from activity signals */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "7", 10);

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = endDate.toISOString().slice(0, 10);

  // Get all active members
  const allMembers = await db
    .select()
    .from(members)
    .where(eq(members.status, "active"))
    .all();

  // Get all tasks
  const allTasks = await db.select().from(tasks).all();

  // Get recent daily updates
  const allUpdates = await db.select().from(dailyUpdates).all();
  const recentUpdates = allUpdates.filter(
    (u) => u.date >= startStr && u.date <= endStr
  );

  // Get recent conversations
  const allConversations = await db.select().from(conversations).all();
  const recentConversations = allConversations.filter(
    (c) => c.date >= startStr && c.date <= endStr
  );

  // Calculate energy for each member
  const memberEnergies: MemberEnergy[] = allMembers.map((member) => {
    const memberTasks = allTasks.filter(
      (t) => t.assigneeId === member.id && t.status !== "done"
    );
    const memberUpdates = recentUpdates.filter((u) => u.memberId === member.id);
    const memberConvs = recentConversations.filter((c) => c.memberId === member.id);

    // Calculate activity metrics
    const taskCount = memberTasks.length;
    const taskLoadRatio = taskCount / Math.max(member.maxLoad, 1);
    const updateFrequency = memberUpdates.length / Math.max(days, 1);
    const convFrequency = memberConvs.length / Math.max(days, 1);

    // Analyze mood from daily updates
    const moods = memberUpdates
      .map((u) => {
        const mood = JSON.parse(u.mood || '"neutral"');
        return mood === "positive" ? 1 : mood === "negative" ? -1 : 0;
      })
      .filter((m) => m !== 0);

    const moodAvg = moods.length > 0
      ? moods.reduce((a, b) => a + b, 0) / moods.length
      : 0;

    // Calculate energy index (0-100)
    let energyIndex = 50; // Base

    // Adjust based on task load (overloaded = lower energy)
    if (taskLoadRatio > 1.5) energyIndex -= 30;
    else if (taskLoadRatio > 1.2) energyIndex -= 20;
    else if (taskLoadRatio > 1.0) energyIndex -= 10;
    else if (taskLoadRatio < 0.5) energyIndex -= 5;

    // Adjust based on update frequency (very low = lower energy)
    if (updateFrequency < 0.3) energyIndex -= 15;
    else if (updateFrequency < 0.5) energyIndex -= 5;
    else if (updateFrequency >= 0.8) energyIndex += 10;

    // Adjust based on conversation frequency
    if (convFrequency < 0.1) energyIndex -= 10;
    else if (convFrequency >= 0.5) energyIndex += 5;

    // Adjust based on mood
    if (moodAvg > 0.3) energyIndex += 10;
    else if (moodAvg < -0.3) energyIndex -= 15;

    // Clamp to 0-100
    energyIndex = Math.max(0, Math.min(100, energyIndex));

    // Determine mood trend (compare first half to second half)
    const halfPoint = Math.floor(memberUpdates.length / 2);
    const firstHalfMoods = moods.slice(0, halfPoint);
    const secondHalfMoods = moods.slice(halfPoint);
    const firstAvg = firstHalfMoods.length > 0
      ? firstHalfMoods.reduce((a, b) => a + b, 0) / firstHalfMoods.length
      : 0;
    const secondAvg = secondHalfMoods.length > 0
      ? secondHalfMoods.reduce((a, b) => a + b, 0) / secondHalfMoods.length
      : 0;

    let moodTrend: "rising" | "stable" | "declining" = "stable";
    if (secondAvg - firstAvg > 0.2) moodTrend = "rising";
    else if (firstAvg - secondAvg > 0.2) moodTrend = "declining";

    // Determine activity level
    let activityLevel: "low" | "normal" | "high" | "overloaded" = "normal";
    if (taskLoadRatio > 1.5) activityLevel = "overloaded";
    else if (taskLoadRatio > 1.2 || updateFrequency > 1.2) activityLevel = "high";
    else if (updateFrequency < 0.3 && convFrequency < 0.1) activityLevel = "low";

    // Identify risk signals
    const riskSignals: string[] = [];
    if (taskLoadRatio > 1.5) riskSignals.push("任务过载：当前任务数超过容量50%");
    if (updateFrequency < 0.3) riskSignals.push("活跃度低：每日更新频率低于30%");
    if (moodAvg < -0.3) riskSignals.push("情绪低落：连续多日情绪偏负面");
    if (taskLoadRatio > 1.0 && moodAvg < 0) riskSignals.push("高压状态：任务多且情绪负面");
    if (memberUpdates.length === 0 && days >= 3) riskSignals.push("沉默风险：3天以上无任何更新");

    // Generate recommendations
    const recommendations: string[] = [];
    if (activityLevel === "overloaded") {
      recommendations.push("建议重新分配部分任务，避免过载");
    }
    if (moodTrend === "declining") {
      recommendations.push("建议与该成员进行一对一沟通，了解是否有阻碍");
    }
    if (updateFrequency < 0.5) {
      recommendations.push("建议提醒该成员保持每日更新习惯");
    }
    if (riskSignals.length === 0 && energyIndex >= 60) {
      recommendations.push("该成员状态良好，保持当前节奏");
    }

    return {
      memberId: member.id,
      memberName: member.name,
      energyIndex,
      moodTrend,
      activityLevel,
      riskSignals,
      recommendations,
    };
  });

  // Calculate team-level metrics
  const totalEnergy = memberEnergies.reduce((sum, m) => sum + m.energyIndex, 0);
  const teamEnergyIndex = Math.round(totalEnergy / Math.max(memberEnergies.length, 1));

  const risingCount = memberEnergies.filter((m) => m.moodTrend === "rising").length;
  const decliningCount = memberEnergies.filter((m) => m.moodTrend === "declining").length;

  let overallTrend: "rising" | "stable" | "declining" = "stable";
  if (risingCount > decliningCount * 2) overallTrend = "rising";
  else if (decliningCount > risingCount * 2) overallTrend = "declining";

  const overloadedMembers = memberEnergies
    .filter((m) => m.activityLevel === "overloaded")
    .map((m) => m.memberName);

  const lowEnergyMembers = memberEnergies
    .filter((m) => m.energyIndex < 40)
    .map((m) => m.memberName);

  // Generate team-level recommendations
  const teamRecommendations: string[] = [];
  if (overloadedMembers.length > 0) {
    teamRecommendations.push(`${overloadedMembers.length}名成员处于过载状态，建议进行任务重新分配`);
  }
  if (teamEnergyIndex < 50) {
    teamRecommendations.push("团队整体精力偏低，建议关注工作节奏和休息平衡");
  }
  if (overallTrend === "declining") {
    teamRecommendations.push("团队整体情绪趋势向下，建议关注团队士气和协作氛围");
  }
  if (lowEnergyMembers.length > allMembers.length / 2) {
    teamRecommendations.push("超过半数成员精力不足，建议考虑减少非关键任务");
  }

  const report: TeamEnergyReport = {
    teamEnergyIndex,
    overallTrend,
    members: memberEnergies,
    teamRecommendations,
    overloadedMembers,
    lowEnergyMembers,
  };

  // Optionally use LLM to generate deeper insights
  const useLLMEnhancement = searchParams.get("llm") === "true";
  if (useLLMEnhancement && memberEnergies.length > 0) {
    try {
      const llmEnhanced = await enhanceWithLLM(report, startStr, endStr);
      return cachedJson({
        dateRange: { start: startStr, end: endStr },
        ...llmEnhanced,
      }, CACHE_PRESETS.ANALYTICS);
    } catch (err) {
      console.error("LLM enhancement failed, returning basic report:", err);
      return cachedJson({
        dateRange: { start: startStr, end: endStr },
        ...report,
      }, CACHE_PRESETS.ANALYTICS);
    }
  }

  return cachedJson({
    dateRange: { start: startStr, end: endStr },
    ...report,
  }, CACHE_PRESETS.ANALYTICS);
}

/** Enhance report with LLM-powered analysis */
async function enhanceWithLLM(
  report: TeamEnergyReport,
  startStr: string,
  endStr: string
): Promise<TeamEnergyReport> {
  const dataText = report.members
    .map(
      (m) =>
        `【${m.memberName}】\n` +
        `精力指数: ${m.energyIndex}/100\n` +
        `活动水平: ${m.activityLevel}\n` +
        `情绪趋势: ${m.moodTrend}\n` +
        `风险信号: ${m.riskSignals.join(", ") || "无"}\n` +
        `建议: ${m.recommendations.join(", ") || "无"}`
    )
    .join("\n\n");

  const prompt = `你是团队能量分析专家。根据以下数据，分析团队能量状态并给出建议。

## 团队数据（${startStr} 至 ${endStr}）
${dataText}

## 团队整体指标
- 团队精力指数: ${report.teamEnergyIndex}/100
- 整体趋势: ${report.overallTrend}
- 过载成员: ${report.overloadedMembers.join(", ") || "无"}
- 低精力成员: ${report.lowEnergyMembers.join(", ") || "无"}

## 任务
1. 分析当前团队能量状态
2. 识别潜在问题
3. 提供改善建议

## 输出格式
请以以下JSON格式返回：
{
  "deepAnalysis": "深度分析文字描述",
  "improvedRecommendations": ["改善建议1", "改善建议2"],
  "earlyWarningSigns": ["早期预警信号1", "早期预警信号2"]
}

请只返回JSON，不要包含其他内容。`;

  const messages = [
    {
      role: "system" as const,
      content: "你是一个专业的团队能量分析专家，能够从行为数据中洞察团队状态。",
    },
    {
      role: "user" as const,
      content: prompt,
    },
  ];

  const response = await callLLM(messages, { maxTokens: 1500 });

  try {
    const match = response.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        ...report,
        teamRecommendations: [
          ...report.teamRecommendations,
          ...(parsed.deepAnalysis ? [parsed.deepAnalysis] : []),
          ...(parsed.improvedRecommendations || []),
        ],
        earlyWarningSigns: parsed.earlyWarningSigns || [],
      };
    }
  } catch (e) {
    console.error("Failed to parse LLM response:", e);
  }

  return report;
}