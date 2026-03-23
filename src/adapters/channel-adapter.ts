/**
 * Channel Adapter — 通讯通道抽象接口
 *
 * 所有 IM 适配器（CLI、企业微信、飞书、钉钉、自研 IM）都实现这个接口。
 * Agent 核心只依赖此接口，不关心底层通道实现。
 */

export interface Message {
  role: "agent" | "member";
  content: string;
  timestamp: string;
}

export interface ChannelAdapter {
  /** 适配器名称，用于日志和调试 */
  readonly name: string;

  /** 向指定成员发送消息 */
  sendMessage(memberId: string, content: string): Promise<void>;

  /** 等待指定成员的回复，超时返回 null */
  waitForReply(memberId: string, timeoutMs: number): Promise<string | null>;

  /** 向群组发送消息（如日报推送） */
  sendToGroup?(groupId: string, content: string): Promise<void>;

  /** 适配器初始化（如 WebSocket 连接） */
  init?(): Promise<void>;

  /** 适配器清理（如关闭连接） */
  destroy?(): Promise<void>;
}
