/**
 * 飞书 Webhook 回调端点
 *
 * 用于接收飞书事件推送（消息接收、事件订阅确认等）
 *
 * 事件类型：
 * - im.message.receive_v1: 接收消息
 * - application.verification_url: URL 验证（用于事件订阅配置）
 */

import { NextRequest, NextResponse } from "next/server";
import { feishuAdapter } from "@/adapters/feishu-adapter";

/**
 * GET 用于飞书事件订阅 URL 验证
 * 飞书在配置事件订阅时会发送 GET 请求验证 URL
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  // 飞书事件订阅验证
  const challenge = params.get("challenge");
  if (challenge) {
    return NextResponse.json({ challenge });
  }

  return NextResponse.json({ error: "Unknown verification request" }, { status: 400 });
}

/**
 * POST 用于接收飞书事件回调
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // URL 验证回调
    if (body.type === "url_verification") {
      return NextResponse.json({ challenge: body.challenge });
    }

    // 处理事件回调
    await feishuAdapter.handleCallback(body);

    return NextResponse.json({ code: 0, msg: "success" });
  } catch (err) {
    console.error("[Feishu Webhook] Error processing callback:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
