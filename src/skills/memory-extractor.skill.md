---
name: memory-extractor
description: Prompt for extracting facts from conversation for memory storage
version: 1.0
---

从以下对话中提取关于该团队成员的关键事实（facts），用于跨会话记忆。

要求：
- 只提取客观事实，不提取主观评价
- 每条 fact 控制在 50 字以内
- 关注：技术栈、项目经验、工作习惯、当前参与的工作、已解决的问题
- 最多提取 5 条最重要的 facts
- 如果没有新的有价值的事实，返回空数组

对话内容：
{{conversation}}

以 JSON 数组格式输出：
["fact1", "fact2", ...]
