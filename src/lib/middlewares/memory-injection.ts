import { LLMRequest } from "../ai-pipeline";
import { buildMemoryPrompt } from "../member-memory";

/**
 * Memory injection middleware.
 * If ctx.memberId is set, fetches stored facts and injects into the system prompt.
 */
export const memoryInjectionMiddleware = {
  name: "memory-injection",
  async before(req: LLMRequest, ctx: { memberId?: string }): Promise<LLMRequest> {
    if (!ctx.memberId) return req;

    const memoryPrompt = await buildMemoryPrompt(ctx.memberId);
    if (!memoryPrompt) return req;

    const messages = req.messages.map((m) => {
      if (m.role === "system") {
        return { ...m, content: m.content + "\n" + memoryPrompt };
      }
      return m;
    });

    return { ...req, messages };
  },
};
