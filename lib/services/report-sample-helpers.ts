import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import type {
  AnnualSampleMetrics,
  SampleCustomerMetrics,
  SampleMetrics,
  SampleSourceMetrics,
} from '@/lib/types/report';
import { toNumber } from '@/lib/utils/number';

import {
  applyReportVisibility,
  buildSalesOrderWhere,
  type ReportVisibility,
} from './report-helpers';

const SAMPLE_REPORT_BATCH_SIZE = 500;
const UNKNOWN_CUSTOMER_KEY = '__unknown_sample_customer__';
const UNKNOWN_CUSTOMER_NAME = '未指定客户';

type SampleSourceKey = keyof SampleMetrics['sources'];

type SampleMetricAccumulator = {
  metric: SampleMetrics;
  customerIds: Set<string>;
  sourceCustomerIds: Record<SampleSourceKey, Set<string>>;
};

type SampleCustomerAccumulator = SampleMetricAccumulator & {
  customerId: string;
  customerName: string;
};

const createEmptySampleSourceMetrics = (): SampleSourceMetrics => ({
  recordCount: 0,
  customerCount: 0,
  sampleQuantity: 0,
  sampleRevenue: 0,
  sampleCost: 0,
});

const createEmptySampleMetrics = (): SampleMetrics => ({
  orderCount: 0,
  customerCount: 0,
  sampleQuantity: 0,
  sampleRevenue: 0,
  sampleCost: 0,
  sources: {
    sampleOrder: createEmptySampleSourceMetrics(),
    manualOutbound: createEmptySampleSourceMetrics(),
  },
});

const createSampleMetricAccumulator = (): SampleMetricAccumulator => ({
  metric: createEmptySampleMetrics(),
  customerIds: new Set<string>(),
  sourceCustomerIds: {
    sampleOrder: new Set<string>(),
    manualOutbound: new Set<string>(),
  },
});

const roundMetric = (value: number) => Math.round(value * 100) / 100;

function normalizeCustomerIdentity(
  customerId: string | null | undefined,
  customerName: string | null | undefined
): { customerId: string; customerName: string } {
  if (customerId && customerId.trim().length > 0) {
    return {
      customerId,
      customerName: customerName?.trim() || UNKNOWN_CUSTOMER_NAME,
    };
  }

  return {
    customerId: UNKNOWN_CUSTOMER_KEY,
    customerName: UNKNOWN_CUSTOMER_NAME,
  };
}

function recordSampleMetric(
  accumulator: SampleMetricAccumulator,
  sourceKey: SampleSourceKey,
  customerId: string,
  sampleQuantity: number,
  sampleRevenue: number,
  sampleCost: number
) {
  accumulator.metric.orderCount += 1;
  accumulator.metric.sampleQuantity += sampleQuantity;
  accumulator.metric.sampleRevenue += sampleRevenue;
  accumulator.metric.sampleCost += sampleCost;
  accumulator.customerIds.add(customerId);

  const sourceMetric = accumulator.metric.sources[sourceKey];
  sourceMetric.recordCount += 1;
  sourceMetric.sampleQuantity += sampleQuantity;
  sourceMetric.sampleRevenue += sampleRevenue;
  sourceMetric.sampleCost += sampleCost;
  accumulator.sourceCustomerIds[sourceKey].add(customerId);
}

function finalizeSampleSourceMetrics(metric: SampleSourceMetrics) {
  metric.sampleQuantity = roundMetric(metric.sampleQuantity);
  metric.sampleRevenue = roundMetric(metric.sampleRevenue);
  metric.sampleCost = roundMetric(metric.sampleCost);
}

function finalizeSampleAccumulator(
  accumulator: SampleMetricAccumulator
): SampleMetrics {
  const { metric, customerIds, sourceCustomerIds } = accumulator;

  metric.customerCount = customerIds.size;
  metric.sampleQuantity = roundMetric(metric.sampleQuantity);
  metric.sampleRevenue = roundMetric(metric.sampleRevenue);
  metric.sampleCost = roundMetric(metric.sampleCost);

  for (const sourceKey of Object.keys(metric.sources) as SampleSourceKey[]) {
    metric.sources[sourceKey].customerCount = sourceCustomerIds[sourceKey].size;
    finalizeSampleSourceMetrics(metric.sources[sourceKey]);
  }

  return metric;
}

