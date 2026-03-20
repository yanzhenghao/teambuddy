import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

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
});

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
});

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
// IR (Initial Requirement) - 注入需求，原始需求经MKT/SE/产品分析后分解到平台版本
// FuR (Function Requirement) - 功能需求，根据IR分配到具体的功能
// AR (Allocation Requirement) - 分配需求，根据FuR分配到软件实现模块/具体人
export const requirements = sqliteTable("requirements", {
  id: text("id").primaryKey(),
  parentId: text("parent_id"), // FuR's parent is IR, AR's parent is FuR
  title: text("title").notNull(), // requirement title
  type: text("type").notNull(), // "ir" | "fur" | "ar"
  assigneeId: text("assignee_id"), // for AR: allocated to which member
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
});

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
});

// ========== Session 表 ==========
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // token
  userId: text("user_id").notNull(),
  expiresAt: text("expires_at").notNull(), // ISO timestamp
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
