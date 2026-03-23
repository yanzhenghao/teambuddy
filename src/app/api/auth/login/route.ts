import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import {
  setSession,
  deleteSession,
  generateSessionToken,
} from "@/lib/session";

const SESSION_COOKIE = "tb_session";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

const BCRYPT_SALT_ROUNDS = 12;

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Creates a secure session cookie with HttpOnly, SameSite, Secure, and Max-Age attributes.
 * Secure flag is only set in production to ensure HTTPS requirement.
 */
function createCookie(token: string, maxAge: number): string {
  const isProduction = process.env.NODE_ENV === "production";
  const secureFlag = isProduction ? "; Secure" : "";
  return (
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureFlag}`
  );
}

/**
 * Creates a cookie string for clearing the session (Max-Age=0).
 * Uses Secure flag in production.
 */
function createClearCookie(): string {
  const isProduction = process.env.NODE_ENV === "production";
  const secureFlag = isProduction ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { username, password } = body;

  if (!username || !password) {
    return NextResponse.json({ error: "用户名和密码必填" }, { status: 400 });
  }

  const user = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .get();

  if (!user) {
    return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
  }

  // Verify password with bcrypt
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
  }

  // Create session
  const token = generateSessionToken();
  const expires = Date.now() + SESSION_MAX_AGE * 1000;
  await setSession(token, { userId: user.id, expires });

  const response = NextResponse.json({
    user: { id: user.id, username: user.username, name: user.name, role: user.role },
  });

  response.headers.set("Set-Cookie", createCookie(token, SESSION_MAX_AGE));
  return response;
}

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (token) {
    await deleteSession(token);
  }

  const response = NextResponse.json({ ok: true });
  response.headers.set("Set-Cookie", createClearCookie());
  return response;
}
