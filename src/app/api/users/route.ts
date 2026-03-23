import { db } from "@/db";
import { users, members } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID, randomBytes, createHash } from "crypto";
import { getCurrentUser, requireAdmin } from "@/lib/auth";

function hashPassword(password: string, salt: string): string {
  return createHash("sha256").update(password + salt).digest("hex");
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allUsers = await db.select().from(users).all();
  const allMembers = await db.select().from(members).all();
  const memberMap = new Map(allMembers.map((m) => [m.id, m]));

  let result = allUsers.map((u) => {
    const member = memberMap.get(u.id);
    return {
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      memberRole: member?.role || null,
      skills: member ? JSON.parse(member.skills) : [],
      maxLoad: member?.maxLoad || 3,
      status: member?.status || "active",
      createdAt: u.createdAt,
    };
  });

  // Members only see their own user data
  if (user.role !== "admin") {
    result = result.filter((u) => u.id === user.userId);
  }

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const forbidden = await requireAdmin(request);
  if (forbidden) return forbidden;

  const body = await request.json();
  const {
    username,
    password,
    name,
    role,
    memberRole = "frontend",
    skills = [],
    maxLoad = 3,
  } = body;

  if (!username || !password || !name) {
    return NextResponse.json(
      { error: "username, password, name required" },
      { status: 400 }
    );
  }

  // Check if username exists
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .get();

  if (existing) {
    return NextResponse.json({ error: "用户名已存在" }, { status: 409 });
  }

  const id = randomUUID();
  const salt = randomBytes(16).toString("hex");
  const passwordHash = `${salt}:${hashPassword(password, salt)}`;

  // Create user
  await db
    .insert(users)
    .values({
      id,
      username,
      passwordHash,
      name,
      role: role || "member",
    })
    .run();

  // Create member with same id
  await db
    .insert(members)
    .values({
      id,
      name,
      role: memberRole,
      skills: JSON.stringify(skills),
      maxLoad,
      status: "active",
    })
    .run();

  return NextResponse.json({
    id,
    username,
    name,
    role: role || "member",
    memberRole,
    skills,
    maxLoad,
  });
}

export async function PUT(request: NextRequest) {
  const forbidden = await requireAdmin(request);
  if (forbidden) return forbidden;

  const body = await request.json();
  const {
    id,
    username,
    name,
    role,
    password,
    memberRole,
    skills,
    maxLoad,
  } = body;

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  // Update user
  const updateData: Record<string, string> = {};
  if (username) updateData.username = username;
  if (name) updateData.name = name;
  if (role) updateData.role = role;
  if (password) {
    const salt = randomBytes(16).toString("hex");
    updateData.passwordHash = `${salt}:${hashPassword(password, salt)}`;
  }

  if (Object.keys(updateData).length > 0) {
    await db.update(users).set(updateData).where(eq(users.id, id)).run();
  }

  // Update member
  const memberUpdateData: Record<string, unknown> = {};
  if (name) memberUpdateData.name = name;
  if (memberRole) memberUpdateData.role = memberRole;
  if (skills) memberUpdateData.skills = JSON.stringify(skills);
  if (maxLoad) memberUpdateData.maxLoad = maxLoad;

  if (Object.keys(memberUpdateData).length > 0) {
    await db.update(members).set(memberUpdateData).where(eq(members.id, id)).run();
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const forbidden = await requireAdmin(request);
  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  // Delete both user and member
  await db.delete(users).where(eq(users.id, id)).run();
  await db.delete(members).where(eq(members.id, id)).run();
  return NextResponse.json({ ok: true });
}
