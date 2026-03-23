import { describe, it, expect } from 'vitest'
import {
  extractTasks,
  stripTasksTag,
  stripThinkTag,
} from '../../src/services/requirement-engine'

describe('requirement-engine', () => {
  describe('extractTasks', () => {
    it('should extract tasks from valid tasks tag', () => {
      const text = `
      你好，我来分析这个需求。

      <tasks>
      {
        "summary": "用户登录系统",
        "tasks": [
          {
            "title": "实现登录页面",
            "description": "创建登录表单组件",
            "category": "feature",
            "priority": "P0",
            "estimatedDays": 2,
            "requiredSkills": ["React", "TypeScript"],
            "suggestedAssignee": {
              "memberId": "m1",
              "memberName": "李明",
              "reason": "前端开发"
            }
          }
        ]
      }
      </tasks>

      这是我的分析结果。
      `

      const result = extractTasks(text)

      expect(result).not.toBeNull()
      expect(result!.summary).toBe("用户登录系统")
      expect(result!.tasks).toHaveLength(1)
      expect(result!.tasks[0].title).toBe("实现登录页面")
      expect(result!.tasks[0].category).toBe("feature")
      expect(result!.tasks[0].priority).toBe("P0")
      expect(result!.tasks[0].estimatedDays).toBe(2)
      expect(result!.tasks[0].suggestedAssignee?.memberName).toBe("李明")
    })

    it('should return null when no tasks tag found', () => {
      const text = "这是一个普通的需求描述，没有任务标签。"

      const result = extractTasks(text)

      expect(result).toBeNull()
    })

    it('should handle empty tasks array', () => {
      const text = `
      <tasks>
      {
        "summary": "无任务需求",
        "tasks": []
      }
      </tasks>
      `

      const result = extractTasks(text)

      expect(result).not.toBeNull()
      expect(result!.summary).toBe("无任务需求")
      expect(result!.tasks).toHaveLength(0)
    })

    it('should use defaults for missing fields', () => {
      const text = `
      <tasks>
      {
        "summary": "测试默认",
        "tasks": [
          {
            "title": "测试任务"
          }
        ]
      }
      </tasks>
      `

      const result = extractTasks(text)

      expect(result).not.toBeNull()
      expect(result!.tasks[0].category).toBe("feature")
      expect(result!.tasks[0].priority).toBe("P2")
      expect(result!.tasks[0].estimatedDays).toBe(1)
      expect(result!.tasks[0].requiredSkills).toEqual([])
      expect(result!.tasks[0].suggestedAssignee).toBeNull()
    })

    it('should handle multiple tasks', () => {
      const text = `
      <tasks>
      {
        "summary": "完整项目",
        "tasks": [
          {
            "title": "任务1",
            "category": "feature",
            "priority": "P0"
          },
          {
            "title": "任务2",
            "category": "bug",
            "priority": "P1"
          },
          {
            "title": "任务3",
            "category": "optimization",
            "priority": "P2"
          }
        ]
      }
      </tasks>
      `

      const result = extractTasks(text)

      expect(result).not.toBeNull()
      expect(result!.tasks).toHaveLength(3)
      expect(result!.tasks[0].title).toBe("任务1")
      expect(result!.tasks[1].title).toBe("任务2")
      expect(result!.tasks[2].title).toBe("任务3")
    })

    it('should handle malformed JSON gracefully', () => {
      const text = `
      <tasks>
      this is not json at all
      </tasks>
      `

      const result = extractTasks(text)

      expect(result).toBeNull()
    })
  })

  describe('stripTasksTag', () => {
    it('should remove tasks tag and content', () => {
      const text = "前面内容 <tasks>中间内容</tasks> 后面内容"

      const result = stripTasksTag(text)

      expect(result).toBe("前面内容  后面内容")
    })

    it('should handle text without tasks tag', () => {
      const text = "没有任务标签的普通文本"

      const result = stripTasksTag(text)

      expect(result).toBe("没有任务标签的普通文本")
    })

    it('should handle multiline tasks tag', () => {
      const text = `开头
      <tasks>
      {
        "title": "任务"
      }
      </tasks>
      结尾`

      const result = stripTasksTag(text)

      expect(result).toBe("开头\n      \n      结尾")
    })

    it('should handle multiple tasks tags', () => {
      // Note: regex only replaces first occurrence
      const text = "文本1 <tasks>内容1</tasks> 文本2 <tasks>内容2</tasks> 文本3"

      const result = stripTasksTag(text)

      expect(result).toBe("文本1  文本2 <tasks>内容2</tasks> 文本3")
    })
  })

  describe('stripThinkTag', () => {
    it('should remove think tag and content', () => {
      const text = "前面 <think>思考内容</think> 后面"

      const result = stripThinkTag(text)

      expect(result).toBe("前面  后面")
    })

    it('should handle text without think tag', () => {
      const text = "没有思考标签的文本"

      const result = stripThinkTag(text)

      expect(result).toBe("没有思考标签的文本")
    })

    it('should handle multiline think tag', () => {
      const text = `开头
      <think>
       这是多行思考内容
       包含多行
       </think>
       结尾`

      const result = stripThinkTag(text)

      // Note: keeps the newlines as-is since regex doesn't strip surrounding whitespace
      expect(result).toContain("开头")
      expect(result).toContain("结尾")
      expect(result).not.toContain("这是多行思考内容")
    })

    it('should handle think tag at start', () => {
      const text = "<think>开始思考</think>然后是正文"

      const result = stripThinkTag(text)

      expect(result).toBe("然后是正文")
    })
  })
})
