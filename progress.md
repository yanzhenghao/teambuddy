# TeamBuddy - 进度摘要

## 项目概述
研发小组管家 Agent，面向 3-5 人小型研发团队。核心能力：每日 standup 对话收集进展、可视化看板（甘特图+看板）、需求澄清与智能任务分配、风险预警。

## 技术栈
- **全栈**: TypeScript / Next.js (App Router)
- **数据库**: Drizzle ORM + SQLite（WAL 模式）
- **LLM**: MiniMax API (@anthropic-ai/sdk)
- **图表**: 自定义 CSS 甘特图 + HTML5 拖拽看板

## 完成进度

### Phase 1 — MVP 基础 (6/6 完成)
- [x] F001: 项目脚手架搭建
- [x] F002: 核心数据模型
- [x] F003: Channel Adapter + CLI/Web 适配器
- [x] F004: 对话引擎核心（含任务状态联动）
- [x] F005: 看板视图（拖拽改状态、按成员筛选）
- [x] F006: 甘特图视图（时间线、今日标记、状态着色）

### Phase 2 — 核心功能 (6/6 完成)
- [x] F007: 定时调度器（node-cron + 手动触发 API + 独立进程脚本）
- [x] F008: 需求澄清引擎（LLM 多轮对话拆解需求）
- [x] F009: 智能任务分配（技能匹配 + 负载均衡 + 管理者审批）
- [x] F010: 团队日报（日期导航、情绪指标、汇报率统计）
- [x] F011: 风险预警（超期/停滞/过载/阻塞/情绪 5 类告警）
- [x] F015: IR/FuR/AR 层级树形结构

### Phase 3 — 基础设施与体验 (18/18 完成)
- [x] F012: 真实 IM 适配器（飞书/钉钉/企业微信）✅
- [x] F013: 对话体验优化（智能追问、情绪感知）✅
- [x] F014: 权限控制（管理者/组员数据隔离）✅
- [x] F026: 密码安全加固（bcrypt）✅
- [x] F027: Turso Cloud 迁移 ✅
- [x] F028: LLMClient 公共封装 ✅
- [x] F029: 纯 DB 驱动会话管理 ✅
- [x] F030: 骨架屏 + 空状态优化 ✅
- [x] F031: 移动端适配 ✅
- [x] F032: Toast 通知系统 ✅
- [x] F033: 面包屑导航 ✅
- [x] F034: 键盘快捷键 ✅
- [x] F035: Vitest 单元测试框架 ✅
- [x] F036: API 集成测试 ✅
- [x] F037: GitHub Actions CI/CD ✅
- [x] F038: 测试金字塔实现 ✅
- [x] F047: 数据库索引优化 ✅
- [x] F048: Session Cookie 安全加固 ✅

### Phase 4 — 需求管理增强 (10/10)
- [x] F016: 版本/迭代管理 ✅
- [x] F017: 需求变更历史 ✅
- [x] F018: AI 自动分类 ✅
- [x] F019: 智能任务分解 ✅
- [x] F020: 需求依赖关系图 ✅
- [x] F021: 风险预警增强 ✅
- [x] F022: 燃尽图 ✅
- [x] F023: 事务一致性保证 ✅
- [x] F024: Serverless 会话持久化 ✅
- [x] F025: N+1 查询优化 ✅

### Phase 5 — AI 创新功能 (6/6)
- [x] F039: No-Standup Mode ✅
- [x] F042: 沉默风险预警 ✅
- [x] F043: 自动周报生成器 ✅
- [x] F044: 知识地图 ✅
- [x] F045: 一键上线检查 ✅
- [x] F046: 团队能量图 ✅

## 最近更新
- **F046 完成**：团队能量图（GET /api/analytics/team-energy，从行为信号推断团队精力状态，含过载预警）
- **F045 完成**：一键上线检查（POST /api/analytics/deployment-check，LLM 分析 PR/代码改动生成动态检查清单和风险识别）
- **F044 完成**：知识地图（GET /api/analytics/knowledge-map，建立人-知识领域映射，支持按技能搜索专家）
- **F043 完成**：自动周报生成器（POST /api/analytics/weekly-report，LLM 汇总任务完成/进展汇报生成结构化周报）
- **F042 完成**：沉默风险预警（GET /api/analytics/silent-risk，检测沉默/孤立/过载/停滞风险）
- **F039 完成**：No-Standup Mode（POST /api/analytics/progress-inference，LLM 分析 Git commits/PR/IM 消息推断进展）
- **F025 完成**：N+1 查询优化（getTeamProfiles 批量查询替代循环查询，树形 API 优化为 2 次查询）
- **F024 完成**：Serverless 会话持久化（会话数据持久化到数据库，DELETE /api/conversations 支持清理旧会话）
- **F023 完成**：事务一致性保证（confirm 操作使用 db.transaction()，创建 FuR/AR/任务在同一事务中）
- **F022 完成**：燃尽图（GET /api/analytics/burndown，返回每日数据点、计划vs实际曲线、预测完成时间）
- **F021 完成**：风险预警增强（新增 risk_warnings 表，POST /api/risk-warnings 扫描超期/停滞任务，支持标记已处理）
- **F020 完成**：需求依赖关系图（新增 requirement_dependencies 表，GET /dependencies/graph 支持循环检测和关键路径）
- **F019 完成**：智能任务分解（POST /api/requirement/decompose，AI 将 FuR 拆分为任务列表，含工期/技能/推荐人选）
- **F018 完成**：AI 自动分类（POST /api/requirement/classify，LLM 推荐 IR/FuR/AR 类型及置信度）
- **F017 完成**：需求变更历史（新增 requirement_history 表，需求修改自动记录快照，支持查看历史版本）
- **F016 完成**：版本/迭代管理（新增 versions 表，需求支持按版本隔离，API 支持版本过滤）
- **F027 完成**：Turso Cloud 迁移（删除 Cloudflare Workers 配置，Docker + Turso Cloud）
- **F013 完成**：对话体验优化（渐进式采集、情绪感知、新老成员差异化策略）
- **F012 完成**：真实 IM 适配器（飞书适配器 + Webhook 端点）
- **F031 完成**：移动端适配（hamburger menu + drawer 滑出式侧边栏）
- **F014 完成**：权限控制（管理者/组员数据隔离，14 个 API 路由权限校验）
- **F048 完成**：Session Cookie 安全加固（Secure flag 生产环境，HttpOnly+SameSite+Lax）
- **F047 完成**：数据库索引优化（9 个索引：tasks×3, requirements×3, members×1, sessions×1, requirement_conversations×1）
- **F038 完成**：测试金字塔实现（14 unit + 29 integration + 6 E2E）
- **F026 & F035 完成**：bcrypt 密码安全 + Vitest 单元测试框架（14 tests, 6 E2E）
- **需求管理重构**：IR → FuR → AR 三层树形结构上线
- **Serverless 会话持久化修复**：BE-1 修复，冷启动后会话恢复
- **Playwright E2E 测试**：6 个测试全部通过
- **多专家评审完成**：新增 22 个 Phase 3/4/5 功能（F026-F048）
- **差异化定位**："小型团队的 AI 研发管家" — 不是填表工具，是让 AI 替你做事的助手
