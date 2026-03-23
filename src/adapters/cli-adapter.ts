import { ChannelAdapter } from "./channel-adapter";

/**
 * CLI Adapter — 用于开发测试的终端模拟适配器
 *
 * 通过 stdin/stdout 模拟 Agent 与组员之间的对话。
 * 后续替换为真实 IM 适配器时，Agent 核心代码无需修改。
 */

interface PendingReply {
  resolve: (value: string | null) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class CLIAdapter implements ChannelAdapter {
  readonly name = "CLI";
  private pendingReplies = new Map<string, PendingReply>();
  private readline: ReturnType<typeof import("readline").createInterface> | null = null;

  async init(): Promise<void> {
    const rl = await import("readline");
    this.readline = rl.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    this.readline.on("line", (line: string) => {
      // Format: memberId:message or just message (defaults to current context)
      const colonIdx = line.indexOf(":");
      let memberId: string;
      let message: string;

      if (colonIdx > 0 && colonIdx < 5) {
        memberId = line.slice(0, colonIdx).trim();
        message = line.slice(colonIdx + 1).trim();
      } else {
        // Use the first pending reply's member ID
        const firstKey = this.pendingReplies.keys().next().value;
        if (!firstKey) {
          console.log("[CLI] No pending conversation. Format: memberId:message");
          return;
        }
        memberId = firstKey;
        message = line.trim();
      }

      const pending = this.pendingReplies.get(memberId);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingReplies.delete(memberId);
        pending.resolve(message);
      }
    });
  }

  async sendMessage(memberId: string, content: string): Promise<void> {
    console.log(`\n[Agent → ${memberId}] ${content}`);
  }

  async waitForReply(memberId: string, timeoutMs: number): Promise<string | null> {
    process.stdout.write(`[${memberId} → Agent] > `);

    return new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => {
        this.pendingReplies.delete(memberId);
        console.log(`\n[CLI] Timeout waiting for ${memberId}`);
        resolve(null);
      }, timeoutMs);

      this.pendingReplies.set(memberId, { resolve, timer });
    });
  }

  async destroy(): Promise<void> {
    for (const [, pending] of this.pendingReplies) {
      clearTimeout(pending.timer);
      pending.resolve(null);
    }
    this.pendingReplies.clear();
    this.readline?.close();
    this.readline = null;
  }
}
