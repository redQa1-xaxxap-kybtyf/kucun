import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { inventoryConfig } from '@/lib/env';
import { logger } from '@/lib/logger';

/**
 * 仪表盘库存预警 API
 * 重构：调用统一的库存预警 API，避免重复代码
 */
export const GET = withAuth(async request => {
  try {
    // 调用统一的库存预警 API
    const baseUrl =
      process.env.NEXTAUTH_URL ||
      `http://localhost:${process.env.PORT || 3000}`;
    const inventoryAlertsUrl = new URL('/api/inventory/alerts', baseUrl);

    // 设置查询参数：限制数量为仪表盘配置的预警数量
    inventoryAlertsUrl.searchParams.set(
      'limit',
      inventoryConfig.alertLimit.toString()
    );

    // 调用库存预警 API
    const response = await fetch(inventoryAlertsUrl.toString(), {
      headers: {
        // 转发认证信息
        cookie: request.headers.get('cookie') || '',
      },
    });

    if (!response.ok) {
      throw new Error(`库存预警 API 调用失败: ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || '获取库存预警失败');
    }

    // 转换数据格式以适配仪表盘组件
    const dashboardAlerts = result.data.map(
      (alert: {
        id: string;
        productId: string;
        productName: string;
        productCode: string;
        currentStock: number;
        availableStock: number;
        threshold: number;
        severity: 'critical' | 'warning' | 'info';
        type: string;
        createdAt: string;
      }) => {
        // 计算预计缺货天数
        const averageDailySales = inventoryConfig.averageDailySales;
        const daysUntilStockout =
          alert.availableStock > 0
            ? Math.floor(alert.availableStock / averageDailySales)
            : 0;

        // 转换预警级别
        let alertLevel: 'warning' | 'danger' | 'critical';
        if (alert.severity === 'critical') {
          alertLevel = 'critical';
        } else if (
          alert.availableStock <= inventoryConfig.criticalMinQuantity
        ) {
          alertLevel = 'danger';
        } else {
          alertLevel = 'warning';
        }

        // 生成建议操作
        let suggestedAction: string;
        if (alert.availableStock === 0) {
          suggestedAction = '立即补货';
        } else if (
          alert.availableStock <= inventoryConfig.criticalMinQuantity
        ) {
          suggestedAction = '紧急补货';
        } else {
          suggestedAction = '计划补货';
        }

        return {
          id: alert.id,
          productId: alert.productId,
          productName: alert.productName,
          productCode: alert.productCode,
          currentStock: alert.currentStock,
          safetyStock: alert.threshold,
          alertLevel,
          alertType: alert.type,
          lastUpdated: alert.createdAt,
          daysUntilStockout:
            daysUntilStockout > 0 ? daysUntilStockout : undefined,
          suggestedAction,
        };
      }
    );

    return NextResponse.json({
      success: true,
      data: dashboardAlerts,
    });
  } catch (error) {
    logger.error('dashboard', '获取库存预警失败', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取库存预警失败',
      },
      { status: 500 }
    );
  }
});
