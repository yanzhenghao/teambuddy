"use client";

const roleLabels: Record<string, string> = {
  frontend: "前端开发",
  backend: "后端开发",
  fullstack: "全栈开发",
  test: "测试工程师",
};

const avatarColors: Record<string, string> = {
  m1: "bg-blue-500",
  m2: "bg-purple-500",
  m3: "bg-emerald-500",
  m4: "bg-orange-500",
  m5: "bg-cyan-500",
};

interface MemberStatusItem {
  id: string;
  name: string;
  role: string;
  maxLoad: number;
  currentLoad: number;
  hasBlocker: boolean;
  blockerText: string | null;
  daysSinceUpdate: number;
  noProgress: boolean;
  overloaded: boolean;
  mood: string | null;
}

interface RiskAlert {
  type: "overdue" | "near_due" | "no_progress" | "overloaded" | "blocker" | "negative_mood";
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  member?: string;
}

interface Props {
  totalTasks: number;
  inProgress: number;
  done: number;
  overdueCount: number;
  memberStatus: MemberStatusItem[];
  riskAlerts: RiskAlert[];
}

const severityStyles: Record<string, { bg: string; border: string; dot: string; title: string; text: string }> = {
  critical: {
    bg: "bg-red-50",
    border: "border-red-100",
    dot: "bg-red-500",
    title: "text-red-700",
    text: "text-red-600",
  },
  warning: {
    bg: "bg-yellow-50",
    border: "border-yellow-100",
    dot: "bg-yellow-500",
    title: "text-yellow-700",
    text: "text-yellow-600",
  },
  info: {
    bg: "bg-blue-50",
    border: "border-blue-100",
    dot: "bg-blue-500",
    title: "text-blue-700",
    text: "text-blue-600",
  },
};

const typeIcons: Record<string, string> = {
  overdue: "超期",
  near_due: "临期",
  no_progress: "停滞",
  overloaded: "过载",
  blocker: "阻塞",
  negative_mood: "情绪",
};

export function DashboardClient({
  totalTasks,
  inProgress,
  done,
  overdueCount,
  memberStatus,
  riskAlerts,
}: Props) {
  const completionRate = totalTasks > 0 ? Math.round((done / totalTasks) * 100) : 0;
  const criticalCount = riskAlerts.filter((a) => a.severity === "critical").length;
  const warningCount = riskAlerts.filter((a) => a.severity === "warning").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">总览</h1>
          <p className="text-sm text-gray-400 mt-1">
            {new Date().toLocaleDateString("zh-CN", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
          </p>
        </div>
        <button
          onClick={() => window.location.href = "/standup"}
          className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          触发今日 Standup
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="总任务" value={totalTasks} color="brand" sub={`完成率 ${completionRate}%`} />
        <StatCard label="进行中" value={inProgress} color="blue" sub={`${memberStatus.filter((m) => m.currentLoad > 0).length} 人正在推进`} />
        <StatCard label="已完成" value={done} color="green" sub={`完成率 ${completionRate}%`} />
        <StatCard
          label="风险项"
          value={riskAlerts.length}
          color="red"
          sub={
            riskAlerts.length > 0
              ? `${criticalCount} 严重 / ${warningCount} 警告`
              : "一切正常"
          }
          pulse={criticalCount > 0}
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Team Status */}
        <div className="col-span-2 bg-white rounded-xl border border-surface-200 p-5">
          <h3 className="font-semibold mb-4">团队状态</h3>
          <div className="space-y-4">
            {memberStatus.map((m) => (
              <div key={m.id} className="flex items-center gap-4 p-3 bg-surface-50 rounded-lg">
                <div
                  className={`w-8 h-8 ${avatarColors[m.id] || "bg-gray-500"} rounded-full flex items-center justify-center text-white text-xs font-semibold`}
                >
                  {m.name[0]}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{m.name}</span>
                    <div className="flex items-center gap-1.5">
                      {m.overloaded && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                          过载
                        </span>
                      )}
                      {m.noProgress && m.currentLoad > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                          {m.daysSinceUpdate}天未更新
                        </span>
                      )}
                      {m.hasBlocker && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          有阻塞
                        </span>
                      )}
                      {!m.hasBlocker && !m.overloaded && !(m.noProgress && m.currentLoad > 0) && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          正常
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {roleLabels[m.role] || m.role} &middot; 负载 {m.currentLoad}/{m.maxLoad}
                  </div>
                  <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        m.overloaded
                          ? "bg-red-500"
                          : m.currentLoad >= m.maxLoad - 1
                          ? "bg-yellow-500"
                          : avatarColors[m.id]?.replace("bg-", "bg-") || "bg-brand-500"
                      }`}
                      style={{
                        width: `${Math.min(100, (m.currentLoad / m.maxLoad) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Alerts Panel */}
        <div className="bg-white rounded-xl border border-surface-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">风险预警</h3>
            {riskAlerts.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">
                {riskAlerts.length}
              </span>
            )}
          </div>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {riskAlerts.map((alert, i) => {
              const style = severityStyles[alert.severity];
              return (
                <div
                  key={i}
                  className={`p-3 ${style.bg} border ${style.border} rounded-lg`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 ${style.dot} rounded-full ${alert.severity === "critical" ? "animate-pulse" : ""}`} />
                    <span className={`text-xs font-medium ${style.title}`}>
                      {typeIcons[alert.type] || alert.type}
                    </span>
                    <span className={`text-xs ${style.title}`}>
                      {alert.title}
                    </span>
                  </div>
                  <p className={`text-sm mt-1 ${style.text}`}>{alert.detail}</p>
                  {alert.member && (
                    <p className={`text-xs ${style.text} mt-0.5 opacity-75`}>
                      {alert.member}
                    </p>
                  )}
                </div>
              );
            })}
            {riskAlerts.length === 0 && (
              <div className="p-4 text-center text-sm text-gray-400">
                暂无风险项
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  sub,
  pulse,
}: {
  label: string;
  value: number;
  color: string;
  sub: string;
  pulse?: boolean;
}) {
  const colorMap: Record<string, { bg: string; text: string; iconBg: string }> = {
    brand: { bg: "bg-brand-50", text: "text-gray-900", iconBg: "bg-brand-50" },
    blue: { bg: "bg-blue-50", text: "text-blue-600", iconBg: "bg-blue-50" },
    green: { bg: "bg-green-50", text: "text-green-600", iconBg: "bg-green-50" },
    red: { bg: "bg-red-50", text: "text-red-500", iconBg: "bg-red-50" },
  };

  const c = colorMap[color] || colorMap.brand;

  return (
    <div className="bg-white rounded-xl p-5 border border-surface-200 hover:shadow-sm transition">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-sm text-gray-400">{label}</div>
          <div className={`text-3xl font-bold mt-1 ${c.text}`}>{value}</div>
        </div>
        <div className={`w-10 h-10 ${c.iconBg} rounded-lg flex items-center justify-center ${pulse ? "animate-pulse" : ""}`}>
          <div className={`w-3 h-3 rounded-full ${c.bg.replace("50", "500")}`} />
        </div>
      </div>
      <div className="mt-3 text-xs text-gray-400">{sub}</div>
    </div>
  );
}
