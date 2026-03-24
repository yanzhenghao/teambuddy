import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

function buildClient(): Client {
  const url = process.env.TURSO_DATABASE_URL || "file:teambuddy.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;

  // 本地开发用 file:// 直接连
  if (url.startsWith("file:")) {
    return createClient({ url });
  }

  // 生产环境：嵌入式副本，读走本地，写走远程
  // Docker 中 /app/data 有写入权限且做了 volume 持久化
  const replicaPath = process.env.NODE_ENV === "production"
    ? "file:/app/data/local-replica.db"
    : "file:local-replica.db";

  return createClient({
    url: replicaPath,
    syncUrl: url,
    authToken,
    syncInterval: 1, // 每 1 秒同步
  });
}

const client = buildClient();

// 启动时立即同步一次，确保副本有最新 schema 和数据
if (typeof client.sync === "function") {
  client.sync().catch((err: unknown) => {
    console.warn("Initial Turso sync failed (will retry automatically):", err);
  });
}

export const db = drizzle(client, { schema });
export type DB = typeof db;
