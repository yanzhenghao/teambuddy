"use client";

import { useState, useEffect } from "react";

interface KnowledgeMapEntry {
  memberId: string;
  memberName: string;
  expertise: string[];
  recentTopics: string[];
  contributionScore: number;
}

interface RiskAlert {
  memberId: string;
  memberName: string;
  riskType: string;
  severity: string;
  message: string;
  recommendation: string;
}

interface TeamEnergy {
  teamEnergyIndex: number;
  overallTrend: string;
  members: {
    memberId: string;
    memberName: string;
    energyIndex: number;
    moodTrend: string;
    activityLevel: string;
    riskSignals: string[];
  }[];
  overloadedMembers: string[];
  lowEnergyMembers: string[];
}

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<"knowledge" | "risk" | "energy">("knowledge");
  const [knowledgeMap, setKnowledgeMap] = useState<KnowledgeMapEntry[]>([]);
  const [riskAlerts, setRiskAlerts] = useState<RiskAlert[]>([]);
  const [teamEnergy, setTeamEnergy] = useState<TeamEnergy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchKnowledgeMap() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analytics/knowledge-map");
      if (!res.ok) throw new Error("获取知识地图失败");
      const data = await res.json();
      setKnowledgeMap(data.expertiseMap || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchRiskAlerts() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analytics/silent-risk?days=7");
      if (!res.ok) throw new Error("获取风险预警失败");
      const data = await res.json();
      setRiskAlerts(data.alerts || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchTeamEnergy() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analytics/team-energy?days=7");
      if (!res.ok) throw new Error("获取团队能量失败");
      const data = await res.json();
      setTeamEnergy(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "knowledge") fetchKnowledgeMap();
    else if (activeTab === "risk") fetchRiskAlerts();
    else if (activeTab === "energy") fetchTeamEnergy();
  }, [activeTab]);

  const tabs = [
    { id: "knowledge", label: "知识地图", fetch: fetchKnowledgeMap },
    { id: "risk", label: "风险预警", fetch: fetchRiskAlerts },
    { id: "energy", label: "团队能量", fetch: fetchTeamEnergy },
  ] as const;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">AI 团队分析</h1>
        <p className="text-gray-500 mt-1">智能分析团队知识、风险和精力状态</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-brand-500 text-brand-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-600 text-sm">{error}</p>
          <button
            onClick={() => tabs.find((t) => t.id === activeTab)?.fetch()}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            重试
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
        </div>
      )}

      {/* Knowledge Map */}
      {!loading && activeTab === "knowledge" && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-800 text-sm">
              <span className="font-semibold">知识地图</span> — 根据成员技能和角色建立人-知识领域映射，精准推荐知道答案的人
            </p>
          </div>

          {knowledgeMap.length === 0 ? (
            <div className="text-center py-12 text-gray-500">暂无数据</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {knowledgeMap.map((member) => (
                <div
                  key={member.memberId}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center">
                      <span className="text-brand-600 font-semibold">
                        {member.memberName[0]}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{member.memberName}</h3>
                      <p className="text-xs text-gray-500">
                        贡献指数: {member.contributionScore}
                      </p>
                    </div>
                  </div>

                  <div className="mb-3">
                    <p className="text-xs text-gray-500 mb-1">专业领域</p>
                    <div className="flex flex-wrap gap-1">
                      {member.expertise.slice(0, 5).map((exp) => (
                        <span
                          key={exp}
                          className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full"
                        >
                          {exp}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-1">最近主题</p>
                    <div className="flex flex-wrap gap-1">
                      {member.recentTopics.slice(0, 3).map((topic) => (
                        <span
                          key={topic}
                          className="px-2 py-0.5 bg-gray-50 text-gray-600 text-xs rounded-full"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Risk Alerts */}
      {!loading && activeTab === "risk" && (
        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
            <p className="text-orange-800 text-sm">
              <span className="font-semibold">风险预警</span> — 检测沉默、孤立、过载、停滞等团队风险
            </p>
          </div>

          {riskAlerts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">暂无风险预警，团队状态良好</div>
          ) : (
            <div className="space-y-3">
              {riskAlerts.map((alert, idx) => (
                <div
                  key={idx}
                  className={`border rounded-lg p-4 ${
                    alert.severity === "high"
                      ? "border-red-300 bg-red-50"
                      : alert.severity === "medium"
                      ? "border-orange-300 bg-orange-50"
                      : "border-yellow-300 bg-yellow-50"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          alert.severity === "high"
                            ? "bg-red-100 text-red-700"
                            : alert.severity === "medium"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {alert.riskType === "silent"
                          ? "沉默"
                          : alert.riskType === "isolated"
                          ? "孤立"
                          : alert.riskType === "overloaded"
                          ? "过载"
                          : alert.riskType === "stale"
                          ? "停滞"
                          : alert.riskType}
                      </span>
                      <span className="font-medium text-gray-900">{alert.memberName}</span>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-gray-700">{alert.message}</p>
                  <p className="mt-1 text-sm text-gray-500">
                    <span className="font-medium">建议:</span> {alert.recommendation}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Team Energy */}
      {!loading && activeTab === "energy" && teamEnergy && (
        <div className="space-y-6">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
            <p className="text-purple-800 text-sm">
              <span className="font-semibold">团队能量图</span> — 从行为信号推断团队精力状态，识别过载和低能量成员
            </p>
          </div>

          {/* Team Overview */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <p className="text-sm text-gray-500 mb-1">团队精力指数</p>
              <p className="text-3xl font-bold text-purple-600">
                {teamEnergy.teamEnergyIndex}
                <span className="text-lg text-gray-400">/100</span>
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <p className="text-sm text-gray-500 mb-1">整体趋势</p>
              <p className="text-lg font-semibold">
                {teamEnergy.overallTrend === "rising" ? (
                  <span className="text-green-600">↑ 上升</span>
                ) : teamEnergy.overallTrend === "declining" ? (
                  <span className="text-red-600">↓ 下降</span>
                ) : (
                  <span className="text-gray-600">→ 稳定</span>
                )}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <p className="text-sm text-gray-500 mb-1">过载成员</p>
              <p className="text-lg font-semibold text-orange-600">
                {teamEnergy.overloadedMembers.length > 0
                  ? teamEnergy.overloadedMembers.join(", ")
                  : "无"}
              </p>
            </div>
          </div>

          {/* Member Energy */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-medium text-gray-900 mb-4">成员精力明细</h3>
            <div className="space-y-4">
              {teamEnergy.members.map((member) => (
                <div key={member.memberId} className="flex items-center gap-4">
                  <div className="w-24 font-medium text-gray-700 truncate">{member.memberName}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            member.energyIndex >= 70
                              ? "bg-green-500"
                              : member.energyIndex >= 40
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${member.energyIndex}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-12 text-right">
                        {member.energyIndex}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-32">
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full ${
                        member.activityLevel === "overloaded"
                          ? "bg-red-100 text-red-700"
                          : member.activityLevel === "high"
                          ? "bg-orange-100 text-orange-700"
                          : member.activityLevel === "low"
                          ? "bg-gray-100 text-gray-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {member.activityLevel === "overloaded"
                        ? "过载"
                        : member.activityLevel === "high"
                        ? "繁忙"
                        : member.activityLevel === "low"
                        ? "低活跃"
                        : "正常"}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full ${
                        member.moodTrend === "rising"
                          ? "bg-green-100 text-green-700"
                          : member.moodTrend === "declining"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {member.moodTrend === "rising"
                        ? "↑"
                        : member.moodTrend === "declining"
                        ? "↓"
                        : "→"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Low Energy Members */}
          {teamEnergy.lowEnergyMembers.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm">
                <span className="font-semibold">低能量警告:</span>{" "}
                {teamEnergy.lowEnergyMembers.join(", ")} 精力指数低于 40，建议关注
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
