import { prisma } from '@/lib/db';
import { roundToTwoDecimals } from '@/lib/services/factory-shipment-expense-service';
import { toNumber, toNumberOrNull } from '@/lib/utils/number';

import {
  applyReportVisibility,
  type ReportVisibility,
} from './report-helpers';

export interface ReportAdjustments {
  returnAmountTotal: number;
  returnCostReversalTotal: number;
  compensationRefundTotal: number;
}

async function getReturnAdjustments(
  startDate: Date,
  endDate: Date,
  visibility: ReportVisibility
): Promise<Pick<ReportAdjustments, 'returnAmountTotal' | 'returnCostReversalTotal'>> {
  const returnOrderItemModel = (prisma as any)?.returnOrderItem;
  if (
    !returnOrderItemModel ||
    typeof returnOrderItemModel.findMany !== 'function'
  ) {
    return { returnAmountTotal: 0, returnCostReversalTotal: 0 };
  }

  const returnOrderWhere = applyReportVisibility(
    {
      status: 'completed',
      completedAt: {
        gte: startDate,
        lte: endDate,
      },
    } as any,
    visibility
  );

  const items = await returnOrderItemModel.findMany({
    where: {
      returnOrder: returnOrderWhere,
    },
    select: {
      subtotal: true,
      returnQuantity: true,
      damagedQuantity: true,
      salesOrderItem: {
        select: {
          unitCost: true,
          quantity: true,
          costSubtotal: true,
        },
      },
    },
  });

  let returnAmountTotal = 0;
  let returnCostReversalTotal = 0;

  for (const item of items) {
    returnAmountTotal += toNumber(item.subtotal);

    const returnQty = Number(item.returnQuantity ?? 0);
    const damagedQty = Number(item.damagedQuantity ?? 0);
    const reversibleQty = Math.max(0, returnQty - damagedQty);

    const explicitUnitCost = toNumberOrNull(item.salesOrderItem?.unitCost);
    const costSubtotal = toNumber(item.salesOrderItem?.costSubtotal);
    const originalQty = Number(item.salesOrderItem?.quantity ?? 0);
    const derivedUnitCost = originalQty > 0 ? costSubtotal / originalQty : 0;
    const unitCost = explicitUnitCost ?? derivedUnitCost;

    returnCostReversalTotal += reversibleQty * unitCost;
  }

  return {
    returnAmountTotal: roundToTwoDecimals(returnAmountTotal),
    returnCostReversalTotal: roundToTwoDecimals(returnCostReversalTotal),
  };
}

async function getCompensationRefundTotal(
  startDate: Date,
  endDate: Date,
  visibility: ReportVisibility
): Promise<number> {
  const refundModel = (prisma as any)?.refundRecord;
  if (!refundModel || typeof refundModel.aggregate !== 'function') {
    return 0;
  }

  const baseWhere = applyReportVisibility(
    {
      status: 'completed',
      refundDate: {
        gte: startDate,
        lte: endDate,
      },
      returnOrderId: null,
    } as any,
    visibility
  );

  const [processedAgg, fallbackAgg] = await Promise.all([
    refundModel.aggregate({
      where: {
        ...baseWhere,
        processedAmount: { gt: 0 },
      },
      _sum: {
        processedAmount: true,
      },
    }),
    refundModel.aggregate({
      where: {
        ...baseWhere,
        processedAmount: 0,
      },
      _sum: {
        refundAmount: true,
      },
    }),
  ]);

  return roundToTwoDecimals(
    toNumber(processedAgg._sum.processedAmount) +
      toNumber(fallbackAgg._sum.refundAmount)
  );
}

export async function getReportAdjustments(
  startDate: Date,
  endDate: Date,
  visibility: ReportVisibility
): Promise<ReportAdjustments> {
  const [returnAdjustments, compensationRefundTotal] = await Promise.all([
    getReturnAdjustments(startDate, endDate, visibility),
    getCompensationRefundTotal(startDate, endDate, visibility),
  ]);

  return {
    ...returnAdjustments,
    compensationRefundTotal,
  };
}
