import { LLMResponse } from "../ai-pipeline";

/**
 * Tag cleaner middleware.
 * Strips <think> tags and sets the `cleaned` field.
 */
export const tagCleanerMiddleware = {
  name: "tag-cleaner",
  after(raw: string): LLMResponse {
    const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/, "").trim();
    return { raw, cleaned, extracted: null };
  },
};
