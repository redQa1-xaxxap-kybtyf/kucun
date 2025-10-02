import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { getReturnableItems } from '@/lib/services/sales-order-service';
import { logger } from '@/lib/utils/console-logger';

/**
 * GET /api/sales-orders/[id]/returnable-items
 * 获取销售订单的可退货明细
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // 验证用户权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 获取可退货明细(使用服务层函数)
    const response = await getReturnableItems(id);

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : '获取可退货明细失败';
    logger.error('sales-api', '获取可退货明细失败:', error);
    return NextResponse.json(
      { success: false, error: errorMessage },
      {
        status:
          error instanceof Error && error.message.includes('不存在')
            ? 404
            : 500,
      }
    );
  }
}
