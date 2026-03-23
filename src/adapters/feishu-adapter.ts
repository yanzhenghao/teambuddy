/**
 * Feishu (Lark) Adapter — 飞书 IM 适配器
 *
 * 实现 ChannelAdapter 接口，通过飞书机器人 API 发送消息，
 * 通过飞书 Events API 接收消息回调。
 *
 * 环境变量配置：
 * - FEISHU_APP_ID: 飞书应用 App ID
 * - FEISHU_APP_SECRET: 飞书应用 App Secret
 * - FEISHU_WEBHOOK_URL: 机器人 Webhook 地址（可选，用于主动推送）
 * - FEISHU_VERIFICATION_TOKEN: 事件订阅验证 Token
 */

import { ChannelAdapter } from "./channel-adapter";

interface PendingReply {
  resolve: (value: string | null) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface FeishuMessage {
  msg_type: "text" | "interactive";
  content: { text?: string };
}

export class FeishuAdapter implements ChannelAdapter {
  readonly name = "Feishu";

  private appId: string;
  private appSecret: string;
  private webhookUrl: string;
  private verificationToken: string;
  private pendingReplies = new Map<string, PendingReply>();
  private accessToken: string | null = null;
  private accessTokenExpiry = 0;

  constructor() {
    this.appId = process.env.FEISHU_APP_ID || "";
    this.appSecret = process.env.FEISHU_APP_SECRET || "";
    this.webhookUrl = process.env.FEISHU_WEBHOOK_URL || "";
    this.verificationToken = process.env.FEISHU_VERIFICATION_TOKEN || "";
  }

  /**
   * 检查是否已配置飞书适配器
   */
  isConfigured(): boolean {
    return !!(this.appId && this.appSecret && this.webhookUrl);
  }

  /**
   * 获取飞书 Access Token（用于 API 调用）
   */
  private async getAccessToken(): Promise<string | null> {
    if (this.accessToken && Date.now() < this.accessTokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await fetch(
        `https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            app_id: this.appId,
            app_secret: this.appSecret,
          }),
        }
      );

      if (!response.ok) {
        console.error("[Feishu] Failed to get access token:", response.status);
        return null;
      }

      const data = (await response.json()) as {
        code?: number;
        tenant_access_token?: string;
        expire?: number;
      };

      if (data.code !== 0 || !data.tenant_access_token) {
        console.error("[Feishu] Access token error:", data);
        return null;
      }

      this.accessToken = data.tenant_access_token;
      // Token 通常有效期 2 小时，提前 5 分钟刷新
      this.accessTokenExpiry = Date.now() + ((data.expire || 7200) - 300) * 1000;
      return this.accessToken;
    } catch (err) {
      console.error("[Feishu] Error getting access token:", err);
      return null;
    }
  }

  /**
   * 发送文本消息给指定成员（通过单聊）
   * 注意：需要通过 user_id 或 open_id 发送
   */
  async sendMessage(memberId: string, content: string): Promise<void> {
    if (!this.isConfigured()) {
      console.warn("[Feishu] Adapter not configured, skipping message");
      return;
    }

    const token = await this.getAccessToken();
    if (!token) {
      console.error("[Feishu] No access token, cannot send message");
      return;
    }

    try {
      // 先获取用户的 open_id
      const userResponse = await fetch(
        `https://open.feishu.cn/open-apis/contact/v3/users/batch_get_id`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            emails: [memberId], // memberId 作为 email
            user_id_type: "open_id",
          }),
        }
      );

      if (!userResponse.ok) {
        console.error("[Feishu] Failed to get user by email:", userResponse.status);
        return;
      }

      const userData = (await userResponse.json()) as {
        data?: { users?: Array<{ open_id?: string }> };
      };
      const openId = userData?.data?.users?.[0]?.open_id;

      if (!openId) {
        console.error("[Feishu] Could not find open_id for:", memberId);
        return;
      }

      // 发送单聊消息
      const msgResponse = await fetch(
        `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            receive_id: openId,
            msg_type: "text",
            content: JSON.stringify({ text: content }),
          }),
        }
      );

      if (!msgResponse.ok) {
        console.error("[Feishu] Failed to send message:", msgResponse.status);
      }
    } catch (err) {
      console.error("[Feishu] Error sending message:", err);
    }
  }

  /**
   * 等待成员在飞书中的回复（通过回调注册）
   */
  async waitForReply(memberId: string, timeoutMs: number): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => {
        this.pendingReplies.delete(memberId);
        resolve(null);
      }, timeoutMs);

      this.pendingReplies.set(memberId, { resolve, timer });
    });
  }

  /**
   * 处理收到的飞书消息回调
   * 由 webhook 路由调用
   */
  async handleCallback(payload: FeishuCallbackPayload): Promise<void> {
    if (payload.header.event_type === "im.message.receive_v1") {
      const message = payload.event.content;
      const senderId = payload.event.sender?.sender_id?.open_id || "";
      const chatId = payload.event.chat_id || "";

      // 从消息中提取文本内容
      let textContent = "";
      try {
        const msgContent = JSON.parse(payload.event.content);
        textContent = msgContent.text || "";
      } catch {
        textContent = payload.event.content;
      }

      // 找到等待此用户回复的 pending reply
      for (const [memberId, pending] of this.pendingReplies) {
        // 匹配逻辑：可以通过 open_id 或其他标识匹配
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingReplies.delete(memberId);
          pending.resolve(textContent);
          break;
        }
      }
    }
  }

  /**
   * 发送互动消息卡片到群组（用于日报推送等）
   */
  async sendToGroup?(groupId: string, content: string): Promise<void> {
    if (!this.isConfigured()) {
      console.warn("[Feishu] Adapter not configured, skipping group message");
      return;
    }

    // 发送富文本消息卡片
    try {
      const response = await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          msg_type: "interactive",
          card: {
            config: { wide_screen_mode: true },
            elements: [
              {
                tag: "div",
                text: {
                  content,
                  tag: "lark_md",
                },
              },
            ],
          },
        }),
      });

      if (!response.ok) {
        console.error("[Feishu] Failed to send group message:", response.status);
      }
    } catch (err) {
      console.error("[Feishu] Error sending group message:", err);
    }
  }

  async init?(): Promise<void> {
    // 验证配置
    if (!this.isConfigured()) {
      console.warn(
        "[Feishu] Adapter not fully configured. Set FEISHU_APP_ID, FEISHU_APP_SECRET, and FEISHU_WEBHOOK_URL"
      );
    }
    // 可在此处初始化 WebSocket 连接以接收事件推送
  }

  async destroy?(): Promise<void> {
    for (const [, pending] of this.pendingReplies) {
      clearTimeout(pending.timer);
      pending.resolve(null);
    }
    this.pendingReplies.clear();
  }
}

interface FeishuCallbackPayload {
  header: {
    event_type: string;
    event_id?: string;
    create_time?: string;
    token?: string;
    app_id?: string;
    tenant_key?: string;
  };
  event: {
    chat_id?: string;
    content: string;
    create_time?: string;
    message_id?: string;
    sender?: {
      sender_id?: { open_id?: string; user_id?: string; union_id?: string };
      sender_type?: string;
      tenant_key?: string;
    };
  };
}

export const feishuAdapter = new FeishuAdapter();
