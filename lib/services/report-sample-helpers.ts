import { prisma } from '@/lib/db';
import type {
  AnnualSampleMetrics,
  SampleCustomerMetrics,
  SampleMetrics,
} from '@/lib/types/report';
import { toNumber } from '@/lib/utils/number';

import {
  applyReportVisibility,
  buildSalesOrderWhere,
  type ReportVisibility,
} from './report-helpers';

const SAMPLE_REPORT_BATCH_SIZE = 500;

type SampleAccumulator = {
  summary: SampleMetrics;
  customers: Map<string, SampleCustomerMetrics>;
};

const createEmptySampleMetrics = (): SampleMetrics => ({
  orderCount: 0,
  customerCount: 0,
  sampleQuantity: 0,
  sampleRevenue: 0,
  sampleCost: 0,
});

const roundMetric = (value: number) => Math.round(value * 100) / 100;

async function collectSampleMetrics(
  startDate: Date,
  endDate: Date,
  visibility: ReportVisibility
): Promise<SampleAccumulator> {
  const where = applyReportVisibility(
    {
      ...buildSalesOrderWhere(startDate, endDate),
      isSampleOrder: true,
    } as any,
    visibility
  );

  const customerIds = new Set<string>();
  const customers = new Map<string, SampleCustomerMetrics>();
  const summary = createEmptySampleMetrics();

  let cursor: string | undefined;
  while (true) {
    const batch = await prisma.salesOrder.findMany({
      where,
      select: {
        id: true,
        customerId: true,
        totalAmount: true,
        costAmount: true,
        customer: {
          select: {
            name: true,
          },
        },
        items: {
          select: {
            quantity: true,
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
      take: SAMPLE_REPORT_BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    if (batch.length === 0) {
      break;
    }

    for (const order of batch) {
      const sampleQuantity = order.items.reduce(
        (sum, item) => sum + Number(item.quantity ?? 0),
        0
      );
      const sampleRevenue = toNumber(order.totalAmount);
      const sampleCost = toNumber(order.costAmount);

      summary.orderCount += 1;
      summary.sampleQuantity += sampleQuantity;
      summary.sampleRevenue += sampleRevenue;
      summary.sampleCost += sampleCost;

      customerIds.add(order.customerId);

      const existing = customers.get(order.customerId) ?? {
        customerId: order.customerId,
        customerName: order.customer?.name ?? '未命名客户',
        ...createEmptySampleMetrics(),
      };

      existing.orderCount += 1;
      existing.customerCount = 1;
      existing.sampleQuantity += sampleQuantity;
      existing.sampleRevenue += sampleRevenue;
      existing.sampleCost += sampleCost;
      customers.set(order.customerId, existing);
    }

    cursor = batch[batch.length - 1].id;
  }

  summary.customerCount = customerIds.size;
  summary.sampleQuantity = roundMetric(summary.sampleQuantity);
  summary.sampleRevenue = roundMetric(summary.sampleRevenue);
  summary.sampleCost = roundMetric(summary.sampleCost);

  for (const metric of customers.values()) {
    metric.sampleQuantity = roundMetric(metric.sampleQuantity);
    metric.sampleRevenue = roundMetric(metric.sampleRevenue);
    metric.sampleCost = roundMetric(metric.sampleCost);
  }

  return {
    summary,
    customers,
  };
}

export async function getSampleMetrics(
  startDate: Date,
  endDate: Date,
  visibility: ReportVisibility
): Promise<SampleMetrics> {
  const { summary } = await collectSampleMetrics(startDate, endDate, visibility);
  return summary;
}

export async function getAnnualSampleMetrics(
  startDate: Date,
  endDate: Date,
  visibility: ReportVisibility,
  topLimit = 10
): Promise<AnnualSampleMetrics> {
  const { summary, customers } = await collectSampleMetrics(
    startDate,
    endDate,
    visibility
  );

  const topCustomers = [...customers.values()]
    .sort((left, right) => {
      if (right.sampleQuantity !== left.sampleQuantity) {
        return right.sampleQuantity - left.sampleQuantity;
      }
      if (right.sampleRevenue !== left.sampleRevenue) {
        return right.sampleRevenue - left.sampleRevenue;
      }
      return left.customerName.localeCompare(right.customerName, 'zh-CN');
    })
    .slice(0, topLimit);

  return {
    ...summary,
    topCustomers,
  };
}
