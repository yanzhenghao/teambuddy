import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

function buildClient(): Client {
  const url = process.env.TURSO_DATABASE_URL || "file:teambuddy.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;

  // 本地开发用 file:// 直接连本地 SQLite
  if (url.startsWith("file:")) {
    return createClient({ url });
  }

  // 生产环境：直接连 Turso Cloud（简单可靠，延迟可接受）
  return createClient({
    url,
    authToken,
  });
}

const client = buildClient();
export const db = drizzle(client, { schema });
export type DB = typeof db;
