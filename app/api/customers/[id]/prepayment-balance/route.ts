import type { NextRequest } from 'next/server';

import { withErrorHandling, resolveParams } from '@/lib/api/middleware';
import { successResponse } from '@/lib/api/response';
import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { RateLimitType, withRateLimit } from '@/lib/rate-limit';

const MAX_PREPAYMENT_RECORDS = 5000;

/**
 * 获取客户预收款可用余额
 * GET /api/customers/[id]/prepayment-balance
 */
const getPrepaymentBalanceHandler = withErrorHandling(
  withAuth(
    async (_request: NextRequest, context) => {
      const { id: customerId } = await resolveParams(context?.params);

      const prepaymentWhere = {
        customerId,
        paymentType: 'prepayment',
        status: {
          in: ['confirmed', 'applied'], // 已确认和部分已冲抵的预收款
        },
      };

      const [prepaymentStats, prepayments] = await Promise.all([
        prisma.paymentRecord.aggregate({
          where: prepaymentWhere,
          _count: { id: true },
          _sum: {
            paymentAmount: true,
            appliedAmount: true,
          },
        }),
        // 查询客户预收款记录（用于展示明细）
        prisma.paymentRecord.findMany({
          where: prepaymentWhere,
          select: {
            id: true,
            paymentAmount: true,
            appliedAmount: true,
            paymentDate: true,
            status: true,
          },
          orderBy: {
            paymentDate: 'asc', // FIFO顺序
          },
          take: MAX_PREPAYMENT_RECORDS,
        }),
      ]);

      // 计算可用余额
      const totalAmount = Number(prepaymentStats._sum.paymentAmount ?? 0);
      const appliedAmount = Number(prepaymentStats._sum.appliedAmount ?? 0);
      const availableBalance = Math.max(0, totalAmount - appliedAmount);

      // 统计信息
      const stats = {
        totalPrepayments: prepaymentStats._count.id,
        totalAmount,
        appliedAmount,
        availableBalance,
      };

      // 可用预收款明细
      const availablePrepayments = prepayments
        .filter(r => Number(r.paymentAmount) - Number(r.appliedAmount) > 0)
        .map(r => ({
          id: r.id,
          paymentDate: r.paymentDate.toISOString(),
          totalAmount: Number(r.paymentAmount),
          appliedAmount: Number(r.appliedAmount),
          availableAmount: Number(r.paymentAmount) - Number(r.appliedAmount),
          status: r.status,
        }));

      return successResponse({
        ...stats,
        prepayments: availablePrepayments,
      });
    },
    { permissions: ['finance:view'] }
  )
);

export const GET = withRateLimit(RateLimitType.READ)(
  getPrepaymentBalanceHandler
);
