import { test, expect } from '@playwright/test'

test.describe('登录页面', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies to ensure logged out state
    await page.context().clearCookies()
    await page.goto('http://localhost:3000/login')
    await page.waitForSelector('input[type="text"]', { timeout: 5000 })
  })

  test('页面正确渲染', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('TeamBuddy')
    await expect(page.locator('h2')).toContainText('登录')
    await expect(page.locator('input[type="text"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toHaveText('登录')
  })

  test('正确的用户名密码可以登录成功', async ({ page }) => {
    await page.locator('input[type="text"]').fill('admin')
    await page.locator('input[type="password"]').fill('admin123')

    const submitBtn = page.locator('button[type="submit"]')
    await submitBtn.click()

    // Button should show "登录中..." and stay that way until redirect
    await expect(submitBtn).toHaveText('登录中...')

    // Should redirect to home page
    await page.waitForURL('**/', { timeout: 10000 })
  })

  test('zhuguofu 用户可以登录', async ({ page }) => {
    await page.locator('input[type="text"]').fill('zhuguofu')
    await page.locator('input[type="password"]').fill('12345')

    const submitBtn = page.locator('button[type="submit"]')
    await submitBtn.click()

    // Button should show "登录中..." and NOT flash back to "登录"
    await expect(submitBtn).toHaveText('登录中...')

    // Should redirect to home page
    await page.waitForURL('**/', { timeout: 10000 })
  })

  test('错误密码显示错误提示', async ({ page }) => {
    await page.locator('input[type="text"]').fill('admin')
    await page.locator('input[type="password"]').fill('wrongpassword')

    const submitBtn = page.locator('button[type="submit"]')
    await submitBtn.click()

    // Should show error message
    await expect(page.locator('text=用户名或密码错误')).toBeVisible({ timeout: 10000 })

    // Button should return to "登录" (not stuck at "登录中...")
    await expect(submitBtn).toHaveText('登录')
  })

  test('登录中按钮不会闪回登录', async ({ page }) => {
    await page.locator('input[type="text"]').fill('admin')
    await page.locator('input[type="password"]').fill('admin123')

    const submitBtn = page.locator('button[type="submit"]')
    await submitBtn.click()

    // The button text should never show "登录" between click and redirect
    // It should go: "登录" -> click -> "登录中..." -> redirect
    await expect(submitBtn).toHaveText('登录中...')

    // Verify it doesn't flicker back to "登录" before navigation
    // Poll for 2 seconds - button should stay "登录中..." or page should navigate
    const startTime = Date.now()
    while (Date.now() - startTime < 2000) {
      const currentUrl = page.url()
      if (!currentUrl.includes('/login')) break // navigated away, success

      const text = await submitBtn.textContent().catch(() => null)
      if (text !== null) {
        expect(text).toBe('登录中...')
      }
      await page.waitForTimeout(100)
    }
  })
})
