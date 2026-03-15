// 费用记录审核 API 路由
// 路径: POST /api/finance/expenses/[id]/approve

import { type NextRequest } from 'next/server';

import { resolveParams } from '@/lib/api/middleware';
import {
  errorResponse,
  successResponse,
  withAuth,
} from '@/lib/auth/api-helpers';
import { invalidateReportCache } from '@/lib/cache/finance-cache';
import { approveExpenseRecord } from '@/lib/services/expense-service';
import { expenseIdSchema } from '@/lib/validations/expense';

type ExpenseApproveParams = { id: string };

/**
 * POST /api/finance/expenses/[id]/approve - 审核费用记录
 * 权限：需要 finance:manage 权限
 */
export const POST = withAuth(
  async (request: NextRequest, context) => {
    const { id } = await resolveParams<ExpenseApproveParams>(
      context.params as
        | Promise<ExpenseApproveParams>
        | ExpenseApproveParams
        | undefined
    );

    const validationResult = expenseIdSchema.safeParse({ id });

    if (!validationResult.success) {
      return errorResponse(
        `参数验证失败: ${validationResult.error.issues[0]?.message}`,
        400
      );
    }

    const expense = await approveExpenseRecord(id, context.user.id);

    await invalidateReportCache();

    return successResponse(expense);
  },
  { permissions: ['finance:manage'] }
);
