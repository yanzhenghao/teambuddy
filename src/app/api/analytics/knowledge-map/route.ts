import { db } from "@/db";
import { members } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { cachedJson, CACHE_PRESETS } from "@/lib/api-cache";

interface ExpertiseEntry {
  memberId: string;
  memberName: string;
  expertise: string[];
  recentTopics: string[];
  contributionScore: number;
}

/** GET /api/analytics/knowledge-map — Get team expertise map */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q"); // Search query

  // Get all active members
  const allMembers = await db
    .select()
    .from(members)
    .where(eq(members.status, "active"))
    .all();

  // Build expertise map from member skills and roles
  const expertiseMap: ExpertiseEntry[] = allMembers.map((m) => {
    const skills = JSON.parse(m.skills || "[]");

    // Map skills to expertise areas
    const expertiseAreas = mapSkillsToExpertise(skills, m.role);

    // Calculate contribution score based on maxLoad (proxy for activity level)
    const contributionScore = Math.min(m.maxLoad * 10, 100);

    return {
      memberId: m.id,
      memberName: m.name,
      expertise: expertiseAreas,
      recentTopics: skills, // Use skills as recent topics
      contributionScore,
    };
  });

  // If query provided, find best matches
  if (query) {
    const queryLower = query.toLowerCase();
    const scored = expertiseMap.map((entry) => {
      let score = 0;

      // Check expertise match
      for (const exp of entry.expertise) {
        if (exp.toLowerCase().includes(queryLower)) score += 10;
      }
      // Check skills match
      for (const skill of entry.recentTopics) {
        if (skill.toLowerCase().includes(queryLower)) score += 5;
      }
      // Check name match
      if (entry.memberName.toLowerCase().includes(queryLower)) score += 2;

      return { ...entry, matchScore: score };
    });

    // Filter to those with match score > 0 and sort
    const matches = scored
      .filter((e) => e.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 5);

    return cachedJson({
      query,
      matches,
      allExperts: expertiseMap,
    }, CACHE_PRESETS.ANALYTICS);
  }

  return cachedJson({
    expertiseMap,
  }, CACHE_PRESETS.ANALYTICS);
}

/** Map member skills and roles to expertise areas */
function mapSkillsToExpertise(skills: string[], role: string): string[] {
  const expertiseSet = new Set<string>();

  // Add role-based expertise
  const roleExpertise: Record<string, string[]> = {
    frontend: ["前端开发", "React", "Vue", "CSS", "HTML", "移动端开发", "UI开发"],
    backend: ["后端开发", "Node.js", "Python", "Java", "数据库", "API设计", "服务器"],
    fullstack: ["全栈开发", "前端开发", "后端开发", "数据库", "API设计"],
    test: ["测试", "自动化测试", "质量保障", "QA", "手动测试"],
  };

  const roleExp = roleExpertise[role] || [];
  roleExp.forEach((e) => expertiseSet.add(e));

  // Add skill-based expertise
  skills.forEach((skill) => {
    const skillLower = skill.toLowerCase();

    if (skillLower.includes("react")) expertiseSet.add("React开发");
    if (skillLower.includes("vue")) expertiseSet.add("Vue开发");
    if (skillLower.includes("typescript")) expertiseSet.add("TypeScript开发");
    if (skillLower.includes("node")) expertiseSet.add("Node.js开发");
    if (skillLower.includes("python")) expertiseSet.add("Python开发");
    if (skillLower.includes("java")) expertiseSet.add("Java开发");
    if (skillLower.includes("database") || skillLower.includes("db")) expertiseSet.add("数据库");
    if (skillLower.includes("api")) expertiseSet.add("API设计");
    if (skillLower.includes("css") || skillLower.includes("html")) expertiseSet.add("前端开发");
    if (skillLower.includes("test") || skillLower.includes("qa")) expertiseSet.add("测试");
    if (skillLower.includes("devops") || skillLower.includes("ci")) expertiseSet.add("DevOps");
    if (skillLower.includes("cloud")) expertiseSet.add("云服务");
  });

  return Array.from(expertiseSet);
}
