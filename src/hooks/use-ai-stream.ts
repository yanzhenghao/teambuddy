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

const BATCH_INTERVAL_MS = 150; // Batch state updates every 150ms to reduce re-renders

export function useAIStream(): UseAIStreamReturn {
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneData, setDoneData] = useState<DoneData | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const accumulatedRef = useRef("");
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushBatch = useCallback(() => {
    if (accumulatedRef.current) {
      const chunk = accumulatedRef.current;
      accumulatedRef.current = "";
      setStreamingText((prev) => prev + chunk);
    }
    batchTimerRef.current = null;
  }, []);

  const stopStream = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
    // Flush remaining text
    if (accumulatedRef.current) {
      const chunk = accumulatedRef.current;
      accumulatedRef.current = "";
      setStreamingText((prev) => prev + chunk);
    }
    setIsStreaming(false);
  }, []);

  const startStream = useCallback(
    async (url: string, body: Record<string, unknown>): Promise<void> => {
      stopStream();
      setStreamingText("");
      setError(null);
      setDoneData(null);
      setIsStreaming(true);
      accumulatedRef.current = "";

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
                // Accumulate deltas, flush in batches
                accumulatedRef.current += parsed.content;
                if (!batchTimerRef.current) {
                  batchTimerRef.current = setTimeout(flushBatch, BATCH_INTERVAL_MS);
                }
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

        // Flush any remaining accumulated text
        if (batchTimerRef.current) {
          clearTimeout(batchTimerRef.current);
          batchTimerRef.current = null;
        }
        if (accumulatedRef.current) {
          const chunk = accumulatedRef.current;
          accumulatedRef.current = "";
          setStreamingText((prev) => prev + chunk);
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
    [stopStream, flushBatch]
  );

  return { streamingText, isStreaming, error, doneData, startStream, stopStream };
}
