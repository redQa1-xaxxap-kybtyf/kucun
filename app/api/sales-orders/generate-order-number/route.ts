import { type NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { generateSalesOrderNumber } from '@/lib/services/simple-order-number-generator';
import { logger } from '@/lib/utils/console-logger';

/**
 * 生成销售订单号API
 * 使用新的安全订单号生成服务，保证并发安全
 */

// 生成订单号API
export const GET = withAuth(
  async (request: NextRequest) => {
    // 使用新的安全订单号生成服务
    const orderNumber = await generateSalesOrderNumber();

    return NextResponse.json({
      success: true,
      data: {
        orderNumber,
        generatedAt: new Date().toISOString(),
      },
    });
  },
  { permissions: ['orders:create'] }
);
