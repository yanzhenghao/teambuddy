import { db } from "./index";
import { members, tasks, dailyUpdates, conversations, users, requirementConversations } from "./schema";
import bcrypt from "bcrypt";

const BCRYPT_SALT_ROUNDS = 12;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Seed the database with rich sample data for development.
 * Run with: npx tsx src/db/seed.ts
 */
async function seed() {
  console.log("Seeding database...");

  // Clear existing data (order matters for FK constraints)
  await db.delete(conversations).run();
  await db.delete(requirementConversations).run();
  await db.delete(dailyUpdates).run();
  await db.delete(tasks).run();
  await db.delete(members).run();
  await db.delete(users).run();

  // ========== Members ==========
  const memberData = [
    {
      id: "m1",
      name: "李明",
      role: "frontend",
      skills: JSON.stringify(["React", "TypeScript", "Tailwind", "Next.js", "Figma"]),
      maxLoad: 3,
    },
    {
      id: "m2",
      name: "王芳",
      role: "backend",
      skills: JSON.stringify(["Node.js", "PostgreSQL", "Redis", "Docker", "GraphQL"]),
      maxLoad: 3,
    },
    {
      id: "m3",
      name: "张伟",
      role: "fullstack",
      skills: JSON.stringify(["React", "Node.js", "TypeScript", "DevOps", "AWS"]),
      maxLoad: 4,
    },
    {
      id: "m4",
      name: "陈静",
      role: "test",
      skills: JSON.stringify(["Playwright", "Jest", "Postman", "JMeter", "Cypress"]),
      maxLoad: 3,
    },
    {
      id: "m5",
      name: "赵磊",
      role: "backend",
      skills: JSON.stringify(["Go", "gRPC", "Kafka", "Kubernetes", "PostgreSQL"]),
      maxLoad: 3,
    },
  ];

  for (const m of memberData) {
    await db.insert(members).values(m).run();
  }

  // ========== Admin User ==========
  const adminHash = await hashPassword("admin123");
  await db.insert(users).values({
    id: "admin",
    username: "admin",
    passwordHash: adminHash,
    name: "管理员",
    role: "admin",
  }).run();

  // ========== Tasks (20 tasks, varied statuses) ==========
  const taskData = [
    // --- Done tasks (completed in past) ---
    {
      id: "t1",
      title: "项目脚手架搭建",
      description: "Next.js + Drizzle + Tailwind 初始化",
      assigneeId: "m3",
      priority: "P0",
      status: "done",
      category: "feature",
      estimatedDays: 2,
      actualDays: 2,
      startDate: "2026-03-03",
      dueDate: "2026-03-05",
      completedDate: "2026-03-04",
    },
    {
      id: "t2",
      title: "数据库 Schema 设计",
      description: "Drizzle ORM schema 定义，包含成员、任务、每日更新等表",
      assigneeId: "m2",
      priority: "P0",
      status: "done",
      category: "feature",
      estimatedDays: 3,
      actualDays: 3,
      startDate: "2026-03-04",
      dueDate: "2026-03-07",
      completedDate: "2026-03-06",
    },
    {
      id: "t3",
      title: "首页 UI 开发",
      description: "Landing page + 导航框架 + 侧边栏",
      assigneeId: "m1",
      priority: "P1",
      status: "done",
      category: "feature",
      estimatedDays: 2,
      actualDays: 2,
      startDate: "2026-03-05",
      dueDate: "2026-03-07",
      completedDate: "2026-03-07",
    },
    {
      id: "t4",
      title: "REST API 基础架构",
      description: "路由、中间件、错误处理、请求验证",
      assigneeId: "m5",
      priority: "P0",
      status: "done",
      category: "feature",
      estimatedDays: 3,
      actualDays: 2,
      startDate: "2026-03-05",
      dueDate: "2026-03-08",
      completedDate: "2026-03-07",
    },
    {
      id: "t5",
      title: "单元测试框架搭建",
      description: "Jest + Testing Library 配置，CI 集成",
      assigneeId: "m4",
      priority: "P1",
      status: "done",
      category: "test",
      estimatedDays: 2,
      actualDays: 2,
      startDate: "2026-03-06",
      dueDate: "2026-03-08",
      completedDate: "2026-03-08",
    },

    // --- In-progress tasks ---
    {
      id: "t6",
      title: "用户认证模块",
      description: "JWT + OAuth2.0 登录，包含微信和钉钉登录",
      assigneeId: "m1",
      priority: "P0",
      status: "in_progress",
      category: "feature",
      estimatedDays: 5,
      startDate: "2026-03-09",
      dueDate: "2026-03-14",
    },
    {
      id: "t7",
      title: "支付接口对接",
      description: "接入微信支付和支付宝，含回调通知处理",
      assigneeId: "m2",
      priority: "P0",
      status: "in_progress",
      category: "feature",
      estimatedDays: 5,
      startDate: "2026-03-08",
      dueDate: "2026-03-11", // overdue!
    },
    {
      id: "t8",
      title: "数据库查询优化",
      description: "慢查询分析、索引优化、连接池调优",
      assigneeId: "m5",
      priority: "P1",
      status: "in_progress",
      category: "optimization",
      estimatedDays: 4,
      startDate: "2026-03-10",
      dueDate: "2026-03-14",
    },
    {
      id: "t9",
      title: "消息推送服务",
      description: "WebSocket 实时推送 + 消息队列 + 离线消息缓存",
      assigneeId: "m3",
      priority: "P1",
      status: "in_progress",
      category: "feature",
      estimatedDays: 5,
      startDate: "2026-03-10",
      dueDate: "2026-03-15",
    },
    {
      id: "t10",
      title: "API 接口自动化测试",
      description: "使用 Supertest 编写核心 API 自动化测试",
      assigneeId: "m4",
      priority: "P1",
      status: "in_progress",
      category: "test",
      estimatedDays: 4,
      startDate: "2026-03-10",
      dueDate: "2026-03-14",
    },
    {
      id: "t11",
      title: "订单列表页面",
      description: "订单列表、筛选、分页、详情弹窗",
      assigneeId: "m1",
      priority: "P1",
      status: "in_progress",
      category: "feature",
      estimatedDays: 3,
      startDate: "2026-03-11",
      dueDate: "2026-03-14",
    },

    // --- In-review tasks ---
    {
      id: "t12",
      title: "文件上传服务",
      description: "OSS 直传 + 签名 URL + 图片裁剪压缩",
      assigneeId: "m3",
      priority: "P1",
      status: "in_review",
      category: "feature",
      estimatedDays: 3,
      startDate: "2026-03-08",
      dueDate: "2026-03-11",
    },

    // --- Todo tasks (not started yet) ---
    {
      id: "t13",
      title: "E2E 测试用例编写",
      description: "登录、注册、支付完整流程 E2E 测试",
      assigneeId: "m4",
      priority: "P2",
      status: "todo",
      category: "test",
      estimatedDays: 3,
      startDate: "2026-03-15",
      dueDate: "2026-03-18",
    },
    {
      id: "t14",
      title: "权限管理系统",
      description: "RBAC 角色权限控制，菜单权限、数据权限",
      assigneeId: "m5",
      priority: "P1",
      status: "todo",
      category: "feature",
      estimatedDays: 5,
      startDate: "2026-03-15",
      dueDate: "2026-03-20",
    },
    {
      id: "t15",
      title: "数据看板页面",
      description: "ECharts 图表，日活、交易额、转化率等核心指标",
      assigneeId: "m1",
      priority: "P2",
      status: "todo",
      category: "feature",
      estimatedDays: 4,
      startDate: "2026-03-16",
      dueDate: "2026-03-20",
    },
    {
      id: "t16",
      title: "日志收集与监控",
      description: "Winston 日志 + Prometheus 指标 + Grafana 面板",
      assigneeId: "m3",
      priority: "P2",
      status: "todo",
      category: "feature",
      estimatedDays: 3,
      startDate: "2026-03-16",
      dueDate: "2026-03-19",
    },
    {
      id: "t17",
      title: "消息通知中心",
      description: "站内信 + 邮件 + 短信通知，支持模板管理",
      assigneeId: "m2",
      priority: "P2",
      status: "todo",
      category: "feature",
      estimatedDays: 4,
      startDate: "2026-03-16",
      dueDate: "2026-03-20",
    },

    // --- Unassigned tasks ---
    {
      id: "t18",
      title: "用户头像上传功能",
      description: "包含裁剪、压缩、OSS 上传、默认头像生成",
      priority: "P2",
      status: "unassigned",
      category: "new_req",
      estimatedDays: 3,
    },
    {
      id: "t19",
      title: "移动端适配",
      description: "响应式布局 + PWA 支持 + 触摸手势优化",
      priority: "P3",
      status: "unassigned",
      category: "new_req",
      estimatedDays: 5,
    },
    {
      id: "t20",
      title: "数据导出功能",
      description: "订单数据、用户数据 Excel/CSV 导出，支持大数据量分片",
      priority: "P2",
      status: "unassigned",
      category: "new_req",
      estimatedDays: 2,
    },
  ];

  for (const t of taskData) {
    await db.insert(tasks).values(t).run();
  }

  // ========== Daily Updates (5 days of history: 3/9 ~ 3/13) ==========
  const updateData = [
    // --- 3月9日 (周一) ---
    {
      id: "du-0309-m1",
      memberId: "m1",
      date: "2026-03-09",
      completedItems: JSON.stringify(["首页 UI 开发完毕并提交 PR", "Sidebar 组件优化"]),
      plannedItems: JSON.stringify(["开始用户认证模块", "调研微信登录 SDK"]),
      blockers: JSON.stringify([]),
      mood: "positive",
    },
    {
      id: "du-0309-m2",
      memberId: "m2",
      date: "2026-03-09",
      completedItems: JSON.stringify(["Schema 设计定稿", "数据迁移脚本编写"]),
      plannedItems: JSON.stringify(["开始支付接口调研"]),
      blockers: JSON.stringify([]),
      mood: "positive",
    },
    {
      id: "du-0309-m3",
      memberId: "m3",
      date: "2026-03-09",
      completedItems: JSON.stringify(["项目部署脚本编写", "CI/CD 流水线配置"]),
      plannedItems: JSON.stringify(["开始消息推送服务技术选型"]),
      blockers: JSON.stringify([]),
      mood: "normal",
    },
    {
      id: "du-0309-m4",
      memberId: "m4",
      date: "2026-03-09",
      completedItems: JSON.stringify(["Jest 和 Testing Library 配置完成"]),
      plannedItems: JSON.stringify(["编写成员管理 API 的测试用例"]),
      blockers: JSON.stringify([]),
      mood: "normal",
    },
    {
      id: "du-0309-m5",
      memberId: "m5",
      date: "2026-03-09",
      completedItems: JSON.stringify(["REST API 基础架构完成", "统一错误处理中间件"]),
      plannedItems: JSON.stringify(["编写 API 文档", "开始数据库查询优化"]),
      blockers: JSON.stringify([]),
      mood: "positive",
    },

    // --- 3月10日 (周二) ---
    {
      id: "du-0310-m1",
      memberId: "m1",
      date: "2026-03-10",
      completedItems: JSON.stringify(["微信登录 SDK 调研完成", "登录页面设计稿确认"]),
      plannedItems: JSON.stringify(["实现登录页面 UI", "对接 OAuth2.0 授权流程"]),
      blockers: JSON.stringify([]),
      mood: "normal",
    },
    {
      id: "du-0310-m2",
      memberId: "m2",
      date: "2026-03-10",
      completedItems: JSON.stringify(["支付接口 SDK 集成"]),
      plannedItems: JSON.stringify(["实现微信支付回调", "编写支付相关单测"]),
      blockers: JSON.stringify(["第三方支付平台沙箱环境不稳定，频繁超时"]),
      mood: "negative",
    },
    {
      id: "du-0310-m3",
      memberId: "m3",
      date: "2026-03-10",
      completedItems: JSON.stringify(["消息推送技术选型：确定用 Socket.io"]),
      plannedItems: JSON.stringify(["搭建 WebSocket 服务", "实现基础的连接管理"]),
      blockers: JSON.stringify([]),
      mood: "normal",
    },
    {
      id: "du-0310-m4",
      memberId: "m4",
      date: "2026-03-10",
      completedItems: JSON.stringify(["成员管理 API 测试 8 个用例全通过"]),
      plannedItems: JSON.stringify(["编写任务管理 API 测试用例", "接口边界条件覆盖"]),
      blockers: JSON.stringify([]),
      mood: "positive",
    },
    {
      id: "du-0310-m5",
      memberId: "m5",
      date: "2026-03-10",
      completedItems: JSON.stringify(["API 文档 Swagger 集成"]),
      plannedItems: JSON.stringify(["分析慢查询日志", "优化首页列表查询"]),
      blockers: JSON.stringify([]),
      mood: "normal",
    },

    // --- 3月11日 (周三) ---
    {
      id: "du-0311-m1",
      memberId: "m1",
      date: "2026-03-11",
      completedItems: JSON.stringify(["登录页面 UI 完成", "OAuth2.0 回调处理实现"]),
      plannedItems: JSON.stringify(["Token 刷新逻辑", "登录状态持久化"]),
      blockers: JSON.stringify([]),
      mood: "positive",
    },
    {
      id: "du-0311-m2",
      memberId: "m2",
      date: "2026-03-11",
      completedItems: JSON.stringify(["微信支付回调处理（本地 mock 通过）"]),
      plannedItems: JSON.stringify(["支付宝接口对接", "继续等沙箱环境恢复"]),
      blockers: JSON.stringify(["第三方支付沙箱依然不稳定，已联系对方技术支持"]),
      mood: "negative",
    },
    {
      id: "du-0311-m3",
      memberId: "m3",
      date: "2026-03-11",
      completedItems: JSON.stringify(["WebSocket 基础连接管理", "文件上传服务开发完成（提交 review）"]),
      plannedItems: JSON.stringify(["消息队列集成", "处理文件上传 PR review 意见"]),
      blockers: JSON.stringify([]),
      mood: "positive",
    },
    {
      id: "du-0311-m4",
      memberId: "m4",
      date: "2026-03-11",
      completedItems: JSON.stringify(["任务管理 API 测试 12 个用例", "发现了一个分页 bug 并提交 issue"]),
      plannedItems: JSON.stringify(["继续扩展边界条件测试", "开始 API 自动化框架搭建"]),
      blockers: JSON.stringify([]),
      mood: "normal",
    },
    {
      id: "du-0311-m5",
      memberId: "m5",
      date: "2026-03-11",
      completedItems: JSON.stringify(["慢查询分析报告产出", "首页列表查询从 800ms 优化到 120ms"]),
      plannedItems: JSON.stringify(["优化订单相关查询", "添加复合索引"]),
      blockers: JSON.stringify([]),
      mood: "positive",
    },

    // --- 3月12日 (周四) ---
    {
      id: "du-0312-m1",
      memberId: "m1",
      date: "2026-03-12",
      completedItems: JSON.stringify(["Token 刷新逻辑实现", "登录态持久化（localStorage + Cookie）"]),
      plannedItems: JSON.stringify(["钉钉登录对接", "开始订单列表页面"]),
      blockers: JSON.stringify(["钉钉开放平台审核还没通过，要 1-2 天"]),
      mood: "normal",
    },
    {
      id: "du-0312-m2",
      memberId: "m2",
      date: "2026-03-12",
      completedItems: JSON.stringify(["支付宝接口对接完成"]),
      plannedItems: JSON.stringify(["联调微信支付（沙箱恢复了）", "编写支付回调幂等处理"]),
      blockers: JSON.stringify([]),
      mood: "normal",
    },
    {
      id: "du-0312-m3",
      memberId: "m3",
      date: "2026-03-12",
      completedItems: JSON.stringify(["消息队列集成（使用 BullMQ）", "文件上传 PR review 意见处理"]),
      plannedItems: JSON.stringify(["实现离线消息缓存", "消息推送压力测试"]),
      blockers: JSON.stringify([]),
      mood: "normal",
    },
    {
      id: "du-0312-m4",
      memberId: "m4",
      date: "2026-03-12",
      completedItems: JSON.stringify(["API 自动化框架搭建", "Supertest + 数据工厂模式"]),
      plannedItems: JSON.stringify(["编写用户认证相关测试", "性能基线测试"]),
      blockers: JSON.stringify(["认证模块还没开发完，先写其他测试"]),
      mood: "normal",
    },
    {
      id: "du-0312-m5",
      memberId: "m5",
      date: "2026-03-12",
      completedItems: JSON.stringify(["订单查询优化，添加了 3 个复合索引"]),
      plannedItems: JSON.stringify(["连接池调优", "准备数据库优化总结报告"]),
      blockers: JSON.stringify([]),
      mood: "positive",
    },

    // --- 3月13日 (周五 / 今天) ---
    {
      id: "du-0313-m1",
      memberId: "m1",
      date: "2026-03-13",
      completedItems: JSON.stringify(["订单列表页面基础布局完成", "筛选和分页功能实现"]),
      plannedItems: JSON.stringify(["订单详情弹窗", "认证模块收尾（等钉钉审核）"]),
      blockers: JSON.stringify(["钉钉开放平台审核仍在等待中"]),
      mood: "normal",
    },
    {
      id: "du-0313-m2",
      memberId: "m2",
      date: "2026-03-13",
      completedItems: JSON.stringify(["微信支付联调通过", "支付回调幂等处理完成"]),
      plannedItems: JSON.stringify(["支付异常场景测试", "整理支付模块文档"]),
      blockers: JSON.stringify([]),
      mood: "positive",
    },
    {
      id: "du-0313-m3",
      memberId: "m3",
      date: "2026-03-13",
      completedItems: JSON.stringify(["离线消息缓存实现", "消息推送压测通过（5000 并发）"]),
      plannedItems: JSON.stringify(["消息推送服务部署", "开始日志收集调研"]),
      blockers: JSON.stringify([]),
      mood: "positive",
    },
    {
      id: "du-0313-m4",
      memberId: "m4",
      date: "2026-03-13",
      completedItems: JSON.stringify(["API 自动化测试 25 个用例全通过", "发现并报告了 2 个接口 bug"]),
      plannedItems: JSON.stringify(["继续补充边界条件测试", "开始写性能测试脚本"]),
      blockers: JSON.stringify([]),
      mood: "positive",
    },
    {
      id: "du-0313-m5",
      memberId: "m5",
      date: "2026-03-13",
      completedItems: JSON.stringify(["连接池调优完成", "数据库优化总结报告"]),
      plannedItems: JSON.stringify(["开始权限管理系统设计", "RBAC 方案调研"]),
      blockers: JSON.stringify([]),
      mood: "normal",
    },
  ];

  for (const u of updateData) {
    await db.insert(dailyUpdates).values(u).run();
  }

  // ========== Conversation Records (sample standup histories) ==========
  const conversationData = [
    // --- 3月12日对话 ---
    {
      id: "conv-0312-m1",
      memberId: "m1",
      date: "2026-03-12",
      status: "completed",
      startedAt: "2026-03-12T09:00:12.000Z",
      completedAt: "2026-03-12T09:03:45.000Z",
      messages: JSON.stringify([
        { role: "agent", content: "早上好李明！昨天登录页面做得怎么样了？Token 刷新逻辑搞定了吗？", timestamp: "2026-03-12T09:00:12.000Z" },
        { role: "member", content: "搞定了！Token 刷新和登录态持久化都做完了，localStorage 和 Cookie 双保险。今天打算对接钉钉登录，然后开始订单列表页面。不过钉钉那边审核还没通过，估计要等一两天。", timestamp: "2026-03-12T09:01:30.000Z" },
        { role: "agent", content: "进度很快啊！钉钉审核等待是正常的，先推进订单页面是个好安排。今天任务还挺满的，注意节奏哈！👍", timestamp: "2026-03-12T09:03:45.000Z" },
      ]),
      extractedData: JSON.stringify({
        completed_items: ["Token 刷新逻辑实现", "登录态持久化（localStorage + Cookie）"],
        planned_items: ["钉钉登录对接", "开始订单列表页面"],
        blockers: ["钉钉开放平台审核还没通过，要 1-2 天"],
        mood: "normal",
        task_updates: [],
      }),
    },
    {
      id: "conv-0312-m2",
      memberId: "m2",
      date: "2026-03-12",
      status: "completed",
      startedAt: "2026-03-12T09:05:00.000Z",
      completedAt: "2026-03-12T09:08:20.000Z",
      messages: JSON.stringify([
        { role: "agent", content: "王芳早！支付对接进展怎么样？沙箱环境的问题解决了吗？", timestamp: "2026-03-12T09:05:00.000Z" },
        { role: "member", content: "沙箱昨晚恢复了！支付宝接口对接完成了。今天打算联调微信支付，然后写回调的幂等处理。", timestamp: "2026-03-12T09:06:15.000Z" },
        { role: "agent", content: "太好了，沙箱终于恢复了！支付回调的幂等处理很关键，要注意并发场景下的重复通知问题。加油！", timestamp: "2026-03-12T09:08:20.000Z" },
      ]),
      extractedData: JSON.stringify({
        completed_items: ["支付宝接口对接完成"],
        planned_items: ["联调微信支付（沙箱恢复了）", "编写支付回调幂等处理"],
        blockers: [],
        mood: "normal",
        task_updates: [],
      }),
    },
    {
      id: "conv-0312-m3",
      memberId: "m3",
      date: "2026-03-12",
      status: "completed",
      startedAt: "2026-03-12T09:10:00.000Z",
      completedAt: "2026-03-12T09:14:00.000Z",
      messages: JSON.stringify([
        { role: "agent", content: "嗨张伟！文件上传的 PR review 意见处理完了吗？消息队列集成得怎么样了？", timestamp: "2026-03-12T09:10:00.000Z" },
        { role: "member", content: "PR 意见昨天处理完了，消息队列也集成了，用的 BullMQ。今天继续搞离线消息缓存和压测。", timestamp: "2026-03-12T09:11:30.000Z" },
        { role: "agent", content: "进度不错！BullMQ 是个好选择。压测的时候注意关注内存和连接数指标，防止资源泄漏。继续保持！", timestamp: "2026-03-12T09:14:00.000Z" },
      ]),
      extractedData: JSON.stringify({
        completed_items: ["消息队列集成（使用 BullMQ）", "文件上传 PR review 意见处理"],
        planned_items: ["实现离线消息缓存", "消息推送压力测试"],
        blockers: [],
        mood: "normal",
        task_updates: [],
      }),
    },
    {
      id: "conv-0312-m5",
      memberId: "m5",
      date: "2026-03-12",
      status: "completed",
      startedAt: "2026-03-12T09:20:00.000Z",
      completedAt: "2026-03-12T09:24:00.000Z",
      messages: JSON.stringify([
        { role: "agent", content: "赵磊早上好！订单查询优化进展如何？索引加了吗？", timestamp: "2026-03-12T09:20:00.000Z" },
        { role: "member", content: "加了 3 个复合索引，订单列表查询从 600ms 降到了 80ms，效果很明显。今天准备调优连接池，然后写个优化总结报告。", timestamp: "2026-03-12T09:21:45.000Z" },
        { role: "agent", content: "600ms 降到 80ms，提升巨大！总结报告写好分享给团队吧，大家都能学习。", timestamp: "2026-03-12T09:24:00.000Z" },
      ]),
      extractedData: JSON.stringify({
        completed_items: ["订单查询优化，添加了 3 个复合索引"],
        planned_items: ["连接池调优", "准备数据库优化总结报告"],
        blockers: [],
        mood: "positive",
        task_updates: [],
      }),
    },

    // --- 3月13日对话 (今天) ---
    {
      id: "conv-0313-m2",
      memberId: "m2",
      date: "2026-03-13",
      status: "completed",
      startedAt: "2026-03-13T09:01:00.000Z",
      completedAt: "2026-03-13T09:05:30.000Z",
      messages: JSON.stringify([
        { role: "agent", content: "王芳早！微信支付联调昨天顺利吗？", timestamp: "2026-03-13T09:01:00.000Z" },
        { role: "member", content: "联调通过了！回调幂等也搞定了，用了 Redis 分布式锁。今天测一下异常场景，然后整理文档。支付模块基本可以收尾了！", timestamp: "2026-03-13T09:02:30.000Z" },
        { role: "agent", content: "太棒了！支付模块能收尾真是好消息。异常场景测试重点关注一下超时重试和部分退款的情况。辛苦了！🎉", timestamp: "2026-03-13T09:05:30.000Z" },
      ]),
      extractedData: JSON.stringify({
        completed_items: ["微信支付联调通过", "支付回调幂等处理完成"],
        planned_items: ["支付异常场景测试", "整理支付模块文档"],
        blockers: [],
        mood: "positive",
        task_updates: [],
      }),
    },
    {
      id: "conv-0313-m3",
      memberId: "m3",
      date: "2026-03-13",
      status: "completed",
      startedAt: "2026-03-13T09:07:00.000Z",
      completedAt: "2026-03-13T09:12:00.000Z",
      messages: JSON.stringify([
        { role: "agent", content: "张伟你好！消息推送的压测结果怎么样？", timestamp: "2026-03-13T09:07:00.000Z" },
        { role: "member", content: "压测通过了，5000 并发没问题，内存和 CPU 都很稳。离线消息缓存也做完了。今天部署上线，然后开始调研日志收集方案。", timestamp: "2026-03-13T09:08:45.000Z" },
        { role: "agent", content: "5000 并发稳定运行，消息推送服务质量很高！部署的时候做好灰度发布，先小流量验证一下。日志那块你打算用什么方案？", timestamp: "2026-03-13T09:10:00.000Z" },
        { role: "member", content: "打算用 Winston + Prometheus，后面接 Grafana 做监控面板。先从关键接口的请求日志开始。", timestamp: "2026-03-13T09:11:00.000Z" },
        { role: "agent", content: "经典组合，没问题。别忘了给日志加上 traceId，方便后面排查链路问题。今天任务清晰，继续保持！", timestamp: "2026-03-13T09:12:00.000Z" },
      ]),
      extractedData: JSON.stringify({
        completed_items: ["离线消息缓存实现", "消息推送压测通过（5000 并发）"],
        planned_items: ["消息推送服务部署", "开始日志收集调研"],
        blockers: [],
        mood: "positive",
        task_updates: [],
      }),
    },
    {
      id: "conv-0313-m4",
      memberId: "m4",
      date: "2026-03-13",
      status: "completed",
      startedAt: "2026-03-13T09:15:00.000Z",
      completedAt: "2026-03-13T09:18:30.000Z",
      messages: JSON.stringify([
        { role: "agent", content: "陈静早上好！自动化测试进展如何？昨天认证模块那边的阻塞解决了吗？", timestamp: "2026-03-13T09:15:00.000Z" },
        { role: "member", content: "认证模块还没完全好，不过我先测了其他接口。25 个用例全通过了，还发现了 2 个 bug，一个是分页边界问题，一个是空参数返回 500 应该是 400。今天继续补充测试，顺便开始写性能测试脚本。", timestamp: "2026-03-13T09:16:45.000Z" },
        { role: "agent", content: "25 个用例全通过还发现了 bug，测试质量很高！那两个 bug 已经提 issue 了吗？性能测试脚本写好后记得分享给团队。", timestamp: "2026-03-13T09:18:30.000Z" },
      ]),
      extractedData: JSON.stringify({
        completed_items: ["API 自动化测试 25 个用例全通过", "发现并报告了 2 个接口 bug"],
        planned_items: ["继续补充边界条件测试", "开始写性能测试脚本"],
        blockers: [],
        mood: "positive",
        task_updates: [],
      }),
    },
    {
      id: "conv-0313-m5",
      memberId: "m5",
      date: "2026-03-13",
      status: "completed",
      startedAt: "2026-03-13T09:20:00.000Z",
      completedAt: "2026-03-13T09:24:00.000Z",
      messages: JSON.stringify([
        { role: "agent", content: "赵磊早！连接池调优搞定了吗？优化报告写好了吗？", timestamp: "2026-03-13T09:20:00.000Z" },
        { role: "member", content: "都搞定了。连接池从默认 10 调到 25，配合 idle timeout 优化，高峰期连接等待从 200ms 降到了 20ms。报告也写好了，周会上分享。数据库优化基本收尾了，下周准备开始做权限管理系统。", timestamp: "2026-03-13T09:22:00.000Z" },
        { role: "agent", content: "数据库优化成果显著！周会分享非常好。权限管理系统是个大活，提前做好 RBAC 方案设计再动手。下周加油！", timestamp: "2026-03-13T09:24:00.000Z" },
      ]),
      extractedData: JSON.stringify({
        completed_items: ["连接池调优完成", "数据库优化总结报告"],
        planned_items: ["开始权限管理系统设计", "RBAC 方案调研"],
        blockers: [],
        mood: "normal",
        task_updates: [{ task_id: "t8", new_status: "done" }],
      }),
    },
  ];

  for (const c of conversationData) {
    await db.insert(conversations).values(c).run();
  }

  console.log("Seeding complete!");
  console.log(`  Users: 1 (admin/admin123)`);
  console.log(`  Members: ${memberData.length}`);
  console.log(`  Tasks: ${taskData.length}`);
  console.log(`  Daily Updates: ${updateData.length}`);
  console.log(`  Conversations: ${conversationData.length}`);
}

seed();
