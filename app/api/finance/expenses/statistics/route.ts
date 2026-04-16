// 费用统计 API 路由
// 遵循 Next.js 15.4 App Router 架构和全局约定规范

import { type NextRequest } from 'next/server';

import {
  errorResponse,
  successResponse,
  withAuth,
} from '@/lib/auth/api-helpers';
import { getExpenseStatistics } from '@/lib/services/expense-service';
// ✅ P0修复: 导入本地时区日期解析函数
import { parseLocalDateString } from '@/lib/utils/datetime';
import { expenseStatisticsFilterSchema } from '@/lib/validations/expense';

/**
 * GET /api/finance/expenses/statistics - 获取费用统计数据
 * 权限：需要 finance:view 权限
 */
export const GET = withAuth(
  async (request: NextRequest) => {
    // 解析查询参数
    const searchParams = request.nextUrl.searchParams;
    const queryParams = {
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      groupBy: searchParams.get('groupBy') || undefined,
      expenseType: searchParams.get('expenseType') || undefined,
      relatedType: searchParams.get('relatedType') || undefined,
    };

    // 验证查询参数
    const validationResult =
      expenseStatisticsFilterSchema.safeParse(queryParams);

    if (!validationResult.success) {
      return errorResponse(
        `查询条件有误： ${validationResult.error.issues[0]?.message}`,
        400
      );
    }

    const parsedQuery = validationResult.data;

    // ✅ P0修复: 使用本地时区解析日期进行验证
    // 验证日期范围
    const startDateObj =
      parseLocalDateString(parsedQuery.startDate) ??
      new Date(parsedQuery.startDate);
    const endDateObj =
      parseLocalDateString(parsedQuery.endDate) ??
      new Date(parsedQuery.endDate);

    if (endDateObj < startDateObj) {
      return errorResponse('结束日期不能早于开始日期', 400);
    }

    // 获取费用统计数据
    const statistics = await getExpenseStatistics(parsedQuery);

    return successResponse(statistics);
  },
  { permissions: ['finance:view'] }
);

