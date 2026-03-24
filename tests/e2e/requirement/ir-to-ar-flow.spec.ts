import { test, expect } from '@playwright/test'

const SCREENSHOT_DIR = 'tests/e2e/requirement/screenshots'

test.describe('IR → FuR → AR 端到端全流程', () => {
  test.setTimeout(180000) // 3 minutes

  test('完整流程: 创建IR → 多轮对话 → 生成FuR → 确认任务 → 生成AR', async ({ page }) => {
    // ===== Login =====
    await page.goto('http://localhost:3000/login')
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('input[type="text"]', { timeout: 10000 })
    await page.locator('input[type="text"]').fill('admin')
    await page.locator('input[type="password"]').fill('admin123')
    await page.locator('button[type="submit"]').click()
    await page.waitForURL('**/', { timeout: 10000 })

    await page.goto('http://localhost:3000/requirement')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-page.png`, fullPage: true })

    // ===== Step 1: 创建 IR =====
    await page.locator('button:has-text("新建 IR")').first().click()
    await page.waitForTimeout(500)

    await page.locator('textarea').fill('开发用户登录注册模块，支持邮箱和手机号两种方式')
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-create-ir.png`, fullPage: true })

    await page.locator('button:has-text("开始分析")').click()

    // Wait for chat mode
    await page.waitForSelector('input[placeholder*="回答"]', { timeout: 30000 })
    await page.waitForTimeout(2000)
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-chat-first-response.png`, fullPage: true })

    // ===== Step 2: 多轮对话直到生成任务 =====
    const replies = [
      '1. 前端用React，后端用Node.js Express\n2. 需要邮箱验证码和手机短信验证码\n3. 密码需要加密存储，使用bcrypt\n4. 需要JWT token认证\n5. 注册后自动登录\n6. 团队里李明负责前端，王强负责后端，张伟负责测试',
      '请直接拆解任务并分配给团队成员，不需要再问问题了',
      '信息已经足够了，请立即输出任务拆解方案，用<tasks>标签包裹JSON',
    ]

    let tasksGenerated = false

    for (let i = 0; i < replies.length; i++) {
      const chatInput = page.locator('input[placeholder*="回答"]')
      const inputVisible = await chatInput.isVisible().catch(() => false)
      if (!inputVisible) break

      await chatInput.fill(replies[i])
      await page.locator('button:has-text("发送")').click()

      // Wait for AI response
      // Wait for loading indicator to appear then disappear
      await page.waitForTimeout(2000) // initial delay
      try {
        await page.waitForSelector('.animate-bounce', { timeout: 3000 })
      } catch { /* loading may have already finished */ }
      try {
        await page.waitForSelector('.animate-bounce', { state: 'hidden', timeout: 30000 })
      } catch { /* timeout is ok */ }
      await page.waitForTimeout(1000)

      await page.screenshot({ path: `${SCREENSHOT_DIR}/04-chat-round-${i + 1}.png`, fullPage: true })

      // Check if task breakdown panel appeared
      const taskPanel = page.locator('text=任务拆解完成')
      tasksGenerated = await taskPanel.isVisible().catch(() => false)

      if (tasksGenerated) {
        console.log(`Tasks generated after round ${i + 1}`)
        break
      }

      // If tasks not generated yet, check if input is still available
      const stillActive = await chatInput.isVisible().catch(() => false)
      if (!stillActive) {
        console.log('Chat input no longer visible, conversation may have ended')
        break
      }
    }

    if (tasksGenerated) {
      // ===== Step 3: 任务拆解展示 =====
      // Scroll to bottom to see the task panel
      const messagesContainer = page.locator('.overflow-y-auto').first()
      await messagesContainer.evaluate(el => el.scrollTop = el.scrollHeight)
      await page.waitForTimeout(500)
      await page.screenshot({ path: `${SCREENSHOT_DIR}/05-task-breakdown.png`, fullPage: true })

      // ===== Step 4: 确认任务分配 =====
      const confirmButton = page.locator('button:has-text("确认并分配")')
      await confirmButton.scrollIntoViewIfNeeded()
      await confirmButton.click()
      await page.waitForTimeout(3000)

      await page.screenshot({ path: `${SCREENSHOT_DIR}/06-after-confirm.png`, fullPage: true })
    } else {
      console.log('AI did not generate tasks after all rounds, taking final screenshot')
      // Scroll to see latest messages
      const messagesContainer = page.locator('.overflow-y-auto').first()
      await messagesContainer.evaluate(el => el.scrollTop = el.scrollHeight)
      await page.waitForTimeout(500)
      await page.screenshot({ path: `${SCREENSHOT_DIR}/05-no-tasks-final.png`, fullPage: true })
    }

    // ===== Step 5: 查看完整树结构 =====
    // Refresh page to ensure tree is fully loaded
    await page.goto('http://localhost:3000/requirement')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Expand all tree nodes
    const treePanel = page.locator('.w-80')
    const expandButtons = treePanel.locator('button:has(svg)')
    const btnCount = await expandButtons.count()
    for (let i = 0; i < btnCount; i++) {
      try {
        const btn = expandButtons.nth(i)
        if (await btn.isVisible()) {
          await btn.click()
          await page.waitForTimeout(300)
        }
      } catch { /* skip */ }
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/07-full-tree.png`, fullPage: true })

    // Click on FuR if visible
    const furNodes = page.locator('span.bg-green-100:has-text("FuR")')
    if (await furNodes.count() > 0) {
      await furNodes.first().locator('..').click()
      await page.waitForTimeout(1000)
      await page.screenshot({ path: `${SCREENSHOT_DIR}/08-fur-detail.png`, fullPage: true })
    }

    // Click on AR if visible
    const arNodes = page.locator('span.bg-blue-100:has-text("AR")')
    if (await arNodes.count() > 0) {
      await arNodes.first().locator('..').click()
      await page.waitForTimeout(1000)
      await page.screenshot({ path: `${SCREENSHOT_DIR}/09-ar-detail.png`, fullPage: true })
    }

    // Click on IR to see sub-requirements
    const irNodes = page.locator('span.bg-purple-100:has-text("IR")')
    if (await irNodes.count() > 0) {
      // Find the IR we just created (last one)
      const lastIR = irNodes.last().locator('..')
      await lastIR.click()
      await page.waitForTimeout(1000)
      await page.screenshot({ path: `${SCREENSHOT_DIR}/10-ir-with-children.png`, fullPage: true })
    }
  })
})
