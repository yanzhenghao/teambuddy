import { db } from "@/db";
import { requirementDependencies, requirements } from "@/db/schema";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

interface GraphNode {
  id: string;
  title: string;
  type: string;
  status: string;
  inDegree: number;
  outDegree: number;
}

interface GraphEdge {
  id: string;
  from: string;
  to: string;
}

interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  hasCycle: boolean;
  criticalPath: string[]; // IDs in topological order
}

/** GET /api/requirement/dependencies/graph — Get full dependency graph */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const versionId = searchParams.get("versionId");

  // Fetch requirements (optionally filtered by version)
  let allRequirements;
  if (versionId) {
    allRequirements = await db
      .select()
      .from(requirements)
      .where(eq(requirements.versionId, versionId))
      .all();
  } else {
    allRequirements = await db.select().from(requirements).all();
  }

  // Fetch dependencies
  let allDeps;
  if (versionId) {
    // Filter deps to only those where both ends are in the version
    const reqIds = new Set(allRequirements.map((r) => r.id));
    const allDepsRaw = await db.select().from(requirementDependencies).all();
    allDeps = allDepsRaw.filter(
      (d) => reqIds.has(d.requirementId) && reqIds.has(d.dependsOnId)
    );
  } else {
    allDeps = await db.select().from(requirementDependencies).all();
  }

  // Build adjacency list and calculate degrees
  const adjacencyList = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();

  for (const req of allRequirements) {
    adjacencyList.set(req.id, []);
    inDegree.set(req.id, 0);
    outDegree.set(req.id, 0);
  }

  for (const dep of allDeps) {
    adjacencyList.get(dep.requirementId)?.push(dep.dependsOnId);
    inDegree.set(dep.dependsOnId, (inDegree.get(dep.dependsOnId) || 0) + 1);
    outDegree.set(dep.requirementId, (outDegree.get(dep.requirementId) || 0) + 1);
  }

  // Build nodes
  const nodes: GraphNode[] = allRequirements.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type,
    status: r.status,
    inDegree: inDegree.get(r.id) || 0,
    outDegree: outDegree.get(r.id) || 0,
  }));

  // Build edges
  const edges: GraphEdge[] = allDeps.map((d) => ({
    id: d.id,
    from: d.requirementId,
    to: d.dependsOnId,
  }));

  // Detect cycle and get topological order (Kahn's algorithm)
  const { hasCycle, topologicalOrder } = detectCycleAndTopoSort(
    allRequirements.map((r) => r.id),
    adjacencyList,
    inDegree
  );

  return NextResponse.json({
    nodes,
    edges,
    hasCycle,
    criticalPath: topologicalOrder,
  } satisfies DependencyGraph);
}

function detectCycleAndTopoSort(
  nodeIds: string[],
  adjacencyList: Map<string, string[]>,
  inDegree: Map<string, number>
): { hasCycle: boolean; topologicalOrder: string[] } {
  // Copy inDegree to avoid mutation
  const degree = new Map(inDegree);

  // Start with nodes that have no incoming edges
  const queue: string[] = [];
  for (const id of nodeIds) {
    if ((degree.get(id) || 0) === 0) {
      queue.push(id);
    }
  }

  const topoOrder: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    topoOrder.push(current);

    const neighbors = adjacencyList.get(current) || [];
    for (const neighbor of neighbors) {
      const newDegree = (degree.get(neighbor) || 0) - 1;
      degree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  // If not all nodes are in topoOrder, there's a cycle
  const hasCycle = topoOrder.length !== nodeIds.length;

  return { hasCycle, topologicalOrder: topoOrder };
}

// Need to import eq for the query
import { eq } from "drizzle-orm";
