import { db } from "@/db";
import { requirementDependencies, requirements } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/auth";

/** GET /api/requirement/dependencies — Get dependencies for a requirement or all */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requirementId = searchParams.get("requirementId");

  if (requirementId) {
    // Get dependencies for a specific requirement
    const deps = await db
      .select({
        id: requirementDependencies.id,
        requirementId: requirementDependencies.requirementId,
        dependsOnId: requirementDependencies.dependsOnId,
        createdAt: requirementDependencies.createdAt,
      })
      .from(requirementDependencies)
      .where(eq(requirementDependencies.requirementId, requirementId))
      .all();

    // Enrich with requirement titles
    const reqIds = [...new Set([requirementId, ...deps.map((d) => d.dependsOnId)])];
    const relatedReqs = await db
      .select({ id: requirements.id, title: requirements.title, type: requirements.type })
      .from(requirements)
      .all();

    const reqMap = new Map(relatedReqs.map((r) => [r.id, r]));

    const enriched = deps.map((d) => ({
      ...d,
      requirementTitle: reqMap.get(d.requirementId)?.title || "",
      requirementType: reqMap.get(d.requirementId)?.type || "",
      dependsOnTitle: reqMap.get(d.dependsOnId)?.title || "",
      dependsOnType: reqMap.get(d.dependsOnId)?.type || "",
    }));

    return NextResponse.json(enriched);
  } else {
    // Get all dependencies
    const allDeps = await db
      .select({
        id: requirementDependencies.id,
        requirementId: requirementDependencies.requirementId,
        dependsOnId: requirementDependencies.dependsOnId,
        createdAt: requirementDependencies.createdAt,
      })
      .from(requirementDependencies)
      .all();

    if (allDeps.length === 0) {
      return NextResponse.json([]);
    }

    // Enrich with requirement titles
    const reqIds = [...new Set(allDeps.flatMap((d) => [d.requirementId, d.dependsOnId]))];
    const relatedReqs = await db
      .select({ id: requirements.id, title: requirements.title, type: requirements.type })
      .from(requirements)
      .all();

    const reqMap = new Map(relatedReqs.map((r) => [r.id, r]));

    const enriched = allDeps.map((d) => ({
      ...d,
      requirementTitle: reqMap.get(d.requirementId)?.title || "",
      requirementType: reqMap.get(d.requirementId)?.type || "",
      dependsOnTitle: reqMap.get(d.dependsOnId)?.title || "",
      dependsOnType: reqMap.get(d.dependsOnId)?.type || "",
    }));

    return NextResponse.json(enriched);
  }
}

/** POST /api/requirement/dependencies — Add a dependency */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const { requirementId, dependsOnId } = body;

  if (!requirementId || !dependsOnId) {
    return NextResponse.json(
      { error: "requirementId and dependsOnId are required" },
      { status: 400 }
    );
  }

  if (requirementId === dependsOnId) {
    return NextResponse.json(
      { error: "A requirement cannot depend on itself" },
      { status: 400 }
    );
  }

  // Verify both requirements exist
  const [req1, req2] = await Promise.all([
    db.select().from(requirements).where(eq(requirements.id, requirementId)).get(),
    db.select().from(requirements).where(eq(requirements.id, dependsOnId)).get(),
  ]);

  if (!req1 || !req2) {
    return NextResponse.json({ error: "One or both requirements not found" }, { status: 404 });
  }

  // Check if dependency already exists
  const existing = await db
    .select()
    .from(requirementDependencies)
    .where(eq(requirementDependencies.requirementId, requirementId))
    .all();

  if (existing.some((d) => d.dependsOnId === dependsOnId)) {
    return NextResponse.json({ error: "Dependency already exists" }, { status: 409 });
  }

  // Check for circular dependency
  if (await wouldCreateCycle(requirementId, dependsOnId)) {
    return NextResponse.json(
      { error: "Adding this dependency would create a circular dependency" },
      { status: 400 }
    );
  }

  const id = randomUUID();
  await db.insert(requirementDependencies).values({
    id,
    requirementId,
    dependsOnId,
  }).run();

  return NextResponse.json({ id, requirementId, dependsOnId }, { status: 201 });
}

/** DELETE /api/requirement/dependencies — Remove a dependency */
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

  await db.delete(requirementDependencies).where(eq(requirementDependencies.id, id)).run();

  return NextResponse.json({ success: true });
}

/**
 * Check if adding a dependency from requirementId to dependsOnId would create a cycle
 * Uses DFS to detect if dependsOnId can reach requirementId (which would mean cycle)
 */
async function wouldCreateCycle(requirementId: string, dependsOnId: string): Promise<boolean> {
  // Build adjacency list from existing dependencies
  const allDeps = await db.select().from(requirementDependencies).all();

  const adjacencyList = new Map<string, string[]>();
  for (const dep of allDeps) {
    if (!adjacencyList.has(dep.requirementId)) {
      adjacencyList.set(dep.requirementId, []);
    }
    adjacencyList.get(dep.requirementId)!.push(dep.dependsOnId);
  }

  // Add the proposed new edge
  if (!adjacencyList.has(requirementId)) {
    adjacencyList.set(requirementId, []);
  }
  adjacencyList.get(requirementId)!.push(dependsOnId);

  // DFS from dependsOnId to see if we can reach requirementId
  const visited = new Set<string>();
  const stack = [dependsOnId];

  while (stack.length > 0) {
    const current = stack.pop()!;

    if (current === requirementId) {
      return true; // Found a cycle
    }

    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    const neighbors = adjacencyList.get(current) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        stack.push(neighbor);
      }
    }
  }

  return false;
}
