import { db } from "@/db";
import { members } from "@/db/schema";
import { StandupClient } from "./standup-client";

export const dynamic = "force-dynamic";

export default async function StandupPage() {
  const allMembers = await db.select().from(members).all();

  return (
    <StandupClient
      members={allMembers.map((m) => ({ id: m.id, name: m.name, role: m.role }))}
    />
  );
}
