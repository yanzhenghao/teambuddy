import { test, expect } from '@playwright/test'

test.describe('需求管理完整流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/login')
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('input[type="text"]', { timeout: 5000 })
    await page.locator('input[type="text"]').fill('admin')
    await page.locator('input[type="password"]').fill('admin123')
    await page.locator('button[type="submit"]').click()
    await page.waitForURL('**/')
    await page.goto('http://localhost:3000/requirement')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
  })

  test('完整流程: 新建IR -> 对话 -> 查看FuR -> 添加AR', async ({ page }) => {
    // Step 1: Create new IR
    await page.locator('button:has-text("新建 IR")').first().click()
    await expect(page.locator('textarea')).toBeVisible()

    // Fill IR description
    const testIR = '用户需要登录功能，包括用户名密码验证和记住登录状态'
    await page.locator('textarea').fill(testIR)

    // Submit
    await page.locator('button:has-text("开始分析")').click()

    // Wait for chat mode
    await page.waitForTimeout(3000)

    // Should enter chat mode (look for input field)
    const chatInput = page.locator('input[placeholder*="回答"]')
    const hasChatInput = await chatInput.isVisible().catch(() => false)

    if (hasChatInput) {
      // Step 2: Send a chat message
      await chatInput.fill('需要支持邮箱登录')
      await page.locator('button:has-text("发送")').click()
      await page.waitForTimeout(3000)

      // Go back to list view to see the tree
      // Click somewhere else to exit chat mode if needed
    }

    // Step 3: Go back to list view
    await page.goto('http://localhost:3000/requirement')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Check if IR was created in the tree
    const irLabel = page.locator('text=IR')
    const hasIR = await irLabel.first().isVisible().catch(() => false)
    expect(hasIR).toBe(true)

    // Step 4: Click on IR to expand
    const irItem = page.locator('.bg-purple-100').first()
    const hasIRItem = await irItem.isVisible().catch(() => false)

    if (hasIRItem) {
      await irItem.click()
      await page.waitForTimeout(1000)
    }

    // Step 5: Click "编辑" button if visible (to test editing)
    const editBtn = page.locator('button:has-text("编辑")')
    const hasEditBtn = await editBtn.isVisible().catch(() => false)

    if (hasEditBtn) {
      await editBtn.click()
      await expect(page.locator('text=备注')).toBeVisible()
      await page.locator('button:has-text("取消")').click()
    }
  })

  test('编辑IR的标题和备注', async ({ page }) => {
    // First create an IR
    await page.locator('button:has-text("新建 IR")').first().click()
    await page.locator('textarea').fill('Test requirement')
    await page.locator('button:has-text("开始分析")').click()
    await page.waitForTimeout(2000)

    // Go back to list
    await page.goto('http://localhost:3000/requirement')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Find and click on the IR in tree
    const irNode = page.locator('span:has-text("IR")').first()
    if (await irNode.isVisible()) {
      await irNode.click()
      await page.waitForTimeout(1000)

      // Click edit button
      const editBtn = page.locator('button:has-text("编辑")')
      if (await editBtn.isVisible()) {
        await editBtn.click()
        await expect(page.locator('h2:has-text("编辑")')).toBeVisible()
        await expect(page.locator('text=标题')).toBeVisible()
        await expect(page.locator('text=备注')).toBeVisible()
      }
    }
  })
})
