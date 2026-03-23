# Test Pyramid - TeamBuddy

TeamBuddy 采用经典测试金字塔策略，将测试按金字塔分层：

```
                    ┌─────────────┐
                    │    E2E     │  10-15%
                    │   Tests    │  关键用户路径
                    └──────┬──────┘
                  ┌───────┴───────┐
                  │  Integration  │  20-25%
                  │    Tests     │  API + 模块协作
                  └───────┬───────┘
                ┌─────────┴─────────┐
                │     Unit Tests    │  60-70%
                │   业务逻辑/工具   │  纯函数验证
                └───────────────────┘
```

## 分层结构

```
tests/
├── unit/                    # 单元测试 (60-70%)
│   └── *.test.ts           # Vitest - 纯函数、工具类
├── integration/             # 集成测试 (20-25%)
│   └── *.test.ts           # Vitest - API 路由、数据转换
└── e2e/                    # E2E 测试 (10-15%)
    └── **/*.spec.ts        # Playwright - 关键用户流程
```

## 各层职责

### Unit Tests (单元测试)
- **位置**: `tests/unit/`
- **运行**: `npm test` / `npm run test:coverage`
- **工具**: Vitest + @vitest/coverage-v8
- **覆盖目标**: 60-70%
- **范围**:
  - 业务逻辑函数 (requirement-engine)
  - 纯工具函数 (stripTasksTag, stripThinkTag)
  - 状态转换逻辑
  - 数据转换/验证

### Integration Tests (集成测试)
- **位置**: `tests/integration/`
- **运行**: `npm run test:integration`
- **工具**: Vitest (node 环境)
- **覆盖目标**: 20-25%
- **范围**:
  - API 路由处理逻辑
  - 数据库操作正确性
  - 模块间协作
  - 输入验证边界

### E2E Tests (端到端测试)
- **位置**: `tests/e2e/`
- **运行**: `npm run test:e2e`
- **工具**: Playwright
- **覆盖目标**: 10-15% (关键路径)
- **范围**:
  - 登录 → 关键页面
  - 需求创建完整流程
  - 页面导航
  - UI 交互

## 运行命令

```bash
# 运行所有单元测试 (含覆盖率)
npm test

# 运行单元测试 (监听模式)
npm run test:watch

# 运行单元测试覆盖率报告
npm run test:coverage

# 运行集成测试
npm run test:integration

# 运行 E2E 测试
npm run test:e2e

# 运行完整测试套件 (CI 用)
npm run test:all
```

## CI 集成

GitHub Actions CI (`.github/workflows/ci.yml`) 运行三层测试：

```yaml
jobs:
  build:     # 编译检查
  test:      # 单元测试 (needs build)
  e2e:       # E2E 测试 (needs build)
```

集成测试在 CI 中作为独立 job 运行：

```bash
# CI 中运行集成测试
npm run test:integration
```

## 覆盖目标

| 层级 | 目标 | 当前 |
|------|------|------|
| Unit | 60-70% | ~65% |
| Integration | 20-25% | ~15% |
| E2E | 10-15% | ~10% |

## 覆盖率阈值

- **Branch**: >60%
- **Functions**: >70%
- **Lines**: >65%
- **Statements**: >65%

查看详细报告：
```bash
npm run test:coverage
open coverage/index.html
```

## 添加新测试

### 单元测试
```typescript
// tests/unit/my-function.test.ts
import { describe, it, expect } from 'vitest'
import { myFunction } from '@/lib/my-function'

describe('myFunction', () => {
  it('should do something', () => {
    expect(myFunction(input)).toBe(expected)
  })
})
```

### 集成测试
```typescript
// tests/integration/api-myresource.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/db', () => ({ db: mockDb }))

describe('MyResource API', () => {
  it('should validate input correctly', () => {
    // Test validation, transformation, routing logic
  })
})
```

### E2E 测试
```typescript
// tests/e2e/mypage/page.spec.ts
import { test, expect } from '@playwright/test'

test.describe('MyPage', () => {
  test.beforeEach(async ({ page }) => {
    // Login setup
    await page.goto('/login')
    // ...
  })

  test('should load page', async ({ page }) => {
    await page.goto('/mypage')
    await expect(page.locator('h1')).toBeVisible()
  })
})
```

## 测试原则

1. **单元测试** - 快速、独立、可重复
2. **集成测试** - 验证模块边界，不依赖外部服务
3. **E2E 测试** - 关键路径全覆盖，不测边界情况
4. **优先失败消息** - 测试失败时能直接定位问题
5. **不测试框架** - 不重复测试框架自带能力
