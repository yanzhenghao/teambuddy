import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";

const SESSION_COOKIE = "tb_session";

export interface AuthUser {
  userId: string;
  username: string;
  name: string;
  role: "admin" | "member";
}

/**
 * Extracts the current user from the request's session cookie.
 * Returns null if not authenticated.
 */
export async function getCurrentUser(request: NextRequest): Promise<AuthUser | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await getSession(token);
  if (!session) return null;

  const user = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .get();

  if (!user) return null;

  return {
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role as "admin" | "member",
  };
}

/**
 * Requires the current user to be an admin.
 * Returns a 403 response if not admin, or null if not authenticated.
 */
export async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: admin access required" }, { status: 403 });
  }

  return null;
}

/**
 * Returns the current user's ID or null if not authenticated.
 * Throws if session exists but user not found (inconsistent state).
 */
export async function getCurrentUserId(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await getSession(token);
  if (!session) return null;

  return session.userId;
}
