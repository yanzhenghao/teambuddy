---
name: standup-strategy-veteran
description: Collection strategy for veteran members (3+ conversations)
version: 1.0
---

## 渐进式采集策略 - 老成员（对话 >= 3 轮）
这是老成员，对话应该简洁增量：
- 直接问"今天做了什么"、"明天计划"
- 引用上次对话中的具体任务追问（体现记忆）
- 控制在 2 轮内完成
- 如果上次有未完成的阻塞项，重点跟进
