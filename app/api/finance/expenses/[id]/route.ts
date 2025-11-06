// 费用记录详情 API 路由
// 遵循 Next.js 15.4 App Router 架构和全局约定规范

import { type NextRequest } from 'next/server';

import { resolveParams } from '@/lib/api/middleware';
import {
  errorResponse,
  successResponse,
  withAuth,
} from '@/lib/auth/api-helpers';
import { invalidateReportCache } from '@/lib/cache/finance-cache';
import {
  deleteExpenseRecord,
  getExpenseRecordById,
  updateExpenseRecord,
} from '@/lib/services/expense-service';
import {
  expenseIdSchema,
  updateExpenseSchema,
} from '@/lib/validations/expense';

type ExpenseParams = { id: string };

/**
 * GET /api/finance/expenses/[id] - 获取费用记录详情
 * 权限：需要 finance:view 权限
 */
export const GET = withAuth(
  async (_request: NextRequest, context) => {
    // 解析路径参数
    const { id } = await resolveParams<ExpenseParams>(
      context.params as Promise<ExpenseParams> | ExpenseParams | undefined
    );

    // 验证路径参数
    const validationResult = expenseIdSchema.safeParse({ id });

    if (!validationResult.success) {
      return errorResponse(
        `参数验证失败: ${validationResult.error.issues[0]?.message}`,
        400
      );
    }

    // 查询费用记录详情
    const expense = await getExpenseRecordById(id);

    if (!expense) {
      return errorResponse('费用记录不存在', 404);
    }

    return successResponse(expense);
  },
  { permissions: ['finance:view'] }
);

/**
 * PUT /api/finance/expenses/[id] - 更新费用记录
 * 权限：需要 finance:manage 权限
 */
export const PUT = withAuth(
  async (request: NextRequest, context) => {
    // 解析路径参数
    const { id } = await resolveParams<ExpenseParams>(
      context.params as Promise<ExpenseParams> | ExpenseParams | undefined
    );

    // 验证路径参数
    const idValidationResult = expenseIdSchema.safeParse({ id });

    if (!idValidationResult.success) {
      return errorResponse(
        `参数验证失败: ${idValidationResult.error.issues[0]?.message}`,
        400
      );
    }

    // 验证费用记录是否存在
    const existingExpense = await getExpenseRecordById(id);

    if (!existingExpense) {
      return errorResponse('费用记录不存在', 404);
    }

    // 解析请求体
    const body = await request.json();
    const validationResult = updateExpenseSchema.safeParse(body);

    if (!validationResult.success) {
      return errorResponse(
        `数据验证失败: ${validationResult.error.issues[0]?.message}`,
        400
      );
    }

    const data = validationResult.data;

    // 更新费用记录
    const expense = await updateExpenseRecord(id, data);

    // 失效报表缓存（异步执行，不阻塞响应）
    invalidateReportCache().catch(error => {
      console.error('Failed to invalidate report cache:', error);
    });

    return successResponse(expense);
  },
  { permissions: ['finance:manage'] }
);

/**
 * DELETE /api/finance/expenses/[id] - 删除费用记录
 * 权限：需要 finance:manage 权限
 */
export const DELETE = withAuth(
  async (_request: NextRequest, context) => {
    // 解析路径参数
    const { id } = await resolveParams<ExpenseParams>(
      context.params as Promise<ExpenseParams> | ExpenseParams | undefined
    );

    // 验证路径参数
    const validationResult = expenseIdSchema.safeParse({ id });

    if (!validationResult.success) {
      return errorResponse(
        `参数验证失败: ${validationResult.error.issues[0]?.message}`,
        400
      );
    }

    // 验证费用记录是否存在
    const existingExpense = await getExpenseRecordById(id);

    if (!existingExpense) {
      return errorResponse('费用记录不存在', 404);
    }

    // 删除费用记录
    await deleteExpenseRecord(id);

    // 失效报表缓存（异步执行，不阻塞响应）
    invalidateReportCache().catch(error => {
      console.error('Failed to invalidate report cache:', error);
    });

    return successResponse({ message: '删除成功' });
  },
  { permissions: ['finance:manage'] }
);
