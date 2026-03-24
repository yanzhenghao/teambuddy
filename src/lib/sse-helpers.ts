/**
 * SSE helpers for streaming responses.
 * Creates a ReadableStream that emits SSE-formatted chunks.
 */

/**
 * Wrap an async string generator into a ReadableStream with SSE formatting.
 * @param generator - async generator that yields text chunks
 * @param onComplete - called with full text when stream finishes
 */
export function createSSEStream(
  generator: AsyncGenerator<string, void, unknown>,
  onComplete?: (fullText: string) => void
): ReadableStream {
  let fullText = "";

  return new ReadableStream({
    async pull(controller) {
      try {
        const { value, done } = await generator.next();
        if (done) {
          if (onComplete) {
            try {
              onComplete(fullText);
            } catch {
              // ignore
            }
          }
          controller.close();
        } else {
          fullText += value;
          const encoded = new TextEncoder().encode(
            `data: ${JSON.stringify({ type: "delta", content: value })}\n\n`
          );
          controller.enqueue(encoded);
        }
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

/**
 * Send a final SSE event and close the stream.
 */
export function sendSSEDone(
  controller: ReadableStreamDefaultController,
  result?: unknown
): void {
  try {
    const encoded = new TextEncoder().encode(
      `data: ${JSON.stringify({ type: "done", result })}\n\n`
    );
    controller.enqueue(encoded);
    controller.close();
  } catch {
    // already closed
  }
}
