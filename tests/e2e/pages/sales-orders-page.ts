/**
 * 销售订单页面对象模型 (Page Object Model)
 *
 * 封装销售订单列表页面的所有操作和元素定位
 * 遵循 Page Object Model 设计模式，提高测试代码的可维护性
 */

import { expect, type Page } from '@playwright/test';

export class SalesOrdersPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // ==================== 导航方法 ====================

  /**
   * 导航到销售订单列表页面
   */
  async goto() {
    await this.page.goto('/sales-orders');
    await this.page.waitForLoadState('networkidle');
    // 等待页面标题加载
    await this.page.waitForSelector('h1:has-text("销售订单")', {
      timeout: 10000,
    });
  }

  // ==================== 筛选操作 ====================

  /**
   * 按状态筛选订单
   * @param status - 订单状态：'pending_shipment' | 'shipped' | 'all'
   */
  async filterByStatus(status: 'pending_shipment' | 'shipped' | 'all') {
    // 点击状态筛选下拉框
    const statusFilter = this.page.locator('[data-testid="status-filter"]');
    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      await this.page.waitForTimeout(300);

      // 选择对应的状态选项
      const statusMap = {
        pending_shipment: '待发货',
        shipped: '已发货',
        all: '全部',
      };

      const statusText = statusMap[status];
      await this.page.click(`text="${statusText}"`);
      await this.page.waitForTimeout(500);
    } else {
      // 如果没有筛选器，使用 URL 参数
      const statusParam = status === 'all' ? '' : `?status=${status}`;
      await this.page.goto(`/sales-orders${statusParam}`);
      await this.page.waitForLoadState('networkidle');
    }
  }

  // ==================== 订单操作 ====================

  /**
   * 获取所有待发货订单的订单号
   */
  async getPendingShipmentOrderNumbers(): Promise<string[]> {
    // 等待订单列表加载
    await this.page.waitForTimeout(1000);

    // 查找所有订单行
    const orderRows = this.page.locator('[data-testid="order-row"]');
    const count = await orderRows.count();

    const orderNumbers: string[] = [];
    for (let i = 0; i < count; i++) {
      const row = orderRows.nth(i);
      // 检查是否有"确认发货"按钮（表示是待发货状态）
      const confirmButton = row.locator('button:has-text("确认发货")');
      if (await confirmButton.isVisible()) {
        // 获取订单号
        const orderNumber = await row
          .locator('[data-testid="order-number"]')
          .textContent();
        if (orderNumber) {
          orderNumbers.push(orderNumber.trim());
        }
      }
    }

    return orderNumbers;
  }

  /**
   * 点击指定订单的"确认发货"按钮
   * @param orderNumber - 订单号
   */
  async confirmShipment(orderNumber: string) {
    // 查找包含该订单号的行
    const orderRow = this.page.locator(
      `[data-testid="order-row"]:has-text("${orderNumber}")`
    );

    // 点击"确认发货"按钮
    const confirmButton = orderRow.locator('button:has-text("确认发货")');
    await expect(confirmButton).toBeVisible({
      timeout: 5000,
    });
    await confirmButton.click();

    // 等待确认对话框出现
    await this.page.waitForTimeout(300);

    // 点击对话框中的确认按钮
    const dialogConfirmButton = this.page.locator(
      '[role="dialog"] button:has-text("确认")'
    );
    if (await dialogConfirmButton.isVisible({ timeout: 2000 })) {
      await dialogConfirmButton.click();
    }

    // 等待操作完成
    await this.page.waitForTimeout(1000);
  }

  /**
   * 快速连续点击"确认发货"按钮（用于测试幂等性）
   * @param orderNumber - 订单号
   * @param clickCount - 点击次数
   */
  async rapidClickConfirmShipment(orderNumber: string, clickCount: number) {
    const orderRow = this.page.locator(
      `[data-testid="order-row"]:has-text("${orderNumber}")`
    );
    const confirmButton = orderRow.locator('button:has-text("确认发货")');

    // 快速连续点击
    for (let i = 0; i < clickCount; i++) {
      if (await confirmButton.isVisible({ timeout: 1000 })) {
        await confirmButton.click({ force: true });
        await this.page.waitForTimeout(100); // 很短的间隔
      }
    }

    // 如果有确认对话框，点击确认
    const dialogConfirmButton = this.page.locator(
      '[role="dialog"] button:has-text("确认")'
    );
    if (await dialogConfirmButton.isVisible({ timeout: 2000 })) {
      await dialogConfirmButton.click();
    }

    await this.page.waitForTimeout(1000);
  }

  // ==================== 验证方法 ====================

  /**
   * 验证订单状态
   * @param orderNumber - 订单号
   * @param expectedStatus - 期望的状态文本
   */
  async verifyOrderStatus(orderNumber: string, expectedStatus: string) {
    const orderRow = this.page.locator(
      `[data-testid="order-row"]:has-text("${orderNumber}")`
    );

    // 等待状态更新
    await this.page.waitForTimeout(500);

    // 验证状态标签
    const statusBadge = orderRow.locator('[data-testid="order-status"]');
    await expect(statusBadge).toContainText(expectedStatus, {
      timeout: 5000,
    });
  }

  /**
   * 验证订单是否存在于列表中
   * @param orderNumber - 订单号
   * @param shouldExist - 是否应该存在
   */
  async verifyOrderExists(orderNumber: string, shouldExist: boolean) {
    const orderRow = this.page.locator(
      `[data-testid="order-row"]:has-text("${orderNumber}")`
    );

    if (shouldExist) {
      await expect(orderRow).toBeVisible({ timeout: 5000 });
    } else {
      await expect(orderRow).not.toBeVisible({ timeout: 5000 });
    }
  }

  /**
   * 验证"确认发货"按钮是否存在
   * @param orderNumber - 订单号
   * @param shouldExist - 是否应该存在
   */
  async verifyConfirmShipmentButtonExists(
    orderNumber: string,
    shouldExist: boolean
  ) {
    const orderRow = this.page.locator(
      `[data-testid="order-row"]:has-text("${orderNumber}")`
    );
    const confirmButton = orderRow.locator('button:has-text("确认发货")');

    if (shouldExist) {
      await expect(confirmButton).toBeVisible({ timeout: 5000 });
    } else {
      await expect(confirmButton).not.toBeVisible({ timeout: 5000 });
    }
  }

  /**
   * 获取当前页面的订单数量
   */
  async getOrderCount(): Promise<number> {
    await this.page.waitForTimeout(500);
    const orderRows = this.page.locator('[data-testid="order-row"]');
    return await orderRows.count();
  }

  /**
   * 验证没有错误提示
   */
  async verifyNoErrors() {
    const errorMessages = this.page.locator(
      '.text-destructive, .text-red-500, [role="alert"]:has-text("错误")'
    );
    await expect(errorMessages).toHaveCount(0, { timeout: 2000 });
  }

  /**
   * 刷新页面
   */
  async refresh() {
    await this.page.reload();
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(1000);
  }

  // ==================== 网络监控 ====================

  /**
   * 监听 API 请求
   * @param urlPattern - URL 匹配模式
   */
  async waitForApiRequest(urlPattern: string | RegExp): Promise<void> {
    await this.page.waitForRequest(
      request => {
        const url = request.url();
        if (typeof urlPattern === 'string') {
          return url.includes(urlPattern);
        }
        return urlPattern.test(url);
      },
      { timeout: 10000 }
    );
  }

  /**
   * 监听 API 响应
   * @param urlPattern - URL 匹配模式
   */
  async waitForApiResponse(urlPattern: string | RegExp): Promise<void> {
    await this.page.waitForResponse(
      response => {
        const url = response.url();
        if (typeof urlPattern === 'string') {
          return url.includes(urlPattern);
        }
        return urlPattern.test(url);
      },
      { timeout: 10000 }
    );
  }
}

