"use client";

import { useState, useEffect } from "react";

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

const moodIcons: Record<string, { emoji: string; label: string; color: string }> = {
  positive: { emoji: "^", label: "积极", color: "text-green-500" },
  normal: { emoji: "-", label: "正常", color: "text-gray-400" },
  negative: { emoji: "v", label: "低落", color: "text-red-500" },
};

interface MemberReport {
  id: string;
  name: string;
  role: string;
  completed: string[];
  planned: string[];
  blockers: string[];
  mood: string | null;
  activeTaskCount: number;
  overdueTaskCount: number;
}

interface ReportData {
  date: string;
  members: MemberReport[];
  totalCompleted: number;
  totalPlanned: number;
  totalBlockers: number;
  availableDates: string[];
}

export function ReportClient() {
  const [data, setData] = useState<ReportData | null>(null);
  const [currentDate, setCurrentDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<string | undefined>(undefined);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const generateSummary = async () => {
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/report/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: currentDate }),
      });
      const result = await res.json();
      setAiSummary(result.summary);
    } catch {
      setAiSummary("生成失败，请重试");
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetch(`/api/report?date=${currentDate}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [currentDate]);

  const navigateDate = (direction: -1 | 1) => {
    if (!data?.availableDates.length) return;
    const idx = data.availableDates.indexOf(currentDate);
    if (direction === -1) {
      // Go to previous (older) date
      const nextIdx = idx === -1 ? 0 : Math.min(idx + 1, data.availableDates.length - 1);
      setCurrentDate(data.availableDates[nextIdx]);
    } else {
      // Go to next (newer) date
      const nextIdx = idx <= 0 ? 0 : idx - 1;
      setCurrentDate(data.availableDates[nextIdx]);
    }
  };

  const isOldestDate = data?.availableDates
    ? currentDate === data.availableDates[data.availableDates.length - 1]
    : true;
  const isNewestDate = data?.availableDates
    ? currentDate === data.availableDates[0]
    : true;

  const formatDate = (d: string) => {
    const date = new Date(d + "T00:00:00");
    return date.toLocaleDateString("zh-CN", {
      month: "long",
      day: "numeric",
      weekday: "short",
    });
  };

  if (loading && !data) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">团队日报</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-surface-100 rounded-xl" />
          <div className="h-40 bg-surface-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const membersWithUpdates = data.members.filter(
    (m) => m.completed.length > 0 || m.planned.length > 0
  );
  const membersWithoutUpdates = data.members.filter(
    (m) => m.completed.length === 0 && m.planned.length === 0
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header with date navigation */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">团队日报</h1>
          <button
            onClick={generateSummary}
            disabled={summaryLoading}
            className="text-sm px-3 py-1 bg-brand-50 text-brand-600 border border-brand-200 rounded-lg hover:bg-brand-100 transition disabled:opacity-50"
          >
            {summaryLoading ? "生成中..." : "AI 总结"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateDate(-1)}
            disabled={isOldestDate}
            className="p-1.5 rounded-lg hover:bg-surface-100 disabled:opacity-30 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <select
              value={currentDate}
              onChange={(e) => setCurrentDate(e.target.value)}
              className="text-sm font-medium bg-white border border-surface-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
              {data.availableDates.map((d) => (
                <option key={d} value={d}>
                  {formatDate(d)}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => navigateDate(1)}
            disabled={isNewestDate}
            className="p-1.5 rounded-lg hover:bg-surface-100 disabled:opacity-30 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* AI Summary */}
      {aiSummary !== undefined && (
        <div className="bg-gradient-to-r from-brand-50 to-blue-50 rounded-xl border border-brand-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-brand-600">AI 总结</span>
            {!summaryLoading && (
              <button
                onClick={generateSummary}
                className="text-[10px] text-gray-400 hover:text-gray-600 underline"
              >
                重新生成
              </button>
            )}
          </div>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {summaryLoading ? "正在生成..." : aiSummary}
          </p>
        </div>
      )}

      {/* Summary stats */}
      <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
        <div className="grid grid-cols-4 border-b border-surface-200">
          <div className="p-4 text-center border-r border-surface-200">
            <div className="text-2xl font-bold text-green-600">{data.totalCompleted}</div>
            <div className="text-xs text-gray-400 mt-1">已完成项</div>
          </div>
          <div className="p-4 text-center border-r border-surface-200">
            <div className="text-2xl font-bold text-blue-600">{data.totalPlanned}</div>
            <div className="text-xs text-gray-400 mt-1">计划项</div>
          </div>
          <div className="p-4 text-center border-r border-surface-200">
            <div className={`text-2xl font-bold ${data.totalBlockers > 0 ? "text-red-500" : "text-gray-300"}`}>
              {data.totalBlockers}
            </div>
            <div className="text-xs text-gray-400 mt-1">阻塞项</div>
          </div>
          <div className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-700">
              {membersWithUpdates.length}/{data.members.length}
            </div>
            <div className="text-xs text-gray-400 mt-1">已汇报</div>
          </div>
        </div>

        {/* Per member reports */}
        <div className="divide-y divide-surface-100">
          {membersWithUpdates.map((m) => {
            const mood = m.mood ? moodIcons[m.mood] : null;
            return (
              <div key={m.id} className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-8 h-8 ${avatarColors[m.id] || "bg-gray-400"} rounded-full flex items-center justify-center text-white text-xs font-semibold`}>
                    {m.name[0]}
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-semibold">{m.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{roleLabels[m.role] || m.role}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {mood && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        mood.label === "积极" ? "bg-green-100 text-green-700" :
                        mood.label === "低落" ? "bg-red-100 text-red-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {mood.label}
                      </span>
                    )}
                    {m.overdueTaskCount > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                        {m.overdueTaskCount} 项超期
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      m.blockers.length > 0
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }`}>
                      {m.blockers.length > 0 ? "有阻塞" : "正常"}
                    </span>
                  </div>
                </div>
                <div className="ml-11 space-y-2">
                  {m.completed.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-gray-400 mb-1">昨日完成</div>
                      <ul className="text-sm space-y-1">
                        {m.completed.map((item: string, i: number) => (
                          <li key={i} className="flex items-center gap-2">
                            <span className="text-green-500">&#10003;</span> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {m.planned.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-gray-400 mb-1">今日计划</div>
                      <ul className="text-sm space-y-1">
                        {m.planned.map((item: string, i: number) => (
                          <li key={i} className="flex items-center gap-2">
                            <span className="text-blue-400">&#9675;</span> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {m.blockers.length > 0 && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded-lg">
                      <div className="text-xs font-medium text-red-600">阻塞项</div>
                      {m.blockers.map((b: string, i: number) => (
                        <p key={i} className="text-xs text-red-700 mt-1">{b}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Members without updates */}
          {membersWithoutUpdates.length > 0 && (
            <div className="p-5">
              <div className="text-xs font-medium text-gray-400 mb-3">未提交日报</div>
              <div className="flex gap-3">
                {membersWithoutUpdates.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-2 px-3 py-1.5 bg-surface-50 rounded-lg"
                  >
                    <div className={`w-6 h-6 ${avatarColors[m.id] || "bg-gray-400"} rounded-full flex items-center justify-center text-white text-[10px] font-semibold`}>
                      {m.name[0]}
                    </div>
                    <span className="text-sm text-gray-500">{m.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
