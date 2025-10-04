import { type NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { getReturnableItems } from '@/lib/services/sales-order-service';
import { logger } from '@/lib/utils/console-logger';

/**
 * GET /api/sales-orders/[id]/returnable-items
 * 获取销售订单的可退货明细
 */
export const GET = withAuth(
  async (request: NextRequest, { params }) => {
    const { id } = await (params as Promise<{ id: string }>);

    // 获取可退货明细(使用服务层函数)
    const response = await getReturnableItems(id);

    return NextResponse.json({
      success: true,
      data: response,
    });
  },
  { permissions: ['orders:view'] }
);
