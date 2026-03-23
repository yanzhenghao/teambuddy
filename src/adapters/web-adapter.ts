import { ChannelAdapter } from "./channel-adapter";

/**
 * Web Adapter — 通过 Web API 实现的通道适配器
 *
 * 用于 Web Dashboard 中的 Standup 对话界面。
 * 消息通过 API 收发，前端轮询或 SSE 获取 Agent 消息。
 */

interface QueuedMessage {
  memberId: string;
  content: string;
  timestamp: string;
}

interface PendingReply {
  resolve: (value: string | null) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class WebAdapter implements ChannelAdapter {
  readonly name = "Web";

  /** Agent 发给组员的消息队列（前端来取） */
  private outbox: QueuedMessage[] = [];

  /** 组员回复的等待队列 */
  private pendingReplies = new Map<string, PendingReply>();

  async sendMessage(memberId: string, content: string): Promise<void> {
    this.outbox.push({
      memberId,
      content,
      timestamp: new Date().toISOString(),
    });
  }

  async waitForReply(memberId: string, timeoutMs: number): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => {
        this.pendingReplies.delete(memberId);
        resolve(null);
      }, timeoutMs);

      this.pendingReplies.set(memberId, { resolve, timer });
    });
  }

  /** 前端调用：获取 Agent 发送的消息 */
  getOutbox(memberId: string): QueuedMessage[] {
    const messages = this.outbox.filter((m) => m.memberId === memberId);
    this.outbox = this.outbox.filter((m) => m.memberId !== memberId);
    return messages;
  }

  /** 前端调用：提交组员的回复 */
  submitReply(memberId: string, content: string): boolean {
    const pending = this.pendingReplies.get(memberId);
    if (!pending) return false;

    clearTimeout(pending.timer);
    this.pendingReplies.delete(memberId);
    pending.resolve(content);
    return true;
  }

  async destroy(): Promise<void> {
    for (const [, pending] of this.pendingReplies) {
      clearTimeout(pending.timer);
      pending.resolve(null);
    }
    this.pendingReplies.clear();
    this.outbox = [];
  }
}
