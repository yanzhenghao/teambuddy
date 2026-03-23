import { db } from "@/db";
import { versions, requirements } from "@/db/schema";
import { eq, desc, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/auth";

/** GET /api/versions — List all versions */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const all = await db
    .select()
    .from(versions)
    .orderBy(desc(versions.createdAt))
    .all();

  return NextResponse.json(all);
}

/** POST /api/versions — Create a new version */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const { name, status, startDate, endDate, description } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const id = randomUUID();
  await db.insert(versions).values({
    id,
    name: name.trim(),
    status: status || "planning",
    startDate: startDate || null,
    endDate: endDate || null,
    description: description || null,
  }).run();

  const created = await db
    .select()
    .from(versions)
    .where(eq(versions.id, id))
    .get();

  return NextResponse.json(created, { status: 201 });
}

/** PATCH /api/versions — Update a version */
export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const { id, name, status, startDate, endDate, description } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(versions)
    .where(eq(versions.id, id))
    .get();

  if (!existing) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (name !== undefined) updates.name = name.trim();
  if (status !== undefined) updates.status = status;
  if (startDate !== undefined) updates.startDate = startDate;
  if (endDate !== undefined) updates.endDate = endDate;
  if (description !== undefined) updates.description = description;

  await db
    .update(versions)
    .set(updates)
    .where(eq(versions.id, id))
    .run();

  const updated = await db
    .select()
    .from(versions)
    .where(eq(versions.id, id))
    .get();

  return NextResponse.json(updated);
}

/** DELETE /api/versions — Delete a version (only if no requirements linked) */
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(versions)
    .where(eq(versions.id, id))
    .get();

  if (!existing) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  // Check if any requirements are linked to this version
  const linkedRequirements = await db
    .select()
    .from(requirements)
    .where(eq(requirements.versionId, id))
    .all();

  if (linkedRequirements.length > 0) {
    return NextResponse.json(
      { error: "Cannot delete version with linked requirements. Unlink or delete requirements first." },
      { status: 400 }
    );
  }

  await db.delete(versions).where(eq(versions.id, id)).run();

  return NextResponse.json({ success: true });
}
