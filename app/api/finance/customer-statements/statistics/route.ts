// 客户对账单统计数据API路由
// GET /api/finance/customer-statements/statistics - 获取总体统计信息

import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { getCustomerStatementStatistics } from '@/lib/services/customer-statement-service';

/**
 * GET /api/finance/customer-statements/statistics - 获取客户对账单统计数据
 */
export async function GET() {
  try {
    const statistics = await getCustomerStatementStatistics();

    return NextResponse.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    logger.error(
      'finance-customer-statements',
      '获取客户对账单统计数据失败',
      error
    );
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : '获取客户对账单统计数据失败',
      },
      { status: 500 }
    );
  }
}
