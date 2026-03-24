import { callLLM } from "./llm-client";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  config?: {
    model?: string;
    maxTokens?: number;
  };
}

export interface LLMResponse {
  raw: string;
  cleaned: string;
  extracted: unknown;
}

export interface MiddlewareContext {
  memberId?: string;
  sessionId?: string;
  [key: string]: unknown;
}

export interface AIMiddleware {
  name: string;
  before?: (req: LLMRequest, ctx: MiddlewareContext) => LLMRequest;
  after?: (raw: string, ctx: MiddlewareContext) => LLMResponse;
}

function defaultAfter(raw: string): LLMResponse {
  return { raw, cleaned: raw, extracted: null };
}

/**
 * Create a middleware pipeline that wraps LLM calls.
 * - Each `before` runs in order, each returning a (possibly modified) LLMRequest.
 * - Then callLLM is invoked once.
 * - Each `after` runs in reverse order.
 */
export function createPipeline(
  ...middlewares: AIMiddleware[]
): {
  execute(req: LLMRequest, ctx: MiddlewareContext): Promise<LLMResponse>;
} {
  return {
    async execute(req: LLMRequest, ctx: MiddlewareContext): Promise<LLMResponse> {
      // Run all before middlewares sequentially (support async before)
      let currentReq = { ...req, messages: [...req.messages] };
      for (const mw of middlewares) {
        if (mw.before) {
          const result = mw.before(currentReq, ctx);
          currentReq = result instanceof Promise ? await result : result;
        }
      }

      // Call LLM
      const raw = await callLLM(currentReq.messages, currentReq.config);

      // Run all after middlewares in reverse order
      let response: LLMResponse = defaultAfter(raw);
      for (const mw of [...middlewares].reverse()) {
        if (mw.after) {
          response = mw.after(response.raw, ctx);
        }
      }

      return response;
    },
  };
}
