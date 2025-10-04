import { NextResponse, type NextRequest } from 'next/server';

import { errorResponse, verifyApiAuth } from '@/lib/api-helpers';
import { paginationConfig } from '@/lib/env';
import { getStatementsList } from '@/lib/services/finance-statistics';

/**
 * GET /api/statements - 获取往来账单列表
 * 支持分页、搜索、筛选等查询参数
 */
export async function GET(request: NextRequest) {
  try {
    // 身份验证
    const auth = verifyApiAuth(request);
    if (!auth.success) {
      return errorResponse(auth.error || '未授权访问', 401);
    }

    // 解析查询参数
    const searchParams = new URL(request.url).searchParams;
    const queryParams = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(
        searchParams.get('limit') || paginationConfig.defaultPageSize.toString()
      ),
      search: searchParams.get('search') || '',
      type: searchParams.get('type') as 'customer' | 'supplier' | undefined,
      sortBy: searchParams.get('sortBy') || 'totalAmount',
      sortOrder: (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc',
    };

    // 使用财务统计服务获取数据
    const result = await getStatementsList(queryParams);

    return NextResponse.json({
      success: true,
      data: {
        statements: result.data,
        pagination: result.pagination,
        summary: result.summary,
      },
    });
  } catch (error) {
    console.error('获取往来账单失败:', error);
    return NextResponse.json(
      { success: false, error: '获取往来账单失败' },
      { status: 500 }
    );
  }
}