function getOrCreateCustomerAccumulator(
  customers: Map<string, SampleCustomerAccumulator>,
  customerId: string,
  customerName: string
): SampleCustomerAccumulator {
  const existing = customers.get(customerId);
  if (existing) {
    return existing;
  }

  const created: SampleCustomerAccumulator = {
    customerId,
    customerName,
    ...createSampleMetricAccumulator(),
  };
  customers.set(customerId, created);
  return created;
}

async function collectSampleMetrics(
  startDate: Date,
  endDate: Date,
  visibility: ReportVisibility
): Promise<{
  summary: SampleMetrics;
  customers: SampleCustomerMetrics[];
}> {
  const salesOrderModel =
    prisma.salesOrder as typeof prisma.salesOrder &
      Partial<Pick<typeof prisma.salesOrder, 'findMany'>>;
  const outboundRecordModel =
    prisma.outboundRecord as typeof prisma.outboundRecord &
      Partial<Pick<typeof prisma.outboundRecord, 'findMany'>>;
  const salesOrderWhere = applyReportVisibility<Prisma.SalesOrderWhereInput>(
    {
      ...buildSalesOrderWhere(startDate, endDate),
      isSampleOrder: true,
    },
    visibility
  );

  const summaryAccumulator = createSampleMetricAccumulator();
  const customers = new Map<string, SampleCustomerAccumulator>();

  if (typeof salesOrderModel.findMany === 'function') {
    let salesOrderCursor: string | undefined;
    while (true) {
      const batch =
        (await salesOrderModel.findMany({
          where: salesOrderWhere,
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
          ...(salesOrderCursor
            ? { cursor: { id: salesOrderCursor }, skip: 1 }
            : {}),
        })) ?? [];

      if (batch.length === 0) {
        break;
      }

      for (const order of batch) {
        const identity = normalizeCustomerIdentity(
          order.customerId,
          order.customer?.name
        );
        const sampleQuantity = order.items.reduce(
          (sum, item) => sum + Number(item.quantity ?? 0),
          0
        );
        const sampleRevenue = toNumber(order.totalAmount);
        const sampleCost = toNumber(order.costAmount);

        recordSampleMetric(
          summaryAccumulator,
          'sampleOrder',
          identity.customerId,
          sampleQuantity,
          sampleRevenue,
          sampleCost
        );

        const customerAccumulator = getOrCreateCustomerAccumulator(
          customers,
          identity.customerId,
          identity.customerName
        );
        recordSampleMetric(
          customerAccumulator,
          'sampleOrder',
          identity.customerId,
          sampleQuantity,
          sampleRevenue,
          sampleCost
        );
      }

      salesOrderCursor = batch[batch.length - 1].id;
    }
  }

  if (typeof outboundRecordModel.findMany === 'function') {
    let outboundCursor: string | undefined;
    while (true) {
      const batch =
        (await outboundRecordModel.findMany({
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
            reason: 'sample_outbound',
            salesOrderId: null,
          },
          select: {
            id: true,
            customerId: true,
            quantity: true,
            totalCost: true,
            customer: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            id: 'asc',
          },
          take: SAMPLE_REPORT_BATCH_SIZE,
          ...(outboundCursor ? { cursor: { id: outboundCursor }, skip: 1 } : {}),
        })) ?? [];

      if (batch.length === 0) {
        break;
      }

      for (const record of batch) {
        const identity = normalizeCustomerIdentity(
          record.customerId,
          record.customer?.name
        );
        const sampleQuantity = Number(record.quantity ?? 0);
        const sampleCost = toNumber(record.totalCost);

        recordSampleMetric(
          summaryAccumulator,
          'manualOutbound',
          identity.customerId,
          sampleQuantity,
          0,
          sampleCost
        );

        const customerAccumulator = getOrCreateCustomerAccumulator(
          customers,
          identity.customerId,
          identity.customerName
        );
        recordSampleMetric(
          customerAccumulator,
          'manualOutbound',
          identity.customerId,
          sampleQuantity,
          0,
          sampleCost
        );
      }

      outboundCursor = batch[batch.length - 1].id;
    }
  }

  const summary = finalizeSampleAccumulator(summaryAccumulator);
  const customerMetrics = [...customers.values()].map(customer => ({
    customerId: customer.customerId,
    customerName: customer.customerName,
    ...finalizeSampleAccumulator(customer),
  }));

  return {
    summary,
    customers: customerMetrics,
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

  const topCustomers = customers
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
