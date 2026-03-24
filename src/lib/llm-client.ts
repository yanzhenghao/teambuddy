import OpenAI from "openai";

// LLM Provider configuration via environment variables
// Supports any OpenAI-compatible API: DeepSeek, Qwen, GLM, MiniMax, Moonshot, etc.
//
// .env.local 配置示例:
//   DeepSeek (推荐，国内最快):
//     LLM_BASE_URL=https://api.deepseek.com/v1
//     LLM_API_KEY=sk-xxx
//     LLM_MODEL=deepseek-chat
//
//   通义千问 (阿里):
//     LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
//     LLM_API_KEY=sk-xxx
//     LLM_MODEL=qwen-plus
//
//   智谱 GLM:
//     LLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
//     LLM_API_KEY=xxx
//     LLM_MODEL=glm-4-flash
//
//   MiniMax (当前):
//     LLM_BASE_URL=https://api.minimaxi.com/v1
//     LLM_API_KEY=sk-xxx
//     LLM_MODEL=MiniMax-M2.7-highspeed

const MINIMAX_BASE_URL = "https://api.minimaxi.com/v1";
const DEFAULT_MODEL = "MiniMax-M2.7-highspeed";

function getLLMConfig() {
  return {
    baseURL: process.env.LLM_BASE_URL || MINIMAX_BASE_URL,
    apiKey: process.env.LLM_API_KEY || process.env.MINIMAX_API_KEY || "",
    model: process.env.LLM_MODEL || DEFAULT_MODEL,
  };
}

const DEFAULT_MAX_TOKENS = 1500;
const DEFAULT_TIMEOUT_MS = 60000;

/**
 * Create a configured OpenAI client for LLM API
 */
export function createLLMClient(): OpenAI {
  const config = getLLMConfig();
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
}

export interface LLMConfig {
  model?: string;
  maxTokens?: number;
  timeoutMs?: number;
}

const DEFAULT_CONFIG: LLMConfig = {
  model: DEFAULT_MODEL,
  maxTokens: DEFAULT_MAX_TOKENS,
  timeoutMs: DEFAULT_TIMEOUT_MS,
};

/**
 * Call LLM with exponential backoff retry
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function callLLM(
  messages: any[],
  config: LLMConfig = DEFAULT_CONFIG,
  maxRetries = 3
): Promise<string> {
  const client = createLLMClient();
  const llmConfig = getLLMConfig();
  const model = config.model || llmConfig.model;
  const maxTokens = config.maxTokens || DEFAULT_MAX_TOKENS;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        messages,
      });

      return response.choices[0]?.message?.content || "";
    } catch (err) {
      lastError = err as Error;

      // Don't retry on final attempt
      if (attempt === maxRetries) break;

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt) * 1000;
      await sleep(delay);
    }
  }

  throw lastError || new Error("LLM call failed after retries");
}

/**
 * Sleep for ms milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract JSON from a tagged block in text (e.g., <tasks>...</tasks>)
 * Returns null if no tag found or JSON parse fails
 */
export function extractTaggedJSON<T = Record<string, unknown>>(
  text: string,
  tag: string
): T | null {
  const pattern = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "");
  const match = text.match(pattern);
  if (!match) return null;

  try {
    return JSON.parse(match[1].trim()) as T;
  } catch {
    return null;
  }
}

/**
 * Strip a tagged block from text (e.g., <tasks>...</tasks>)
 */
export function stripTaggedContent(text: string, tag: string): string {
  const pattern = new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`, "g");
  return text.replace(pattern, "").trim();
}

/**
 * Strip think tags from text
 */
export function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/, "").trim();
}

export { MINIMAX_BASE_URL, DEFAULT_MODEL };

/**
 * Async generator that yields deltas from a streaming LLM call.
 */
export async function* callLLMStream(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[],
  config: LLMConfig = DEFAULT_CONFIG,
): AsyncGenerator<string, void, unknown> {
  const client = createLLMClient();
  const llmConfig = getLLMConfig();
  const model = config.model || llmConfig.model;
  const maxTokens = config.maxTokens || DEFAULT_MAX_TOKENS;

  const stream = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      yield delta;
    }
  }
}
