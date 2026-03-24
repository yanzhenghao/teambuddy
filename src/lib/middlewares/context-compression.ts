import { LLMRequest } from "../ai-pipeline";

const MAX_CHARS = 8000;

/**
 * Context compression middleware.
 * If total message characters > MAX_CHARS, keep system + first user + last 4 messages.
 */
export const contextCompressionMiddleware = {
  name: "context-compression",
  before(req: LLMRequest): LLMRequest {
    const totalChars = req.messages.reduce((sum, m) => sum + m.content.length, 0);
    if (totalChars <= MAX_CHARS) return req;

    const msgs = req.messages;
    const systemMsgs = msgs.filter((m) => m.role === "system");
    const others = msgs.filter((m) => m.role !== "system");

    // Always keep system, first user message, and last 4 others
    const firstUser = others.find((m) => m.role === "user");
    const lastFour = others.slice(-4);

    const keptOthers = firstUser
      ? [firstUser, ...lastFour.filter((m) => m !== firstUser)]
      : lastFour;

    return {
      ...req,
      messages: [...systemMsgs, ...keptOthers],
    };
  },
};
