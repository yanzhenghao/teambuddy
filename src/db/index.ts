import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

function buildClient() {
  const url = process.env.TURSO_DATABASE_URL || "file:teambuddy.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;

  // 本地开发用 file:// 直接连
  if (url.startsWith("file:")) {
    return createClient({ url });
  }

  // 生产环境：嵌入式副本，读走本地，写走远程
  return createClient({
    url: "file:local-replica.db",
    syncUrl: url,
    authToken,
    syncInterval: 1, // 每 1 秒同步
  });
}

const client = buildClient();
export const db = drizzle(client, { schema });
export type DB = typeof db;
