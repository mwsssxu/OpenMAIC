import { test, expect } from '@playwright/test';

test.describe('认证流程', () => {
  test('用户注册流程', async ({ page }) => {
    await page.goto('/register');

    // 填写注册表单
    await page.fill('#email', `test_${Date.now()}@example.com`);
    await page.fill('#password', 'password123');
    await page.fill('#nickname', '测试用户');

    // 提交表单
    await page.click('button[type="submit"]');

    // 等待跳转到首页
    await expect(page).toHaveURL('/', { timeout: 10000 });

    // 验证登录状态
    await expect(page.locator('text=OpenMAIC Business')).toBeVisible();
  });

  test('用户登录流程', async ({ page }) => {
    // 先注册一个用户
    const email = `login_test_${Date.now()}@example.com`;
    await page.goto('/register');
    await page.fill('#email', email);
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/', { timeout: 10000 });

    // 退出登录
    await page.context().clearCookies();
    await page.goto('/login');

    // 登录
    await page.fill('#email', email);
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');

    // 等待跳转到首页
    await expect(page).toHaveURL('/', { timeout: 10000 });
  });

  test('登录失败显示错误信息', async ({ page }) => {
    await page.goto('/login');

    // 使用错误的密码
    await page.fill('#email', 'nonexistent@example.com');
    await page.fill('#password', 'wrongpassword');
    await page.click('button[type="submit"]');

    // 等待错误信息出现（检查错误提示框）
    await expect(page.locator('[class*="red"]')).toBeVisible({ timeout: 5000 });
  });

  test('未登录用户跳转到登录页', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');

    // 应该重定向到登录页
    await expect(page).toHaveURL('/login', { timeout: 5000 });
  });

  test('密码长度验证', async ({ page }) => {
    await page.goto('/register');

    await page.fill('#email', 'short_pw@example.com');
    await page.fill('#password', '12345'); // 只有5个字符
    await page.click('button[type="submit"]');

    // 等待错误信息
    await expect(page.locator('text=密码至少需要6个字符')).toBeVisible({ timeout: 5000 });
  });
});