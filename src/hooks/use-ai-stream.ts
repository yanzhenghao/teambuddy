"use client";

import { useState, useCallback, useRef } from "react";

export interface DoneData {
  result?: unknown;
  furId?: string;
  done?: boolean;
}

export interface UseAIStreamReturn {
  streamingText: string;
  isStreaming: boolean;
  error: string | null;
  doneData: DoneData | null;
  startStream: (url: string, body: Record<string, unknown>) => Promise<void>;
  stopStream: () => void;
}

export function useAIStream(): UseAIStreamReturn {
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneData, setDoneData] = useState<DoneData | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopStream = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
  }, []);

  const startStream = useCallback(
    async (url: string, body: Record<string, unknown>): Promise<void> => {
      stopStream();
      setStreamingText("");
      setError(null);
      setDoneData(null);
      setIsStreaming(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "delta" && typeof parsed.content === "string") {
                setStreamingText((prev) => prev + parsed.content);
              } else if (parsed.type === "done") {
                setDoneData({
                  result: parsed.result,
                  furId: parsed.furId,
                  done: parsed.done,
                });
              }
            } catch {
              // skip malformed
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // stopped intentionally
        } else {
          setError(err instanceof Error ? err.message : "Stream failed");
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [stopStream]
  );

  return { streamingText, isStreaming, error, doneData, startStream, stopStream };
}
