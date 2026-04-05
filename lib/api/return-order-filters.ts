import type { Prisma } from '@prisma/client';

import type { ReturnOrderUiStatus } from '@/lib/types/return-order';

const unresolvedRefundWhere: Prisma.ReturnOrderWhereInput = {
  OR: [
    {
      refunds: {
        none: {},
      },
    },
    {
      refunds: {
        every: {
          status: {
            in: ['rejected', 'cancelled'],
          },
        },
      },
    },
    {
      refunds: {
        some: {
          OR: [
            {
              status: {
                in: ['pending', 'processing'],
              },
            },
            {
              remainingAmount: {
                gt: 0,
              },
            },
          ],
        },
      },
    },
  ],
};

export function buildReturnOrderUiStatusWhere(
  uiStatus: ReturnOrderUiStatus
): Prisma.ReturnOrderWhereInput {
  switch (uiStatus) {
    case 'draft':
      return {
        status: 'draft',
      };

    case 'pending':
      return {
        status: {
          in: ['submitted', 'approved', 'processing'],
        },
      };

    case 'awaiting_refund':
      return {
        status: 'completed',
        processType: 'refund',
        refundAmount: {
          gt: 0,
        },
        AND: [unresolvedRefundWhere],
      };

    case 'completed':
      return {
        status: 'completed',
        OR: [
          {
            processType: 'exchange',
          },
          {
            processType: 'refund',
            refundAmount: {
              lte: 0,
            },
          },
          {
            processType: 'refund',
            refundAmount: {
              gt: 0,
            },
            NOT: unresolvedRefundWhere,
          },
        ],
      };
  }
}
