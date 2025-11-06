// 费用统计 API 路由
// 遵循 Next.js 15.4 App Router 架构和全局约定规范

import { type NextRequest } from 'next/server';

import {
  errorResponse,
  successResponse,
  withAuth,
} from '@/lib/auth/api-helpers';
import { getExpenseStatistics } from '@/lib/services/expense-service';
import { expenseStatisticsFilterSchema } from '@/lib/validations/expense';

/**
 * GET /api/finance/expenses/statistics - 获取费用统计数据
 * 权限：需要 finance:view 权限
 */
export const GET = withAuth(
  async (request: NextRequest) => {
    // 解析查询参数
    const searchParams = new URL(request.url).searchParams;
    const queryParams = {
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      groupBy: searchParams.get('groupBy') || undefined,
      expenseType: searchParams.get('expenseType') || undefined,
    };

    // 验证查询参数
    const validationResult =
      expenseStatisticsFilterSchema.safeParse(queryParams);

    if (!validationResult.success) {
      return errorResponse(
        `查询参数验证失败: ${validationResult.error.issues[0]?.message}`,
        400
      );
    }

    const parsedQuery = validationResult.data;

    // 验证日期范围
    if (new Date(parsedQuery.endDate) < new Date(parsedQuery.startDate)) {
      return errorResponse('结束日期不能早于开始日期', 400);
    }

    // 获取费用统计数据
    const statistics = await getExpenseStatistics(parsedQuery);

    return successResponse(statistics);
  },
  { permissions: ['finance:view'] }
);
