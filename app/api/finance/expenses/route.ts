// 费用记录 API 路由
// 遵循 Next.js 15.4 App Router 架构和全局约定规范

import { type NextRequest } from 'next/server';

import { parseOffsetPagination } from '@/lib/api/pagination';
import {
  errorResponse,
  successResponse,
  withAuth,
} from '@/lib/auth/api-helpers';
import { invalidateReportCache } from '@/lib/cache/finance-cache';
import { logger } from '@/lib/logger';
import {
  createExpenseRecord,
  getExpenseRecords,
} from '@/lib/services/expense-service';
import {
  createExpenseSchema,
  expenseFilterSchema,
} from '@/lib/validations/expense';

/**
 * GET /api/finance/expenses - 获取费用记录列表
 * 权限：需要 finance:view 权限
 */
export const GET = withAuth(
  async (request: NextRequest) => {
    // 解析查询参数
    const searchParams = request.nextUrl.searchParams;
    const normalized = new URLSearchParams(searchParams);
    if (!normalized.get('limit') && normalized.get('pageSize')) {
      normalized.set('limit', normalized.get('pageSize') as string);
    }

    let page: number;
    let pageSize: number;
    try {
      const parsed = parseOffsetPagination(normalized, {
        defaultLimit: 20,
        maxLimit: 100,
        strict: true,
        pageFieldLabel: '页码',
        limitFieldLabel: '每页数量',
      });
      page = parsed.page;
      pageSize = parsed.limit;
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : '分页参数格式不正确',
        400
      );
    }

    const queryParams = {
      page,
      pageSize,
      expenseType: searchParams.get('expenseType') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      relatedType: searchParams.get('relatedType') || undefined,
      status: searchParams.get('status') || undefined,
      paymentStatus: searchParams.get('paymentStatus') || undefined,
      supplierId: searchParams.get('supplierId') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: searchParams.get('sortOrder') || undefined,
    };

    // 验证查询参数
    const validationResult = expenseFilterSchema.safeParse(queryParams);

    if (!validationResult.success) {
      return errorResponse(
        `查询参数验证失败: ${validationResult.error.issues[0]?.message}`,
        400
      );
    }

    const parsedQuery = validationResult.data;

    // 过滤掉 null 值
    const cleanQuery = {
      ...parsedQuery,
      startDate: parsedQuery.startDate ?? undefined,
      endDate: parsedQuery.endDate ?? undefined,
    };

    // 查询费用记录列表
    const response = await getExpenseRecords(cleanQuery);

    return successResponse(response);
  },
  { permissions: ['finance:view'] }
);

/**
 * POST /api/finance/expenses - 创建费用记录
 * 权限：需要 finance:manage 权限
 */
export const POST = withAuth(
  async (request: NextRequest, { user }) => {
    // 解析请求体
    const body = await request.json();
    const validationResult = createExpenseSchema.safeParse(body);

    if (!validationResult.success) {
      return errorResponse(
        `数据验证失败: ${validationResult.error.issues[0]?.message}`,
        400
      );
    }

    const data = validationResult.data;

    // 创建费用记录
    const expense = await createExpenseRecord(data, user.id);

    // 失效报表缓存（异步执行，不阻塞响应）
    invalidateReportCache().catch(error => {
      logger.error('cache', '费用记录缓存失效失败', error, {
        expenseId: expense.id,
        operation: 'invalidate_report_cache',
      });
    });

    return successResponse(expense);
  },
  { permissions: ['finance:manage'] }
);
