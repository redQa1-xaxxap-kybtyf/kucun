// @ts-ignore - Playwright types not configured
import { expect, test } from '@playwright/test';

test.describe('供应商管理功能', () => {
  test.beforeEach(async ({ page }: any) => {
    // 导航到供应商管理页面
    await page.goto('/suppliers');
  });

  test('应该显示供应商管理页面', async ({ page }: any) => {
    // 检查页面标题
    await expect(page.locator('h1')).toContainText('供应商管理');

    // 检查新建供应商按钮
    await expect(page.locator('text=新建供应商')).toBeVisible();

    // 检查搜索框
    await expect(
      page.locator('input[placeholder*="搜索供应商"]')
    ).toBeVisible();

    // 检查状态筛选器
    await expect(page.locator('text=全部状态')).toBeVisible();
  });

  test('应该能够创建新供应商', async ({ page }: any) => {
    // 点击新建供应商按钮
    await page.click('text=新建供应商');

    // 验证导航到创建页面
    await expect(page).toHaveURL('/suppliers/create');
    await expect(page.locator('h1')).toContainText('新建供应商');

    // 填写供应商信息
    await page.fill('input[placeholder="请输入供应商名称"]', '测试供应商');
    await page.fill('input[placeholder="请输入联系电话"]', '13800138000');
    await page.fill(
      'textarea[placeholder="请输入供应商地址"]',
      '测试地址123号'
    );

    // 提交表单
    await page.click('button:has-text("创建供应商")');

    // 验证成功创建并返回列表页
    await expect(page).toHaveURL('/suppliers');

    // 验证供应商出现在列表中
    await expect(page.locator('text=测试供应商')).toBeVisible();
  });

  test('应该能够搜索供应商', async ({ page }: any) => {
    // 先创建一个供应商用于搜索
    await page.click('text=新建供应商');
    await page.fill('input[placeholder="请输入供应商名称"]', '搜索测试供应商');
    await page.fill('input[placeholder="请输入联系电话"]', '13900139000');
    await page.click('button:has-text("创建供应商")');

    // 等待返回列表页
    await expect(page).toHaveURL('/suppliers');

    // 搜索供应商
    await page.fill('input[placeholder*="搜索供应商"]', '搜索测试');

    // 验证搜索结果
    await expect(page.locator('text=搜索测试供应商')).toBeVisible();
  });

  test('应该能够编辑供应商', async ({ page }: any) => {
    // 先创建一个供应商
    await page.click('text=新建供应商');
    await page.fill('input[placeholder="请输入供应商名称"]', '编辑测试供应商');
    await page.fill('input[placeholder="请输入联系电话"]', '13700137000');
    await page.click('button:has-text("创建供应商")');

    // 等待返回列表页
    await expect(page).toHaveURL('/suppliers');

    // 点击编辑按钮（通过操作菜单）
    await page.locator('button:has(svg)').first().click();
    await page.click('text=编辑');

    // 验证导航到编辑页面
    await expect(page.locator('h1')).toContainText('编辑供应商');

    // 修改供应商信息
    await page.fill('input[placeholder="请输入供应商名称"]', '编辑后的供应商');
    await page.fill('input[placeholder="请输入联系电话"]', '13600136000');

    // 提交更新
    await page.click('button:has-text("更新供应商")');

    // 验证更新成功并返回列表页
    await expect(page).toHaveURL('/suppliers');
    await expect(page.locator('text=编辑后的供应商')).toBeVisible();
  });

  test('应该能够删除供应商', async ({ page }: any) => {
    // 先创建一个供应商
    await page.click('text=新建供应商');
    await page.fill('input[placeholder="请输入供应商名称"]', '删除测试供应商');
    await page.fill('input[placeholder="请输入联系电话"]', '13500135000');
    await page.click('button:has-text("创建供应商")');

    // 等待返回列表页
    await expect(page).toHaveURL('/suppliers');

    // 点击删除按钮（通过操作菜单）
    await page.locator('button:has(svg)').first().click();
    await page.click('text=删除');

    // 确认删除
    await page.click('button:has-text("确认删除")');

    // 验证供应商已被删除
    await expect(page.locator('text=删除测试供应商')).not.toBeVisible();
  });

  test('应该能够筛选供应商状态', async ({ page }: any) => {
    // 先创建一个供应商
    await page.click('text=新建供应商');
    await page.fill('input[placeholder="请输入供应商名称"]', '状态测试供应商');
    await page.click('button:has-text("创建供应商")');

    // 等待返回列表页
    await expect(page).toHaveURL('/suppliers');

    // 测试状态筛选
    await page.click('text=全部状态');
    await page.click('text=活跃');

    // 验证只显示活跃状态的供应商
    await expect(page.locator('text=状态测试供应商')).toBeVisible();

    // 切换到停用状态筛选
    await page.click('text=活跃');
    await page.click('text=停用');

    // 验证没有停用的供应商（因为新创建的都是活跃状态）
    await expect(page.locator('text=暂无供应商数据')).toBeVisible();
  });

  test('应该验证表单输入', async ({ page }: any) => {
    // 导航到创建页面
    await page.click('text=新建供应商');

    // 尝试提交空表单
    await page.click('button:has-text("创建供应商")');

    // 验证显示验证错误
    await expect(page.locator('text=供应商名称不能为空')).toBeVisible();

    // 输入过长的名称
    const longName = 'a'.repeat(101);
    await page.fill('input[placeholder="请输入供应商名称"]', longName);
    await page.click('button:has-text("创建供应商")');

    // 验证长度验证错误
    await expect(
      page.locator('text=供应商名称不能超过100个字符')
    ).toBeVisible();
  });

  test('应该支持批量操作', async ({ page }: any) => {
    // 先创建两个供应商
    await page.click('text=新建供应商');
    await page.fill('input[placeholder="请输入供应商名称"]', '批量测试供应商1');
    await page.click('button:has-text("创建供应商")');

    await page.click('text=新建供应商');
    await page.fill('input[placeholder="请输入供应商名称"]', '批量测试供应商2');
    await page.click('button:has-text("创建供应商")');

    // 等待返回列表页
    await expect(page).toHaveURL('/suppliers');

    // 选择多个供应商
    await page.locator('input[type="checkbox"]').first().check(); // 全选checkbox

    // 验证批量操作按钮出现
    await expect(page.locator('text=批量启用')).toBeVisible();
    await expect(page.locator('text=批量停用')).toBeVisible();
    await expect(page.locator('text=批量删除')).toBeVisible();

    // 测试批量删除
    await page.click('text=批量删除');
    await page.click('button:has-text("确认删除")');

    // 验证供应商被删除
    await expect(page.locator('text=批量测试供应商1')).not.toBeVisible();
    await expect(page.locator('text=批量测试供应商2')).not.toBeVisible();
  });
});
