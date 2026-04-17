import { test, expect } from '@playwright/test';

test.describe('课程流程', () => {
  test('课程列表页未登录重定向', async ({ page }) => {
    // 直接访问课程列表，应该重定向到登录页
    await page.goto('/classrooms');

    // 验证重定向到登录页
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});