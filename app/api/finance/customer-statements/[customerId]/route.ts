// 客户对账单详情API路由
// GET /api/finance/customer-statements/[customerId] - 获取指定客户对账单详情

import { NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { getCustomerStatementDetail } from '@/lib/services/customer-statement-service';
import { customerStatementDetailQuerySchema } from '@/lib/validations/customer-statement';

/**
 * GET /api/finance/customer-statements/[customerId] - 获取指定客户对账单详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  let customerId: string | undefined;
  try {
    const resolvedParams = await params;
    customerId = resolvedParams.customerId;

    // 解析查询参数
    const searchParams = new URL(request.url).searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json(
        {
          success: false,
          error: '开始日期和结束日期不能为空',
        },
        { status: 400 }
      );
    }

    // 验证参数
    const validationResult = customerStatementDetailQuerySchema.safeParse({
      customerId,
      startDate,
      endDate,
    });

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
    const result = await getCustomerStatementDetail(
      customerId,
      startDate,
      endDate
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('finance-customer-statements', '获取客户对账单详情失败', error, {
      customerId,
    });

    if (error instanceof Error && error.message === '客户不存在') {
      return NextResponse.json(
        {
          success: false,
          error: '客户不存在',
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : '获取客户对账单详情失败',
      },
      { status: 500 }
    );
  }
}

