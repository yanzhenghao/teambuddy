import { readFileSync } from "fs";
import { join } from "path";

export interface SkillMeta {
  name: string;
  description: string;
  version: string;
  body: string;
}

const SKILL_DIR = join(process.cwd(), "src", "skills");
const cache = new Map<string, SkillMeta>();

/**
 * Parse minimal YAML frontmatter (key: value pairs separated by ---)
 * No external dependencies needed.
 */
function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { meta: {}, body: raw };
  }

  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (key) meta[key] = value;
  }

  return { meta, body: match[2] };
}

/**
 * Load a skill by name (reads from src/skills/{name}.skill.md).
 * Results are cached.
 */
export function loadSkill(name: string): SkillMeta {
  const cached = cache.get(name);
  if (cached) return cached;

  const filePath = join(SKILL_DIR, `${name}.skill.md`);
  const raw = readFileSync(filePath, "utf-8");
  const { meta, body } = parseFrontmatter(raw);

  const skill: SkillMeta = {
    name: meta.name || name,
    description: meta.description || "",
    version: meta.version || "1.0",
    body: body.trim(),
  };

  cache.set(name, skill);
  return skill;
}

/**
 * Render a skill template, replacing {{variable}} placeholders.
 */
export function renderSkill(name: string, vars: Record<string, string> = {}): string {
  const skill = loadSkill(name);
  let result = skill.body;

  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }

  return result;
}
