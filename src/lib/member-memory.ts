import { db } from "@/db";
import { memberMemory } from "@/db/schema";
import { eq } from "drizzle-orm";
import { callLLM } from "@/lib/llm-client";
import { renderSkill } from "@/lib/skill-loader";

const MAX_FACTS = 50;

interface MemoryFact {
  fact: string;
  createdAt: string;
}

/**
 * Get all stored facts for a member.
 */
export async function getMemory(memberId: string): Promise<MemoryFact[]> {
  const record = await db
    .select()
    .from(memberMemory)
    .where(eq(memberMemory.memberId, memberId))
    .get();

  if (!record) return [];

  try {
    return JSON.parse(record.memoryData) as MemoryFact[];
  } catch {
    return [];
  }
}

/**
 * Save facts for a member (overwrites existing).
 */
export async function saveMemory(memberId: string, facts: MemoryFact[]): Promise<void> {
  const existing = await db
    .select()
    .from(memberMemory)
    .where(eq(memberMemory.memberId, memberId))
    .get();

  if (existing) {
    await db
      .update(memberMemory)
      .set({
        memoryData: JSON.stringify(facts.slice(0, MAX_FACTS)),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(memberMemory.memberId, memberId))
      .run();
  } else {
    await db
      .insert(memberMemory)
      .values({
        id: `mem-${Date.now()}`,
        memberId,
        memoryData: JSON.stringify(facts.slice(0, MAX_FACTS)),
      })
      .run();
  }
}

/**
 * Extract facts from a conversation and merge into member's memory.
 * Fire-and-forget — errors are swallowed.
 */
export async function extractFactsFromConversation(
  memberId: string,
  messages: { role: string; content: string }[]
): Promise<void> {
  try {
    const conversationText = messages.map((m) => `${m.role}: ${m.content}`).join("\n\n");
    const skillPrompt = renderSkill("memory-extractor", {
      conversation: conversationText,
    });

    const text = await callLLM(
      [
        { role: "system", content: skillPrompt },
        { role: "user", content: "请从上述对话中提取关键事实。" },
      ],
      { maxTokens: 500 }
    );

    let newFacts: string[] = [];
    try {
      newFacts = JSON.parse(text.trim());
      if (!Array.isArray(newFacts)) newFacts = [];
    } catch {
      // Not valid JSON, skip
    }

    if (newFacts.length === 0) return;

    const existing = await getMemory(memberId);
    const now = new Date().toISOString();

    // Deduplicate: skip facts already present (substring match)
    const existingSet = new Set(existing.map((f) => f.fact));
    const uniqueFacts = newFacts
      .filter((f) => !existingSet.has(f) && !existingSet.has(f.slice(0, 40)))
      .map((fact) => ({ fact, createdAt: now }));

    if (uniqueFacts.length === 0) return;

    const merged = [...existing, ...uniqueFacts].slice(0, MAX_FACTS);
    await saveMemory(memberId, merged);
  } catch {
    // Fire-and-forget
  }
}

/**
 * Build a memory prompt fragment for injection into system prompts.
 */
export async function buildMemoryPrompt(memberId: string): Promise<string> {
  const facts = await getMemory(memberId);
  if (facts.length === 0) return "";

  const lines = facts.map((f) => `- ${f.fact}`);
  return `\n## 已知的成员背景\n${lines.join("\n")}`;
}
