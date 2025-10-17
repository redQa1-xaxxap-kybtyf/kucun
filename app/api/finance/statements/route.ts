import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { paginationConfig } from '@/lib/env';
import { logger } from '@/lib/logger';
import { RateLimitType, withRateLimit } from '@/lib/rate-limit';
// ✅ P1修复: 使用带缓存的财务统计服务
import {
  getStatementsList,
  type StatementQueryParams,
} from '@/lib/services/finance-statistics-cached';
import type { StatementType } from '@/lib/types/statement';

/**
 * GET /api/finance/statements - 获取往来账单列表
 * 支持分页、搜索、筛选等查询参数
 */
const getStatementsHandler = withAuth(
  async (request: NextRequest) => {
    try {
      // 解析查询参数
      const searchParams = new URL(request.url).searchParams;
      const searchValue = searchParams.get('search')?.trim();
      const typeValue = searchParams.get('type')?.trim();
      const queryParams = {
        page: parseInt(searchParams.get('page') || '1', 10),
        limit: parseInt(
          searchParams.get('limit') ||
            paginationConfig.defaultPageSize.toString(),
          10
        ),
        search: searchValue || undefined,
        type: (typeValue as StatementType | 'all' | undefined) || 'all',
        sortBy: (searchParams.get('sortBy') ||
          'totalAmount') as StatementQueryParams['sortBy'],
        sortOrder: (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc',
      };

      // 使用财务统计服务获取数据
      const result = await getStatementsList(queryParams);

      // 返回符合前端期望的数据格式
      return NextResponse.json({
        success: true,
        data: {
          statements: result.data,
          pagination: result.pagination,
          summary: result.summary,
        },
      });
    } catch (error) {
      logger.error('finance-statements', '获取往来账单失败', error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : '获取往来账单失败',
        },
        { status: 500 }
      );
    }
  },
  { permissions: ['finance:view'] }
);

export const GET = withRateLimit(RateLimitType.FINANCE_READ)(getStatementsHandler);
