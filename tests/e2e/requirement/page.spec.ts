import { test, expect } from '@playwright/test'

test.describe('需求管理页面', () => {
  // Login via UI before each test
  test.beforeEach(async ({ page }) => {
    // Go to login page
    await page.goto('http://localhost:3000/login')
    await page.waitForLoadState('networkidle')

    // Wait for login form to be visible
    await page.waitForSelector('input[type="text"]', { timeout: 5000 })

    // Fill login form
    await page.locator('input[type="text"]').fill('admin')
    await page.locator('input[type="password"]').fill('admin123')
    await page.locator('button[type="submit"]').click()

    // Wait for redirect after login
    await page.waitForURL('**/')

    // Now go to requirement page
    await page.goto('http://localhost:3000/requirement')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
  })

  test('页面加载成功', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('需求管理')
  })

  test('新建 IR 按钮可用', async ({ page }) => {
    // Use first() since EmptyState may also render a "新建 IR" button
    const createButton = page.locator('button:has-text("新建 IR")').first()
    await expect(createButton).toBeVisible()
  })

  test('可以打开新建 IR 弹窗', async ({ page }) => {
    // Click header button (first one)
    await page.locator('button:has-text("新建 IR")').first().click()
    await expect(page.locator('textarea')).toBeVisible()
    await expect(page.locator('text=开始分析')).toBeVisible()
  })

  test('关闭弹窗后返回列表', async ({ page }) => {
    await page.locator('button:has-text("新建 IR")').first().click()
    await page.locator('text=取消').click()
    await expect(page.locator('text=选择需求查看详情')).toBeVisible()
  })

  test('需求树面板存在', async ({ page }) => {
    // Use more specific selector to avoid matching EmptyState text
    await expect(page.locator('h2:has-text("需求树")')).toBeVisible()
  })

  test('图例显示正确', async ({ page }) => {
    await expect(page.locator('text=IR - 注入需求')).toBeVisible()
    await expect(page.locator('text=FuR - 功能需求')).toBeVisible()
    await expect(page.locator('text=AR - 分配需求')).toBeVisible()
  })
})