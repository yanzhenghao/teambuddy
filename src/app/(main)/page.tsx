import { db } from "@/db";
import { members, tasks, dailyUpdates } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { DashboardClient } from "@/app/dashboard-client";

export const dynamic = "force-dynamic";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.ceil(
    (new Date(b).getTime() - new Date(a).getTime()) / 86400000
  );
}

export default async function DashboardPage() {
  const today = todayStr();

  // Parallel queries - fetch all data at once
  const [allMembers, allTasks, allDailyUpdates] = await Promise.all([
    db.select().from(members).where(eq(members.status, "active")).all(),
    db.select().from(tasks).all(),
    db.select().from(dailyUpdates).orderBy(desc(dailyUpdates.date)).all(),
  ]);

  // Basic stats
  const totalTasks = allTasks.length;
  const inProgress = allTasks.filter((t) => t.status === "in_progress").length;
  const done = allTasks.filter((t) => t.status === "done").length;

  // Overdue tasks
  const overdueTasks = allTasks
    .filter((t) => t.dueDate && t.dueDate < today && t.status !== "done")
    .map((t) => ({
      title: t.title,
      assignee: allMembers.find((m) => m.id === t.assigneeId)?.name || "未分配",
      daysOverdue: daysBetween(t.dueDate!, today),
    }));

  // Near-due tasks (due within 1 day, not done)
  const nearDueTasks = allTasks
    .filter((t) => {
      if (!t.dueDate || t.status === "done") return false;
      const daysLeft = daysBetween(today, t.dueDate);
      return daysLeft >= 0 && daysLeft <= 1 && !overdueTasks.some((o) => o.title === t.title);
    })
    .map((t) => ({
      title: t.title,
      assignee: allMembers.find((m) => m.id === t.assigneeId)?.name || "未分配",
      dueDate: t.dueDate!,
    }));

  // Build latest update map (one query instead of N)
  const latestUpdateMap = new Map<string, typeof allDailyUpdates[0]>();
  for (const update of allDailyUpdates) {
    if (!latestUpdateMap.has(update.memberId)) {
      latestUpdateMap.set(update.memberId, update);
    }
  }

  // Member analysis - now using pre-fetched data
  const memberStatus = allMembers.map((m) => {
    const activeTasks = allTasks.filter(
      (t) => t.assigneeId === m.id && (t.status === "in_progress" || t.status === "in_review")
    );

    const latestUpdate = latestUpdateMap.get(m.id) || null;
    const todayUpdate = latestUpdate?.date === today ? latestUpdate : null;
    const blockers = todayUpdate ? JSON.parse(todayUpdate.blockers) : [];

    const daysSinceUpdate = latestUpdate
      ? daysBetween(latestUpdate.date, today)
      : 999;

    return {
      id: m.id,
      name: m.name,
      role: m.role,
      maxLoad: m.maxLoad,
      currentLoad: activeTasks.length,
      hasBlocker: blockers.length > 0,
      blockerText: blockers[0] || null,
      daysSinceUpdate,
      noProgress: daysSinceUpdate >= 3,
      overloaded: activeTasks.length >= m.maxLoad,
      mood: todayUpdate?.mood || latestUpdate?.mood || null,
    };
  });

  // Build risk alerts
  const riskAlerts: {
    type: "overdue" | "near_due" | "no_progress" | "overloaded" | "blocker" | "negative_mood";
    severity: "critical" | "warning" | "info";
    title: string;
    detail: string;
    member?: string;
  }[] = [];

  // Overdue tasks (critical)
  for (const t of overdueTasks) {
    riskAlerts.push({
      type: "overdue",
      severity: "critical",
      title: `任务超期 ${t.daysOverdue} 天`,
      detail: t.title,
      member: t.assignee,
    });
  }

  // Near-due tasks (warning)
  for (const t of nearDueTasks) {
    riskAlerts.push({
      type: "near_due",
      severity: "warning",
      title: "即将到期",
      detail: t.title,
      member: t.assignee,
    });
  }

  // No progress for 3+ days (warning)
  for (const m of memberStatus) {
    if (m.noProgress && m.currentLoad > 0) {
      riskAlerts.push({
        type: "no_progress",
        severity: "warning",
        title: `${m.daysSinceUpdate} 天未更新`,
        detail: `${m.name} 有 ${m.currentLoad} 个进行中任务但已 ${m.daysSinceUpdate} 天没有进展更新`,
        member: m.name,
      });
    }
  }

  // Overloaded members (warning)
  for (const m of memberStatus) {
    if (m.overloaded) {
      riskAlerts.push({
        type: "overloaded",
        severity: "warning",
        title: "负载过高",
        detail: `${m.name} 当前负载 ${m.currentLoad}/${m.maxLoad}，已达上限`,
        member: m.name,
      });
    }
  }

  // Blockers (info)
  for (const m of memberStatus) {
    if (m.hasBlocker) {
      riskAlerts.push({
        type: "blocker",
        severity: "info",
        title: "存在阻塞",
        detail: m.blockerText || "有阻塞项",
        member: m.name,
      });
    }
  }

  // Negative mood (info)
  for (const m of memberStatus) {
    if (m.mood === "negative") {
      riskAlerts.push({
        type: "negative_mood",
        severity: "info",
        title: "情绪低落",
        detail: `${m.name} 近期情绪状态不佳，建议关注`,
        member: m.name,
      });
    }
  }

  return (
    <DashboardClient
      totalTasks={totalTasks}
      inProgress={inProgress}
      done={done}
      overdueCount={overdueTasks.length}
      memberStatus={memberStatus}
      riskAlerts={riskAlerts}
    />
  );
}
