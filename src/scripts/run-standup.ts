/**
 * CLI Standup Runner
 *
 * 通过终端模拟 Agent 与组员之间的 standup 对话。
 * 用法: npx tsx src/scripts/run-standup.ts [memberId]
 *
 * 如果不指定 memberId，会依次与所有成员对话。
 */

import { CLIAdapter } from "../adapters/cli-adapter";
import { StandupService } from "../services/standup-service";

async function main() {
  const memberId = process.argv[2];

  const adapter = new CLIAdapter();
  await adapter.init?.();

  const service = new StandupService(adapter);

  console.log("========================================");
  console.log("  TeamBuddy - CLI Standup");
  console.log("========================================");
  console.log("  直接输入回复即可，Agent 会收集你的进展。");
  console.log("  输入 'quit' 退出。\n");

  try {
    if (memberId) {
      console.log(`开始与 ${memberId} 的 standup 对话...\n`);
      const result = await service.runForMember(memberId);
      if (result.extracted) {
        console.log("\n--- 提取结果 ---");
        console.log(JSON.stringify(result.extracted, null, 2));
      }
    } else {
      console.log("开始全员 standup...\n");
      const results = await service.runForAll();
      console.log("\n--- 全员 Standup 结果 ---");
      for (const [id, result] of results) {
        console.log(`${id}: ${result.success ? "成功" : "失败"}`);
        if (result.extracted) {
          console.log(`  完成: ${result.extracted.completed_items.join(", ")}`);
          console.log(`  计划: ${result.extracted.planned_items.join(", ")}`);
          console.log(`  阻塞: ${result.extracted.blockers.join(", ") || "无"}`);
        }
      }
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await adapter.destroy?.();
    process.exit(0);
  }
}

main();
