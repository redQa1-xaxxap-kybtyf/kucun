import type { NextRequest } from 'next/server';

import { withErrorHandling, resolveParams } from '@/lib/api/middleware';
import { successResponse } from '@/lib/api/response';
import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { RateLimitType, withRateLimit } from '@/lib/rate-limit';

/**
 * 获取客户预收款可用余额
 * GET /api/customers/[id]/prepayment-balance
 */
const getPrepaymentBalanceHandler = withErrorHandling(
  withAuth(
    async (_request: NextRequest, context) => {
      const { id: customerId } = await resolveParams(context?.params);

      // 查询客户所有预收款记录
      const prepayments = await prisma.paymentRecord.findMany({
        where: {
          customerId,
          paymentType: 'prepayment',
          status: {
            in: ['confirmed', 'applied'], // 已确认和部分已冲抵的预收款
          },
        },
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
      });

      // 计算可用余额
      const availableBalance = prepayments.reduce((sum, record) => {
        const available =
          Number(record.paymentAmount) - Number(record.appliedAmount);
        return sum + (available > 0 ? available : 0);
      }, 0);

      // 统计信息
      const stats = {
        totalPrepayments: prepayments.length,
        totalAmount: prepayments.reduce(
          (sum, r) => sum + Number(r.paymentAmount),
          0
        ),
        appliedAmount: prepayments.reduce(
          (sum, r) => sum + Number(r.appliedAmount),
          0
        ),
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
