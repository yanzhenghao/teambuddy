import { NextResponse } from "next/server";

export const CACHE_PRESETS = {
  /** 成员列表等低频变动数据，5 分钟 */
  STATIC: { maxAge: 300, swr: 600 },
  /** 需求树、任务列表等中频数据，30 秒 */
  MODERATE: { maxAge: 30, swr: 60 },
  /** 分析页等重计算数据，15 分钟 */
  ANALYTICS: { maxAge: 900, swr: 1800 },
} as const;

type CachePreset = (typeof CACHE_PRESETS)[keyof typeof CACHE_PRESETS];

/**
 * 返回带 Cache-Control 头的 JSON 响应。
 * 仅用于成功响应；错误响应应继续使用 NextResponse.json()。
 */
export function cachedJson<T>(data: T, preset: CachePreset): NextResponse {
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": `public, s-maxage=${preset.maxAge}, stale-while-revalidate=${preset.swr}`,
    },
  });
}
