// 客户对账单API路由
// GET /api/finance/customer-statements - 获取客户对账单列表

import { NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { getCustomerStatements } from '@/lib/services/customer-statement-service';
import { customerStatementQuerySchema } from '@/lib/validations/customer-statement';

/**
 * GET /api/finance/customer-statements - 获取客户对账单列表
 */
export async function GET(request: NextRequest) {
  try {
    // 解析查询参数
    const searchParams = new URL(request.url).searchParams;

    const queryParams = {
      page: searchParams.get('page')
        ? parseInt(searchParams.get('page')!, 10)
        : 1,
      pageSize: searchParams.get('pageSize')
        ? parseInt(searchParams.get('pageSize')!, 10)
        : 20,
      customerId: searchParams.get('customerId') || undefined,
      customerName: searchParams.get('customerName') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      minBalance: searchParams.get('minBalance')
        ? parseFloat(searchParams.get('minBalance')!)
        : undefined,
      maxBalance: searchParams.get('maxBalance')
        ? parseFloat(searchParams.get('maxBalance')!)
        : undefined,
      balanceType: searchParams.get('balanceType') || 'all',
      sortBy: searchParams.get('sortBy') || 'customerName',
      sortOrder: searchParams.get('sortOrder') || 'desc',
    };

    // 验证参数
    const validationResult =
      customerStatementQuerySchema.safeParse(queryParams);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: `参数验证失败: ${validationResult.error.issues[0]?.message}`,
        },
        { status: 400 }
      );
    }

    // 调用服务层获取数据
    const result = await getCustomerStatements(validationResult.data);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('finance-customer-statements', '获取客户对账单列表失败', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : '获取客户对账单列表失败',
      },
      { status: 500 }
    );
  }
}

