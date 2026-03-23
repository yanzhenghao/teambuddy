import { db } from "@/db";
import { sessions } from "@/db/schema";
import { eq, gt, and } from "drizzle-orm";
import { randomBytes } from "crypto";

export interface Session {
  userId: string;
  expires: number;
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export async function getSession(token: string): Promise<Session | null> {
  const now = new Date().toISOString();

  const rows = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, token), gt(sessions.expiresAt, now)))
    .all();

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    userId: row.userId,
    expires: new Date(row.expiresAt).getTime(),
  };
}

export async function setSession(token: string, session: Session): Promise<void> {
  // Upsert: delete then insert
  await db.delete(sessions).where(eq(sessions.id, token)).run();

  await db.insert(sessions).values({
    id: token,
    userId: session.userId,
    expiresAt: new Date(session.expires).toISOString(),
  }).run();
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, token)).run();
}
