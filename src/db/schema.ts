import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

// ========== 版本/迭代表 ==========
export const versions = sqliteTable("versions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(), // e.g., "v1.0", "Sprint 1"
  status: text("status").notNull().default("planning"), // "planning" | "active" | "completed"
  startDate: text("start_date"), // YYYY-MM-DD
  endDate: text("end_date"), // YYYY-MM-DD
  description: text("description"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  statusIdx: index("versions_status_idx").on(table.status),
}));

// ========== 成员表 ==========
export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(), // "frontend" | "backend" | "fullstack" | "test"
  skills: text("skills").notNull().default("[]"), // JSON array of skill tags
  maxLoad: integer("max_load").notNull().default(3),
  status: text("status").notNull().default("active"), // "active" | "inactive"
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  statusIdx: index("members_status_idx").on(table.status),
}));

// ========== 任务表 ==========
export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  assigneeId: text("assignee_id").references(() => members.id),
  priority: text("priority").notNull().default("P2"), // "P0" | "P1" | "P2" | "P3"
  status: text("status").notNull().default("unassigned"),
  // "unassigned" | "todo" | "in_progress" | "in_review" | "done"
  category: text("category"), // "feature" | "bug" | "optimization" | "test" | "new_req"
  estimatedDays: integer("estimated_days"),
  actualDays: integer("actual_days"),
  startDate: text("start_date"),
  dueDate: text("due_date"),
  completedDate: text("completed_date"),
  createdFrom: text("created_from"), // requirement source
  requirementId: text("requirement_id").references(() => requirements.id), // links to AR
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  assigneeIdx: index("tasks_assignee_idx").on(table.assigneeId),
  statusIdx: index("tasks_status_idx").on(table.status),
  requirementIdx: index("tasks_requirement_idx").on(table.requirementId),
}));

// ========== 每日更新表 ==========
export const dailyUpdates = sqliteTable("daily_updates", {
  id: text("id").primaryKey(),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id),
  date: text("date").notNull(), // YYYY-MM-DD
  completedItems: text("completed_items").notNull().default("[]"), // JSON array
  plannedItems: text("planned_items").notNull().default("[]"), // JSON array
  blockers: text("blockers").notNull().default("[]"), // JSON array
  mood: text("mood").default("normal"), // "positive" | "normal" | "negative"
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ========== 对话记录表 ==========
export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id),
  date: text("date").notNull(), // YYYY-MM-DD
  messages: text("messages").notNull().default("[]"), // JSON array of {role, content}
  extractedData: text("extracted_data"), // JSON: structured info extracted by LLM
  status: text("status").notNull().default("pending"),
  // "pending" | "in_progress" | "completed"
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ========== 用户表 ==========
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("member"), // "admin" | "member"
  name: text("name").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ========== 需求层级表 (IR → FuR → AR) ==========
// IR (Initial Requirement) - 初始需求，原始需求经MKT/SE/产品分析后分解到平台版本
// FuR (Function Requirement) - 功能需求，根据IR分配到具体的功能
// AR (Allocation Requirement) - 分配需求，根据FuR分配到软件实现模块/具体人
export const requirements = sqliteTable("requirements", {
  id: text("id").primaryKey(),
  parentId: text("parent_id"), // FuR's parent is IR, AR's parent is FuR
  title: text("title").notNull(), // requirement title
  type: text("type").notNull(), // "ir" | "fur" | "ar"
  assigneeId: text("assignee_id"), // for AR: allocated to which member
  versionId: text("version_id").references(() => versions.id), // links to version
  status: text("status").notNull().default("pending"), // "pending" | "in_progress" | "completed"
  summary: text("summary"), // AI analysis summary
  conversationId: text("conversation_id"), // links to requirementConversations
  taskCount: integer("task_count").default(0),
  completedTaskCount: integer("completed_task_count").default(0),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  parentIdx: index("requirements_parent_idx").on(table.parentId),
  assigneeIdx: index("requirements_assignee_idx").on(table.assigneeId),
  statusIdx: index("requirements_status_idx").on(table.status),
  versionIdx: index("requirements_version_idx").on(table.versionId),
}));

// ========== 需求变更历史表 ==========
export const requirementHistory = sqliteTable("requirement_history", {
  id: text("id").primaryKey(),
  requirementId: text("requirement_id")
    .notNull()
    .references(() => requirements.id),
  title: text("title").notNull(), // title at time of change
  summary: text("summary"), // summary at time of change
  status: text("status").notNull(), // status at time of change
  assigneeId: text("assignee_id"), // assignee at time of change
  versionId: text("version_id"), // version at time of change
  changeType: text("change_type").notNull(), // "create" | "update" | "delete"
  changedBy: text("changed_by"), // user id who made the change
  changedAt: text("changed_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  requirementIdx: index("requirement_history_req_idx").on(table.requirementId),
  changedAtIdx: index("requirement_history_changed_at_idx").on(table.changedAt),
}));

// ========== 需求依赖关系表 ==========
export const requirementDependencies = sqliteTable("requirement_dependencies", {
  id: text("id").primaryKey(),
  requirementId: text("requirement_id")
    .notNull()
    .references(() => requirements.id), // the requirement that depends on another
  dependsOnId: text("depends_on_id")
    .notNull()
    .references(() => requirements.id), // the requirement it depends on
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  requirementIdx: index("req_deps_req_idx").on(table.requirementId),
  dependsOnIdx: index("req_deps_on_idx").on(table.dependsOnId),
}));

// ========== 需求分析对话表 ==========
export const requirementConversations = sqliteTable("requirement_conversations", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  requirement: text("requirement").notNull(),
  messages: text("messages").notNull().default("[]"), // JSON array of {role, content}
  result: text("result"), // JSON: extracted tasks
  status: text("status").notNull().default("active"), // "active" | "completed" | "abandoned"
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  statusIdx: index("requirement_conversations_status_idx").on(table.status),
}));

// ========== 风险预警表 ==========
export const riskWarnings = sqliteTable("risk_warnings", {
  id: text("id").primaryKey(),
  type: text("type").notNull(), // "overdue" | "stale" | "overload" | "blocked"
  severity: text("severity").notNull().default("medium"), // "low" | "medium" | "high" | "critical"
  title: text("title").notNull(),
  message: text("message").notNull(),
  requirementId: text("requirement_id").references(() => requirements.id), // linked AR if applicable
  taskId: text("task_id").references(() => tasks.id), // linked task if applicable
  memberId: text("member_id").references(() => members.id), // affected member
  status: text("status").notNull().default("active"), // "active" | "acknowledged" | "resolved"
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  acknowledgedAt: text("acknowledged_at"),
  resolvedAt: text("resolved_at"),
}, (table) => ({
  statusIdx: index("risk_warnings_status_idx").on(table.status),
  memberIdx: index("risk_warnings_member_idx").on(table.memberId),
  requirementIdx: index("risk_warnings_req_idx").on(table.requirementId),
}));

// ========== 成员记忆表 ==========
export const memberMemory = sqliteTable("member_memory", {
  id: text("id").primaryKey(),
  memberId: text("member_id").notNull().unique(),
  memoryData: text("memory_data").notNull().default("[]"), // JSON array of {fact, createdAt}
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  memberIdx: index("member_memory_member_idx").on(table.memberId),
}));

// ========== Session 表 ==========
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // token
  userId: text("user_id").notNull(),
  expiresAt: text("expires_at").notNull(), // ISO timestamp
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  userIdx: index("sessions_user_idx").on(table.userId),
}));
