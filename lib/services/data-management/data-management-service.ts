import { Prisma } from '@prisma/client';

import {
  revalidateFinance,
  revalidateReturnOrders,
  revalidateSalesOrders,
} from '@/lib/cache';
import {
  clearAllFinanceCache,
  invalidateReportCache,
} from '@/lib/cache/finance-cache';
import { clearAllInventoryCache } from '@/lib/cache/inventory-cache';
import { clearAllProductCache } from '@/lib/cache/product-cache';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getAnnualReport } from '@/lib/services/annual-report-service';
import { getFinanceOverview } from '@/lib/services/finance-statistics';
import { getMonthlyReport } from '@/lib/services/monthly-report-service';
import { recordPartnerTransaction } from '@/lib/services/partner-ledger-service';
import { getProfitLossAnalysis } from '@/lib/services/profit-loss-service';
import { getSystemMode } from '@/lib/services/system-mode-service';
import {
  clearSystemWriteLock,
  setSystemWriteLock,
  type SystemWriteLock,
} from '@/lib/services/system-write-lock';
import type {
  PartnerRole,
  StatementType,
  TransactionType,
} from '@/lib/types/statement';
import { toNumber } from '@/lib/utils/number';

export type DataManagementAction = 'reset_trial' | 'cleanup_test';
export type DataManagementStage =
  | 'S0'
  | 'S1'
  | 'S2'
  | 'S3'
  | 'S4'
  | 'S5'
  | 'S6';
export type DataManagementStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed';

export type DataManagementPreviewItem = {
  id: string;
  label: string;
  count: number;
  amountSum?: number;
};

export type DataManagementPreview = {
  action: DataManagementAction;
  systemMode: 'trial' | 'production';
  totals: { count: number; amountSum: number };
  items: DataManagementPreviewItem[];
  generatedAt: string;
};

export type DataManagementTaskDTO = {
  id: string;
  action: DataManagementAction;
  status: DataManagementStatus;
  stage: DataManagementStage | null;
  requestedBy: string;
  preview: DataManagementPreview | null;
  result: unknown | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type VerificationError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

type VerificationResult = {
  ok: boolean;
  errors: VerificationError[];
};

type CleanupStage = Exclude<DataManagementStage, 'S0' | 'S6'>;
type CleanupMethod = 'delete' | 'void' | 'reverse' | 'rebuild';

type CleanupPreviewContext = {
  action: DataManagementAction;
  systemMode: 'trial' | 'production';
};

type CleanupExecuteContext = {
  taskId: string;
  userId: string;
  action: DataManagementAction;
  now: Date;
  affectedEntityIds: Set<string>;
};

type CleanupVerifyContext = {
  action: DataManagementAction;
  now: Date;
  systemMode: 'trial' | 'production';
};

type CleanupRegistryEntry = {
  id: string;
  label: string;
  stage: CleanupStage;
  dependsOn?: string[];
  methodByAction: Partial<Record<DataManagementAction, CleanupMethod>>;
  showInPreview?: boolean;
  preview?: (
    ctx: CleanupPreviewContext
  ) => Promise<DataManagementPreviewItem | null>;
  execute: (ctx: CleanupExecuteContext) => Promise<void>;
  verify: (ctx: CleanupVerifyContext) => Promise<VerificationError[]>;
};

const REVERSAL_TRANSACTION_TYPE: Record<
  Exclude<TransactionType, `${string}_reversal`>,
  TransactionType
> = {
  sale: 'sale_reversal',
  sales_return: 'sales_return_reversal',
  order_cancellation: 'order_cancellation_reversal',
  payment_in: 'payment_in_reversal',
  payment_out: 'payment_out_reversal',
  prepayment_in: 'prepayment_in_reversal',
  prepayment_out: 'prepayment_out_reversal',
  refund: 'refund_reversal',
  purchase: 'purchase_reversal',
  adjustment: 'adjustment_reversal',
};

const BASE_TRANSACTION_TYPES = Object.keys(REVERSAL_TRANSACTION_TYPE) as Array<
  Exclude<TransactionType, `${string}_reversal`>
>;

function isBaseTransactionType(
  type: TransactionType
): type is Exclude<TransactionType, `${string}_reversal`> {
  return BASE_TRANSACTION_TYPES.includes(type as any);
}

function nowIso() {
  return new Date().toISOString();
}

function sumPreview(items: DataManagementPreviewItem[]) {
  return items.reduce(
    (acc, item) => ({
      count: acc.count + item.count,
      amountSum: acc.amountSum + (item.amountSum ?? 0),
    }),
    { count: 0, amountSum: 0 }
  );
}

function assertActionAllowedForMode(
  action: DataManagementAction,
  systemMode: 'trial' | 'production'
) {
  if (action === 'reset_trial' && systemMode !== 'trial') {
    throw new Error('当前为正式账套，禁止重置试用数据');
  }
  if (action === 'cleanup_test' && systemMode !== 'production') {
    throw new Error('当前为试用账套，仅允许重置试用数据');
  }
}

function buildActiveTestWhere() {
  return { dataTag: 'test', voidedAt: null } as const;
}

function buildVoidedData(now: Date, userId: string) {
  return {
    voidedAt: now,
    voidedBy: userId,
    voidReason: 'test_cleanup',
  } as const;
}

function buildResidueError(entity: string, count: number): VerificationError {
  return {
    code: 'RESIDUE',
    message: `数据管理核验失败：仍存在残留 ${entity}=${count}`,
    details: { entity, count },
  };
}

function parseJson<T>(input: string | null | undefined): T | null {
  if (!input) {
    return null;
  }
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

function serialiseJson(input: unknown): string {
  return JSON.stringify(input);
}

function toCount(value: unknown): number {
  if (typeof value === 'bigint') {
    return Number(value);
  }
  return Number(value ?? 0);
}

function toDTO(task: any): DataManagementTaskDTO {
  return {
    id: task.id,
    action: task.action,
    status: task.status,
    stage: task.stage ?? null,
    requestedBy: task.requestedBy,
    preview: parseJson<DataManagementPreview>(task.preview),
    result: parseJson(task.result),
    errorMessage: task.errorMessage,
    startedAt: task.startedAt ? new Date(task.startedAt).toISOString() : null,
    finishedAt: task.finishedAt
      ? new Date(task.finishedAt).toISOString()
      : null,
    createdAt: new Date(task.createdAt).toISOString(),
    updatedAt: new Date(task.updatedAt).toISOString(),
  };
}

async function updateTask(
  taskId: string,
  data: Prisma.DataManagementTaskUpdateInput
) {
  await prisma.dataManagementTask.update({
    where: { id: taskId },
    data,
  });
}

async function cleanupExpiredInventoryOperations(now: Date) {
  return prisma.inventoryOperation.deleteMany({
    where: {
      status: 'processing',
      expiresAt: { lt: now },
    },
  });
}

async function computeReversalMissingCountForReferenceIds(
  baseType: Exclude<TransactionType, `${string}_reversal`>,
  referenceIds: string[]
) {
  if (referenceIds.length === 0) {
    return 0;
  }
  const reversalType = REVERSAL_TRANSACTION_TYPE[baseType];
  const txRows = await prisma.statementTransaction.findMany({
    where: {
      transactionType: baseType,
      referenceId: { in: referenceIds },
    },
    select: { referenceId: true },
  });
  const uniqueRefIds = Array.from(new Set(txRows.map(row => row.referenceId)));
  if (uniqueRefIds.length === 0) {
    return 0;
  }
  const existingReversal = await prisma.statementTransaction.findMany({
    where: {
      transactionType: reversalType,
      referenceId: { in: uniqueRefIds },
    },
    select: { referenceId: true },
  });
  const existingSet = new Set(existingReversal.map(row => row.referenceId));
  return uniqueRefIds.reduce(
    (acc, id) => acc + (existingSet.has(id) ? 0 : 1),
    0
  );
}

async function listTestReferenceIds() {
  const [
    orderIds,
    returnIds,
    paymentIds,
    refundIds,
    payableIds,
    paymentOutIds,
  ] = await Promise.all([
    prisma.salesOrder.findMany({
      where: { dataTag: 'test' },
      select: { id: true },
      take: 100000,
    }),
    prisma.returnOrder.findMany({
      where: { dataTag: 'test' },
      select: { id: true },
      take: 100000,
    }),
    prisma.paymentRecord.findMany({
      where: { dataTag: 'test' },
      select: { id: true },
      take: 100000,
    }),
    prisma.refundRecord.findMany({
      where: { dataTag: 'test' },
      select: { id: true },
      take: 100000,
    }),
    prisma.payableRecord.findMany({
      where: { dataTag: 'test' },
      select: { id: true },
      take: 100000,
    }),
    prisma.paymentOutRecord.findMany({
      where: { dataTag: 'test' },
      select: { id: true },
      take: 100000,
    }),
  ]);

  return {
    salesOrderIds: orderIds.map(row => row.id),
    returnOrderIds: returnIds.map(row => row.id),
    paymentRecordIds: paymentIds.map(row => row.id),
    refundRecordIds: refundIds.map(row => row.id),
    payableRecordIds: payableIds.map(row => row.id),
    paymentOutRecordIds: paymentOutIds.map(row => row.id),
  };
}

async function computeTestReversalMissingCount() {
  const ids = await listTestReferenceIds();
  const missingCounts = await Promise.all([
    computeReversalMissingCountForReferenceIds('sale', ids.salesOrderIds),
    computeReversalMissingCountForReferenceIds(
      'order_cancellation',
      ids.salesOrderIds
    ),
    computeReversalMissingCountForReferenceIds(
      'sales_return',
      ids.returnOrderIds
    ),
    computeReversalMissingCountForReferenceIds(
      'payment_in',
      ids.paymentRecordIds
    ),
    computeReversalMissingCountForReferenceIds(
      'prepayment_in',
      ids.paymentRecordIds
    ),
    computeReversalMissingCountForReferenceIds(
      'prepayment_out',
      ids.paymentRecordIds
    ),
    computeReversalMissingCountForReferenceIds('refund', ids.refundRecordIds),
    computeReversalMissingCountForReferenceIds(
      'purchase',
      ids.payableRecordIds
    ),
    computeReversalMissingCountForReferenceIds(
      'payment_out',
      ids.paymentOutRecordIds
    ),
  ]);

  return missingCounts.reduce((acc, v) => acc + v, 0);
}

async function filterRowsMissingReversal(
  txRows: Array<{
    transactionType: TransactionType;
    referenceId: string;
  }>
) {
  const pairs: Array<{ referenceId: string; reversalType: TransactionType }> =
    [];

  for (const row of txRows) {
    const type = row.transactionType as TransactionType;
    if (!isBaseTransactionType(type)) {
      continue;
    }
    pairs.push({
      referenceId: row.referenceId,
      reversalType: REVERSAL_TRANSACTION_TYPE[type],
    });
  }

  if (pairs.length === 0) {
    return txRows;
  }

  const uniqueReferenceIds = Array.from(new Set(pairs.map(p => p.referenceId)));
  const uniqueReversalTypes = Array.from(
    new Set(pairs.map(p => p.reversalType))
  );

  const existing = await prisma.statementTransaction.findMany({
    where: {
      referenceId: { in: uniqueReferenceIds },
      transactionType: { in: uniqueReversalTypes },
    },
    select: { referenceId: true, transactionType: true },
  });

  const existingSet = new Set(
    existing.map(row => `${row.referenceId}:${row.transactionType}`)
  );

  return txRows.filter(row => {
    const type = row.transactionType as TransactionType;
    if (!isBaseTransactionType(type)) {
      return false;
    }
    const reversalType = REVERSAL_TRANSACTION_TYPE[type];
    return !existingSet.has(`${row.referenceId}:${reversalType}`);
  });
}

const CLEANUP_REGISTRY: CleanupRegistryEntry[] = [
  {
    id: 'prepayment_usages',
    label: '预收抵扣记录',
    stage: 'S1',
    methodByAction: { reset_trial: 'delete', cleanup_test: 'delete' },
    showInPreview: true,
    preview: async ({ action }) => {
      const where =
        action === 'reset_trial'
          ? undefined
          : ({
              OR: [
                { paymentRecord: { dataTag: 'test' } },
                { salesOrder: { dataTag: 'test' } },
              ],
            } satisfies Prisma.PrepaymentUsageWhereInput);

      const agg = await prisma.prepaymentUsage.aggregate({
        where,
        _count: { id: true },
        _sum: { appliedAmount: true },
      });

      return {
        id: 'prepayment_usages',
        label: '预收抵扣',
        count: agg._count.id ?? 0,
        amountSum: toNumber(agg._sum.appliedAmount),
      };
    },
    execute: async ({ action }) => {
      if (action === 'reset_trial') {
        await prisma.prepaymentUsage.deleteMany();
        return;
      }

      await prisma.prepaymentUsage.deleteMany({
        where: {
          OR: [
            { paymentRecord: { dataTag: 'test' } },
            { salesOrder: { dataTag: 'test' } },
          ],
        },
      });
    },
    verify: async ({ action }) => {
      const count =
        action === 'reset_trial'
          ? await prisma.prepaymentUsage.count()
          : await prisma.prepaymentUsage.count({
              where: {
                OR: [
                  { paymentRecord: { dataTag: 'test' } },
                  { salesOrder: { dataTag: 'test' } },
                ],
              },
            });

      return count === 0 ? [] : [buildResidueError('prepayment_usages', count)];
    },
  },
  {
    id: 'shipping_queries',
    label: '运输查询记录',
    stage: 'S1',
    methodByAction: { reset_trial: 'delete', cleanup_test: 'delete' },
    showInPreview: true,
    preview: async ({ action }) => {
      const where =
        action === 'reset_trial'
          ? undefined
          : ({
              factoryShipmentOrder: { is: { dataTag: 'test' } },
            } satisfies Prisma.ShippingQueryWhereInput);

      const count = await prisma.shippingQuery.count({ where });
      return {
        id: 'shipping_queries',
        label: '运输查询记录',
        count,
      };
    },
    execute: async ({ action }) => {
      if (action === 'reset_trial') {
        await prisma.shippingQuery.deleteMany();
        return;
      }

      await prisma.shippingQuery.deleteMany({
        where: { factoryShipmentOrder: { is: { dataTag: 'test' } } },
      });
    },
    verify: async ({ action }) => {
      const count =
        action === 'reset_trial'
          ? await prisma.shippingQuery.count()
          : await prisma.shippingQuery.count({
              where: { factoryShipmentOrder: { is: { dataTag: 'test' } } },
            });

      return count === 0 ? [] : [buildResidueError('shipping_queries', count)];
    },
  },
  // trial only: 子表/中间表
  {
    id: 'return_order_items',
    label: '退货单明细',
    stage: 'S1',
    methodByAction: { reset_trial: 'delete' },
    execute: async () => {
      await prisma.returnOrderItem.deleteMany();
    },
    verify: async ({ action }) => {
      if (action !== 'reset_trial') return [];
      const count = await prisma.returnOrderItem.count();
      return count === 0
        ? []
        : [buildResidueError('return_order_items', count)];
    },
  },
  {
    id: 'factory_shipment_order_fee_items',
    label: '厂家发货单运费明细',
    stage: 'S1',
    methodByAction: { reset_trial: 'delete' },
    execute: async () => {
      await prisma.factoryShipmentOrderFeeItem.deleteMany();
    },
    verify: async ({ action }) => {
      if (action !== 'reset_trial') return [];
      const count = await prisma.factoryShipmentOrderFeeItem.count();
      return count === 0
        ? []
        : [buildResidueError('factory_shipment_order_fee_items', count)];
    },
  },
  {
    id: 'factory_shipment_order_items',
    label: '厂家发货单明细',
    stage: 'S1',
    methodByAction: { reset_trial: 'delete' },
    execute: async () => {
      await prisma.factoryShipmentOrderItem.deleteMany();
    },
    verify: async ({ action }) => {
      if (action !== 'reset_trial') return [];
      const count = await prisma.factoryShipmentOrderItem.count();
      return count === 0
        ? []
        : [buildResidueError('factory_shipment_order_items', count)];
    },
  },
  {
    id: 'purchase_order_items',
    label: '采购订单明细',
    stage: 'S1',
    methodByAction: { reset_trial: 'delete' },
    execute: async () => {
      await prisma.purchaseOrderItem.deleteMany();
    },
    verify: async ({ action }) => {
      if (action !== 'reset_trial') return [];
      const count = await prisma.purchaseOrderItem.count();
      return count === 0
        ? []
        : [buildResidueError('purchase_order_items', count)];
    },
  },
  {
    id: 'sales_order_fee_items',
    label: '销售订单费用明细',
    stage: 'S1',
    methodByAction: { reset_trial: 'delete' },
    execute: async () => {
      await prisma.salesOrderFeeItem.deleteMany();
    },
    verify: async ({ action }) => {
      if (action !== 'reset_trial') return [];
      const count = await prisma.salesOrderFeeItem.count();
      return count === 0
        ? []
        : [buildResidueError('sales_order_fee_items', count)];
    },
  },
  {
    id: 'sales_order_items',
    label: '销售订单明细',
    stage: 'S1',
    methodByAction: { reset_trial: 'delete' },
    execute: async () => {
      await prisma.salesOrderItem.deleteMany();
    },
    verify: async ({ action }) => {
      if (action !== 'reset_trial') return [];
      const count = await prisma.salesOrderItem.count();
      return count === 0 ? [] : [buildResidueError('sales_order_items', count)];
    },
  },
  // trial only: 库存相关
  {
    id: 'inventory_cost_queue',
    label: '库存成本队列',
    stage: 'S2',
    methodByAction: { reset_trial: 'delete' },
    execute: async () => {
      await prisma.inventoryCostQueue.deleteMany();
    },
    verify: async ({ action }) => {
      if (action !== 'reset_trial') return [];
      const count = await prisma.inventoryCostQueue.count();
      return count === 0
        ? []
        : [buildResidueError('inventory_cost_queue', count)];
    },
  },
  {
    id: 'inventory_count_items',
    label: '库存盘点明细',
    stage: 'S2',
    methodByAction: { reset_trial: 'delete' },
    execute: async () => {
      await prisma.inventoryCountItem.deleteMany();
    },
    verify: async ({ action }) => {
      if (action !== 'reset_trial') return [];
      const count = await prisma.inventoryCountItem.count();
      return count === 0
        ? []
        : [buildResidueError('inventory_count_items', count)];
    },
  },
  {
    id: 'inventory_counts',
    label: '库存盘点',
    stage: 'S2',
    methodByAction: { reset_trial: 'delete' },
    execute: async () => {
      await prisma.inventoryCount.deleteMany();
    },
    verify: async ({ action }) => {
      if (action !== 'reset_trial') return [];
      const count = await prisma.inventoryCount.count();
      return count === 0 ? [] : [buildResidueError('inventory_counts', count)];
    },
  },
  {
    id: 'outbound_records',
    label: '出库记录',
    stage: 'S2',
    methodByAction: { reset_trial: 'delete' },
    execute: async () => {
      await prisma.outboundRecord.deleteMany();
    },
    verify: async ({ action }) => {
      if (action !== 'reset_trial') return [];
      const count = await prisma.outboundRecord.count();
      return count === 0 ? [] : [buildResidueError('outbound_records', count)];
    },
  },
  {
    id: 'inbound_records',
    label: '入库记录',
    stage: 'S2',
    methodByAction: { reset_trial: 'delete' },
    execute: async () => {
      await prisma.inboundRecord.deleteMany();
    },
    verify: async ({ action }) => {
      if (action !== 'reset_trial') return [];
      const count = await prisma.inboundRecord.count();
      return count === 0 ? [] : [buildResidueError('inbound_records', count)];
    },
  },
  {
    id: 'inventory_adjustments',
    label: '库存调整',
    stage: 'S2',
    methodByAction: { reset_trial: 'delete' },
    execute: async () => {
      await prisma.inventoryAdjustment.deleteMany();
    },
    verify: async ({ action }) => {
      if (action !== 'reset_trial') return [];
      const count = await prisma.inventoryAdjustment.count();
      return count === 0
        ? []
        : [buildResidueError('inventory_adjustments', count)];
    },
  },
  {
    id: 'inventory_operations',
    label: '库存操作记录',
    stage: 'S2',
    methodByAction: { reset_trial: 'delete' },
    execute: async () => {
      await prisma.inventoryOperation.deleteMany();
    },
    verify: async ({ action, now }) => {
      if (action !== 'reset_trial') return [];
      const [count, expiredProcessing] = await Promise.all([
        prisma.inventoryOperation.count(),
        prisma.inventoryOperation.count({
          where: { status: 'processing', expiresAt: { lt: now } },
        }),
      ]);

      const errors: VerificationError[] = [];
      if (count !== 0) {
        errors.push(buildResidueError('inventory_operations', count));
      }
      if (expiredProcessing !== 0) {
        errors.push(
          buildResidueError(
            'inventory_operations_expired_processing',
            expiredProcessing
          )
        );
      }
      return errors;
    },
  },
  {
    id: 'inventory',
    label: '库存',
    stage: 'S2',
    methodByAction: { reset_trial: 'delete' },
    execute: async () => {
      await prisma.inventory.deleteMany();
    },
    verify: async ({ action }) => {
      if (action !== 'reset_trial') return [];
      const count = await prisma.inventory.count();
      return count === 0 ? [] : [buildResidueError('inventory', count)];
    },
  },
  // trial only: 产品基础资料
  // 注意：products 删除会触发多表 FK / cascade，必须确保已先删除库存与明细等下游表，
  // 并先删除 onDelete: Restrict 的 batch_specifications / fifo_consumption_ledger，避免 FK 报错。
  {
    id: 'fifo_consumption_ledger',
    label: 'FIFO 成本消耗台账',
    stage: 'S2',
    methodByAction: { reset_trial: 'delete' },
    showInPreview: true,
    preview: async () => {
      const count = await prisma.fifoConsumptionLedger.count();
      return {
        id: 'fifo_consumption_ledger',
        label: 'FIFO 成本消耗台账',
        count,
      };
    },
    execute: async () => {
      await prisma.fifoConsumptionLedger.deleteMany();
    },
    verify: async ({ action }) => {
      if (action !== 'reset_trial') return [];
      const count = await prisma.fifoConsumptionLedger.count();
      return count === 0
        ? []
        : [buildResidueError('fifo_consumption_ledger', count)];
    },
  },
  {
    id: 'batch_specifications',
    label: '批次规格',
    stage: 'S2',
    methodByAction: { reset_trial: 'delete' },
    showInPreview: true,
    preview: async () => {
      const count = await prisma.batchSpecification.count();
      return { id: 'batch_specifications', label: '批次规格', count };
    },
    execute: async () => {
      await prisma.batchSpecification.deleteMany();
    },
    verify: async ({ action }) => {
      if (action !== 'reset_trial') return [];
      const count = await prisma.batchSpecification.count();
      return count === 0
        ? []
        : [buildResidueError('batch_specifications', count)];
    },
  },
  {
    id: 'temporary_products',
    label: '临时产品',
    stage: 'S2',
    methodByAction: { reset_trial: 'delete' },
    showInPreview: true,
    preview: async () => {
      const count = await prisma.temporaryProduct.count();
      return { id: 'temporary_products', label: '临时产品', count };
    },
    execute: async () => {
      await prisma.temporaryProduct.deleteMany();
    },
    verify: async ({ action }) => {
      if (action !== 'reset_trial') return [];
      const count = await prisma.temporaryProduct.count();
      return count === 0
        ? []
        : [buildResidueError('temporary_products', count)];
    },
  },
  {
    id: 'products',
    label: '产品',
    stage: 'S2',
    methodByAction: { reset_trial: 'delete' },
    showInPreview: true,
    preview: async () => {
      const count = await prisma.product.count();
      return { id: 'products', label: '产品', count };
    },
    execute: async () => {
      await prisma.product.deleteMany();
    },
    verify: async ({ action }) => {
      if (action !== 'reset_trial') return [];
      const count = await prisma.product.count();
      return count === 0 ? [] : [buildResidueError('products', count)];
    },
  },
  {
    id: 'categories',
    label: '产品分类',
    stage: 'S2',
    methodByAction: { reset_trial: 'delete' },
    showInPreview: true,
    preview: async () => {
      const count = await prisma.category.count();
      return { id: 'categories', label: '产品分类', count };
    },
    execute: async () => {
      await prisma.category.deleteMany();
    },
    verify: async ({ action }) => {
      if (action !== 'reset_trial') return [];
      const count = await prisma.category.count();
      return count === 0 ? [] : [buildResidueError('categories', count)];
    },
  },
  // 主业务单据
  // 注意：SalesOrder 被多表引用（例如 refund_records.sales_order_id 为 Restrict），
  // trial 重置时必须先删除/作废下游表，最后再删 SalesOrder，避免触发 FK 报错与 SetNull 批量更新放大耗时。
  {
    id: 'return_orders',
    label: '退货订单',
    stage: 'S2',
    methodByAction: { reset_trial: 'delete', cleanup_test: 'void' },
    showInPreview: true,
    preview: async ({ action }) => {
      const where =
        action === 'reset_trial'
          ? undefined
          : (buildActiveTestWhere() satisfies Prisma.ReturnOrderWhereInput);

      const agg = await prisma.returnOrder.aggregate({
        where,
        _count: { id: true },
        _sum: { refundAmount: true, totalAmount: true },
      });

      return {
        id: 'return_orders',
        label: '退货订单',
        count: agg._count.id ?? 0,
        amountSum: toNumber(agg._sum.refundAmount ?? agg._sum.totalAmount),
      };
    },
    execute: async ({ action, now, userId }) => {
      if (action === 'reset_trial') {
        await prisma.returnOrder.deleteMany();
        return;
      }

      await prisma.returnOrder.updateMany({
        where: buildActiveTestWhere() as any,
        data: buildVoidedData(now, userId) as any,
      });
    },
    verify: async ({ action }) => {
      const count =
        action === 'reset_trial'
          ? await prisma.returnOrder.count()
          : await prisma.returnOrder.count({
              where: buildActiveTestWhere() as any,
            });
      return count === 0 ? [] : [buildResidueError('return_orders', count)];
    },
  },
  {
    id: 'payment_records',
    label: '收款记录',
    stage: 'S2',
    methodByAction: { reset_trial: 'delete', cleanup_test: 'void' },
    showInPreview: true,
    preview: async ({ action }) => {
      const where =
        action === 'reset_trial'
          ? undefined
          : (buildActiveTestWhere() satisfies Prisma.PaymentRecordWhereInput);

      const agg = await prisma.paymentRecord.aggregate({
        where,
        _count: { id: true },
        _sum: { paymentAmount: true },
      });

      return {
        id: 'payment_records',
        label: '收款记录',
        count: agg._count.id ?? 0,
        amountSum: toNumber(agg._sum.paymentAmount),
      };
    },
    execute: async ({ action, now, userId }) => {
      if (action === 'reset_trial') {
        await prisma.paymentRecord.deleteMany();
        return;
      }

      await prisma.paymentRecord.updateMany({
        where: buildActiveTestWhere() as any,
        data: buildVoidedData(now, userId) as any,
      });
    },
    verify: async ({ action }) => {
      const count =
        action === 'reset_trial'
          ? await prisma.paymentRecord.count()
          : await prisma.paymentRecord.count({
              where: buildActiveTestWhere() as any,
            });
      return count === 0 ? [] : [buildResidueError('payment_records', count)];
    },
  },
  {
    id: 'refund_records',
    label: '退款记录',
    stage: 'S2',
    methodByAction: { reset_trial: 'delete', cleanup_test: 'void' },
    showInPreview: true,
    preview: async ({ action }) => {
      const where =
        action === 'reset_trial'
          ? undefined
          : (buildActiveTestWhere() satisfies Prisma.RefundRecordWhereInput);

      const agg = await prisma.refundRecord.aggregate({
        where,
        _count: { id: true },
        _sum: { refundAmount: true, processedAmount: true },
      });

      return {
        id: 'refund_records',
        label: '退款记录',
        count: agg._count.id ?? 0,
        amountSum: toNumber(agg._sum.processedAmount ?? agg._sum.refundAmount),
      };
    },
    execute: async ({ action, now, userId }) => {
      if (action === 'reset_trial') {
        await prisma.refundRecord.deleteMany();
        return;
      }

      await prisma.refundRecord.updateMany({
        where: buildActiveTestWhere() as any,
        data: buildVoidedData(now, userId) as any,
      });
    },
    verify: async ({ action }) => {
      const count =
        action === 'reset_trial'
          ? await prisma.refundRecord.count()
          : await prisma.refundRecord.count({
              where: buildActiveTestWhere() as any,
            });
      return count === 0 ? [] : [buildResidueError('refund_records', count)];
    },
  },
  {
    id: 'purchase_orders',
    label: '仓库进货',
    stage: 'S2',
    methodByAction: { reset_trial: 'delete', cleanup_test: 'void' },
    showInPreview: true,
    preview: async ({ action }) => {
      const where =
        action === 'reset_trial'
          ? undefined
          : (buildActiveTestWhere() satisfies Prisma.PurchaseOrderWhereInput);

      const agg = await prisma.purchaseOrder.aggregate({
        where,
        _count: { id: true },
        _sum: { totalAmount: true },
      });

      return {
        id: 'purchase_orders',
        label: '仓库进货',
        count: agg._count.id ?? 0,
        amountSum: toNumber(agg._sum.totalAmount),
      };
    },
    execute: async ({ action, now, userId }) => {
      if (action === 'reset_trial') {
        await prisma.purchaseOrder.deleteMany();
        return;
      }

      await prisma.purchaseOrder.updateMany({
        where: buildActiveTestWhere() as any,
        data: buildVoidedData(now, userId) as any,
      });
    },
    verify: async ({ action }) => {
      const count =
        action === 'reset_trial'
          ? await prisma.purchaseOrder.count()
          : await prisma.purchaseOrder.count({
              where: buildActiveTestWhere() as any,
            });
      return count === 0 ? [] : [buildResidueError('purchase_orders', count)];
    },
  },
  {
    id: 'factory_shipment_orders',
    label: '厂家发货/客户直发',
    stage: 'S2',
    methodByAction: { reset_trial: 'delete', cleanup_test: 'void' },
    showInPreview: true,
    preview: async ({ action }) => {
      const where =
        action === 'reset_trial'
          ? undefined
          : (buildActiveTestWhere() satisfies Prisma.FactoryShipmentOrderWhereInput);

      const agg = await prisma.factoryShipmentOrder.aggregate({
        where,
        _count: { id: true },
        _sum: { receivableAmount: true },
      });

      return {
        id: 'factory_shipment_orders',
        label: '厂家发货/客户直发',
        count: agg._count.id ?? 0,
        amountSum: toNumber(agg._sum.receivableAmount),
      };
    },
    execute: async ({ action, now, userId }) => {
      if (action === 'reset_trial') {
        await prisma.factoryShipmentOrder.deleteMany();
        return;
      }

      await prisma.factoryShipmentOrder.updateMany({
        where: buildActiveTestWhere() as any,
        data: buildVoidedData(now, userId) as any,
      });
    },
    verify: async ({ action }) => {
      const count =
        action === 'reset_trial'
          ? await prisma.factoryShipmentOrder.count()
          : await prisma.factoryShipmentOrder.count({
              where: buildActiveTestWhere() as any,
            });
      return count === 0
        ? []
        : [buildResidueError('factory_shipment_orders', count)];
    },
  },
  {
    id: 'payable_records',
    label: '应付货款',
    stage: 'S2',
    methodByAction: { reset_trial: 'delete', cleanup_test: 'void' },
    showInPreview: true,
    preview: async ({ action }) => {
      const where =
        action === 'reset_trial'
          ? undefined
          : (buildActiveTestWhere() satisfies Prisma.PayableRecordWhereInput);

      const agg = await prisma.payableRecord.aggregate({
        where,
        _count: { id: true },
        _sum: { payableAmount: true },
      });

      return {
        id: 'payable_records',
        label: '应付货款',
        count: agg._count.id ?? 0,
        amountSum: toNumber(agg._sum.payableAmount),
      };
    },
    execute: async ({ action, now, userId }) => {
      if (action === 'reset_trial') {
        await prisma.payableRecord.deleteMany();
        return;
      }

      await prisma.payableRecord.updateMany({
        where: buildActiveTestWhere() as any,
        data: buildVoidedData(now, userId) as any,
      });
    },
    verify: async ({ action }) => {
      const count =
        action === 'reset_trial'
          ? await prisma.payableRecord.count()
          : await prisma.payableRecord.count({
              where: buildActiveTestWhere() as any,
            });
      return count === 0 ? [] : [buildResidueError('payable_records', count)];
    },
  },
  {
    id: 'payment_out_records',
    label: '付款记录',
    stage: 'S2',
    methodByAction: { reset_trial: 'delete', cleanup_test: 'void' },
    showInPreview: true,
    preview: async ({ action }) => {
      const where =
        action === 'reset_trial'
          ? undefined
          : (buildActiveTestWhere() satisfies Prisma.PaymentOutRecordWhereInput);

      const agg = await prisma.paymentOutRecord.aggregate({
        where,
        _count: { id: true },
        _sum: { paymentAmount: true },
      });

      return {
        id: 'payment_out_records',
        label: '付款记录',
        count: agg._count.id ?? 0,
        amountSum: toNumber(agg._sum.paymentAmount),
      };
    },
    execute: async ({ action, now, userId }) => {
      if (action === 'reset_trial') {
        await prisma.paymentOutRecord.deleteMany();
        return;
      }

      await prisma.paymentOutRecord.updateMany({
        where: buildActiveTestWhere() as any,
        data: buildVoidedData(now, userId) as any,
      });
    },
    verify: async ({ action }) => {
      const count =
        action === 'reset_trial'
          ? await prisma.paymentOutRecord.count()
          : await prisma.paymentOutRecord.count({
              where: buildActiveTestWhere() as any,
            });
      return count === 0
        ? []
        : [buildResidueError('payment_out_records', count)];
    },
  },
  {
    id: 'expense_records',
    label: '费用记录',
    stage: 'S2',
    methodByAction: { reset_trial: 'delete', cleanup_test: 'void' },
    showInPreview: true,
    preview: async ({ action }) => {
      const where =
        action === 'reset_trial'
          ? undefined
          : (buildActiveTestWhere() satisfies Prisma.ExpenseRecordWhereInput);

      const agg = await prisma.expenseRecord.aggregate({
        where,
        _count: { id: true },
        _sum: { expenseAmount: true },
      });

      return {
        id: 'expense_records',
        label: '费用记录',
        count: agg._count.id ?? 0,
        amountSum: toNumber(agg._sum.expenseAmount),
      };
    },
    execute: async ({ action, now, userId }) => {
      if (action === 'reset_trial') {
        await prisma.expenseRecord.deleteMany();
        return;
      }

      await prisma.expenseRecord.updateMany({
        where: buildActiveTestWhere() as any,
        data: buildVoidedData(now, userId) as any,
      });
    },
    verify: async ({ action }) => {
      const count =
        action === 'reset_trial'
          ? await prisma.expenseRecord.count()
          : await prisma.expenseRecord.count({
              where: buildActiveTestWhere() as any,
            });
      return count === 0 ? [] : [buildResidueError('expense_records', count)];
    },
  },
  {
    id: 'sales_orders',
    label: '销售订单',
    stage: 'S2',
    methodByAction: { reset_trial: 'delete', cleanup_test: 'void' },
    showInPreview: true,
    preview: async ({ action }) => {
      const where =
        action === 'reset_trial'
          ? undefined
          : (buildActiveTestWhere() satisfies Prisma.SalesOrderWhereInput);

      const agg = await prisma.salesOrder.aggregate({
        where,
        _count: { id: true },
        _sum: { totalAmount: true },
      });

      return {
        id: 'sales_orders',
        label: '销售订单',
        count: agg._count.id ?? 0,
        amountSum: toNumber(agg._sum.totalAmount),
      };
    },
    execute: async ({ action, now, userId }) => {
      if (action === 'reset_trial') {
        await prisma.salesOrder.deleteMany();
        return;
      }

      await prisma.salesOrder.updateMany({
        where: buildActiveTestWhere() as any,
        data: buildVoidedData(now, userId) as any,
      });
    },
    verify: async ({ action }) => {
      const count =
        action === 'reset_trial'
          ? await prisma.salesOrder.count()
          : await prisma.salesOrder.count({
              where: buildActiveTestWhere() as any,
            });
      return count === 0 ? [] : [buildResidueError('sales_orders', count)];
    },
  },
  // 往来流水/台账
  {
    id: 'statement_transactions',
    label: '往来流水',
    stage: 'S3',
    methodByAction: { reset_trial: 'delete', cleanup_test: 'reverse' },
    showInPreview: true,
    preview: async ({ action }) => {
      if (action === 'reset_trial') {
        const count = await prisma.statementTransaction.count();
        return { id: 'statement_transactions', label: '往来流水', count };
      }

      const count = await computeTestReversalMissingCount();
      return {
        id: 'statement_transactions_to_reverse',
        label: '往来流水（待冲销分录数）',
        count,
      };
    },
    execute: async ({ action, taskId, userId, affectedEntityIds }) => {
      if (action === 'reset_trial') {
        await prisma.statementTransaction.deleteMany();
        return;
      }

      const ids = await listTestReferenceIds();
      const queryGroups: Array<{
        referenceIds: string[];
        types: TransactionType[];
      }> = [
        {
          referenceIds: ids.salesOrderIds,
          types: ['sale', 'order_cancellation'],
        },
        { referenceIds: ids.returnOrderIds, types: ['sales_return'] },
        {
          referenceIds: ids.paymentRecordIds,
          types: ['payment_in', 'prepayment_in', 'prepayment_out'],
        },
        { referenceIds: ids.refundRecordIds, types: ['refund'] },
        { referenceIds: ids.payableRecordIds, types: ['purchase'] },
        { referenceIds: ids.paymentOutRecordIds, types: ['payment_out'] },
      ];

      for (const group of queryGroups) {
        if (group.referenceIds.length === 0) {
          continue;
        }

        const txRows = await prisma.statementTransaction.findMany({
          where: {
            transactionType: { in: group.types },
            referenceId: { in: group.referenceIds },
          },
          select: {
            id: true,
            transactionType: true,
            referenceId: true,
            referenceNumber: true,
            amount: true,
            statement: {
              select: {
                entityId: true,
                entityName: true,
                partnerRole: true,
                entityType: true,
              },
            },
          },
        });

        for (const row of txRows) {
          affectedEntityIds.add(row.statement.entityId);
        }

        const pendingRows = await filterRowsMissingReversal(txRows as any);
        if (pendingRows.length === 0) {
          continue;
        }

        await reverseTransactionsForRows(taskId, userId, pendingRows as any);
      }
    },
    verify: async ({ action }) => {
      if (action === 'reset_trial') {
        const count = await prisma.statementTransaction.count();
        return count === 0
          ? []
          : [buildResidueError('statement_transactions', count)];
      }

      const missing = await computeTestReversalMissingCount();
      return missing === 0
        ? []
        : [
            {
              code: 'RESIDUE',
              message: `清理测试数据后仍存在未冲销的往来分录=${missing}`,
              details: { missing },
            },
          ];
    },
  },
  {
    id: 'account_statements',
    label: '往来台账',
    stage: 'S4',
    methodByAction: { reset_trial: 'delete', cleanup_test: 'rebuild' },
    showInPreview: true,
    preview: async ({ action }) => {
      if (action !== 'reset_trial') {
        return null;
      }
      const count = await prisma.accountStatement.count();
      return { id: 'account_statements', label: '往来台账', count };
    },
    execute: async ({ action, affectedEntityIds }) => {
      if (action === 'reset_trial') {
        await prisma.accountStatement.deleteMany();
        return;
      }

      await rebuildAccountStatementsForEntityIds(Array.from(affectedEntityIds));
    },
    verify: async ({ action }) => {
      if (action !== 'reset_trial') {
        return [];
      }
      const count = await prisma.accountStatement.count();
      return count === 0
        ? []
        : [buildResidueError('account_statements', count)];
    },
  },
];

async function buildPreview(
  action: DataManagementAction
): Promise<DataManagementPreview> {
  const systemMode = await getSystemMode();
  assertActionAllowedForMode(action, systemMode);

  const previewEntries = CLEANUP_REGISTRY.filter(entry => {
    if (!entry.showInPreview) return false;
    return Boolean(entry.methodByAction[action]);
  });

  const items = (
    await Promise.all(
      previewEntries.map(entry => entry.preview?.({ action, systemMode }))
    )
  ).filter(Boolean) as DataManagementPreviewItem[];

  const totals = sumPreview(items);
  return { action, systemMode, totals, items, generatedAt: nowIso() };
}

export async function previewDataManagement(action: DataManagementAction) {
  return buildPreview(action);
}

export async function createDataManagementTask(input: {
  action: DataManagementAction;
  requestedBy: string;
  idempotencyKey?: string | null;
  scope?: Record<string, unknown> | null;
  preview?: DataManagementPreview | null;
}) {
  const { action, requestedBy, idempotencyKey, scope, preview } = input;
  if (idempotencyKey) {
    const existing = await prisma.dataManagementTask.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return toDTO(existing);
    }
  }

  const created = await prisma.dataManagementTask.create({
    data: {
      action,
      status: 'queued',
      stage: 'S0',
      requestedBy,
      idempotencyKey: idempotencyKey ?? null,
      scope: scope ? serialiseJson(scope) : null,
      preview: preview ? serialiseJson(preview) : null,
    },
  });
  return toDTO(created);
}

export async function getDataManagementTask(taskId: string) {
  const task = await prisma.dataManagementTask.findUnique({
    where: { id: taskId },
  });
  return task ? toDTO(task) : null;
}

async function markTaskFailed(taskId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  await updateTask(taskId, {
    status: 'failed',
    errorMessage: message,
    finishedAt: new Date(),
  });
}

async function writeSystemLog(
  taskId: string,
  userId: string,
  action: DataManagementAction,
  level: 'info' | 'warning' | 'error',
  description: string,
  metadata?: Record<string, unknown>,
  ipAddress?: string | null,
  userAgent?: string | null
) {
  try {
    await prisma.systemLog.create({
      data: {
        type: 'system_event',
        level,
        action: `data-management:${action}`,
        description: description.slice(0, 191),
        userId,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        metadata: metadata ? JSON.stringify(metadata).slice(0, 191) : null,
      },
    });
  } catch (logError) {
    logger.warn('data-management', '写入 SystemLog 失败(忽略)', undefined, {
      taskId,
      error: logError instanceof Error ? logError.message : String(logError),
    });
  }
}

function buildWriteLock(
  taskId: string,
  userId: string,
  action: DataManagementAction
): SystemWriteLock {
  const lockedAt = new Date();
  const expiresAt = new Date(lockedAt.getTime() + 30 * 60 * 1000);
  return {
    locked: true,
    taskId,
    action,
    lockedAt: lockedAt.toISOString(),
    lockedBy: userId,
    expiresAt: expiresAt.toISOString(),
  };
}

function getCleanupStageEntries(
  stage: CleanupStage,
  action: DataManagementAction
) {
  return CLEANUP_REGISTRY.filter(entry => {
    if (entry.stage !== stage) return false;
    return Boolean(entry.methodByAction[action]);
  });
}

async function executeCleanupStage(
  stage: CleanupStage,
  ctx: CleanupExecuteContext
) {
  const entries = getCleanupStageEntries(stage, ctx.action);
  for (const entry of entries) {
    await entry.execute(ctx);
  }
}

async function verifyCleanupRegistry(ctx: CleanupVerifyContext) {
  const entries = CLEANUP_REGISTRY.filter(entry =>
    Boolean(entry.methodByAction[ctx.action])
  );

  const errors: VerificationError[] = [];
  for (const entry of entries) {
    errors.push(...(await entry.verify(ctx)));
  }

  return errors;
}

async function reverseTransactionsForRows(
  taskId: string,
  userId: string,
  txRows: Array<{
    id: string;
    transactionType: TransactionType;
    referenceId: string;
    referenceNumber: string;
    amount: Prisma.Decimal;
    statement: {
      entityId: string;
      entityName: string;
      partnerRole: string;
      entityType: string;
    };
  }>
) {
  const occurredAt = new Date();

  for (const row of txRows) {
    const type = row.transactionType as TransactionType;
    if (!isBaseTransactionType(type)) {
      continue;
    }
    const reversalType = REVERSAL_TRANSACTION_TYPE[type];
    const amount = toNumber(row.amount);

    await recordPartnerTransaction({
      partnerId: row.statement.entityId,
      partnerName: row.statement.entityName,
      partnerRole: row.statement.partnerRole as PartnerRole,
      entityType: row.statement.entityType as StatementType,
      transactionType: reversalType,
      amount,
      referenceId: row.referenceId,
      referenceNumber: row.referenceNumber,
      description: `冲销(${type}) - 数据管理`,
      occurredAt,
      metadata: { t: 'dm', task: taskId, src: row.id },
      userId,
      status: 'completed',
    });
  }
}

function affectsTotalAmount(type: TransactionType) {
  return (
    type === 'sale' ||
    type === 'sale_reversal' ||
    type === 'sales_return' ||
    type === 'sales_return_reversal' ||
    type === 'order_cancellation' ||
    type === 'order_cancellation_reversal' ||
    type === 'purchase' ||
    type === 'purchase_reversal'
  );
}

function paidDelta(type: TransactionType, amount: number) {
  switch (type) {
    case 'payment_in':
    case 'payment_out':
    case 'prepayment_in':
    case 'prepayment_out':
    case 'refund_reversal':
      return amount;
    case 'refund':
    case 'payment_in_reversal':
    case 'payment_out_reversal':
    case 'prepayment_in_reversal':
    case 'prepayment_out_reversal':
      return -amount;
    default:
      return 0;
  }
}

function updatesLastPaymentDate(type: TransactionType) {
  return (
    type === 'payment_in' ||
    type === 'payment_out' ||
    type === 'refund' ||
    type === 'payment_in_reversal' ||
    type === 'payment_out_reversal' ||
    type === 'refund_reversal'
  );
}

async function rebuildAccountStatementsForEntityIds(entityIds: string[]) {
  const uniqueIds = Array.from(new Set(entityIds)).filter(Boolean);
  if (uniqueIds.length === 0) {
    return;
  }

  for (const entityId of uniqueIds) {
    const statement = await prisma.accountStatement.findUnique({
      where: { entityId },
      select: { id: true },
    });
    if (!statement) {
      continue;
    }

    const transactions = await prisma.statementTransaction.findMany({
      where: { statementId: statement.id },
      select: {
        transactionType: true,
        direction: true,
        amount: true,
        transactionDate: true,
      },
    });

    const aggregates = transactions.reduce(
      (acc, row) => {
        const amount = toNumber(row.amount);
        const delta = row.direction === 'debit' ? amount : -amount;
        acc.currentBalance += delta;
        if (affectsTotalAmount(row.transactionType as TransactionType)) {
          acc.totalAmount += delta;
        }
        const paid = paidDelta(row.transactionType as TransactionType, amount);
        if (paid !== 0) {
          acc.paidAmount += paid;
        }
        const txDate = new Date(row.transactionDate);
        if (!Number.isNaN(txDate.getTime())) {
          if (!acc.lastTransactionDate || txDate > acc.lastTransactionDate) {
            acc.lastTransactionDate = txDate;
          }
          if (
            updatesLastPaymentDate(row.transactionType as TransactionType) &&
            (!acc.lastPaymentDate || txDate > acc.lastPaymentDate)
          ) {
            acc.lastPaymentDate = txDate;
          }
        }
        return acc;
      },
      {
        currentBalance: 0,
        totalAmount: 0,
        paidAmount: 0,
        lastTransactionDate: null as Date | null,
        lastPaymentDate: null as Date | null,
      }
    );

    await prisma.accountStatement.update({
      where: { entityId },
      data: {
        currentBalance: aggregates.currentBalance,
        totalAmount: aggregates.totalAmount,
        paidAmount: aggregates.paidAmount,
        pendingAmount: Math.abs(aggregates.currentBalance),
        status: aggregates.currentBalance === 0 ? 'settled' : 'active',
        lastTransactionDate: aggregates.lastTransactionDate,
        lastPaymentDate: aggregates.lastPaymentDate,
      },
    });
  }
}

async function verifyStatementTransactionOrphans(): Promise<
  VerificationError[]
> {
  const orphanRules: Array<{
    label: string;
    txTypes: string[];
    table: string;
  }> = [
    {
      label: 'sales_orders',
      txTypes: [
        'sale',
        'sale_reversal',
        'order_cancellation',
        'order_cancellation_reversal',
      ],
      table: 'sales_orders',
    },
    {
      label: 'return_orders',
      txTypes: ['sales_return', 'sales_return_reversal'],
      table: 'return_orders',
    },
    {
      label: 'payment_records',
      txTypes: [
        'payment_in',
        'payment_in_reversal',
        'prepayment_in',
        'prepayment_in_reversal',
        'prepayment_out',
        'prepayment_out_reversal',
      ],
      table: 'payment_records',
    },
    {
      label: 'refund_records',
      txTypes: ['refund', 'refund_reversal'],
      table: 'refund_records',
    },
    {
      label: 'payable_records',
      txTypes: ['purchase', 'purchase_reversal'],
      table: 'payable_records',
    },
    {
      label: 'payment_out_records',
      txTypes: ['payment_out', 'payment_out_reversal'],
      table: 'payment_out_records',
    },
  ];

  const errors: VerificationError[] = [];

  for (const rule of orphanRules) {
    // 使用原生 SQL left join 计数，避免全量拉取 referenceId（清理核验需可扩展）
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>(
      Prisma.sql`
        SELECT COUNT(*) AS count
        FROM statement_transactions st
        LEFT JOIN ${Prisma.raw(rule.table)} t ON t.id = st.reference_id
        WHERE st.transaction_type IN (${Prisma.join(rule.txTypes)})
          AND t.id IS NULL
      `
    );

    const count = toCount(rows?.[0]?.count);
    if (count > 0) {
      errors.push({
        code: 'ORPHAN_TRANSACTION',
        message: `发现孤儿往来流水: ${rule.label} 引用缺失=${count}`,
        details: { table: rule.table, txTypes: rule.txTypes, count },
      });
    }
  }

  return errors;
}

async function verifyAfterRun(
  action: DataManagementAction
): Promise<VerificationResult> {
  const errors: VerificationError[] = [];
  const systemMode = await getSystemMode();
  const now = new Date();

  // CleanupRegistry 强制核验：任何登记实体只要残留即失败
  errors.push(...(await verifyCleanupRegistry({ action, now, systemMode })));

  if (action === 'reset_trial') {
    const [
      salesOrderCount,
      salesOrderItemCount,
      salesOrderFeeItemCount,
      returnOrderCount,
      returnOrderItemCount,
      paymentCount,
      refundCount,
      payableCount,
      paymentOutCount,
      expenseCount,
      purchaseOrderCount,
      purchaseOrderItemCount,
      factoryShipmentOrderCount,
      factoryShipmentOrderItemCount,
      factoryShipmentOrderFeeItemCount,
      shippingQueryCount,
      inboundRecordCount,
      outboundRecordCount,
      inventoryCostQueueCount,
      inventoryCountCount,
      inventoryCountItemCount,
      inventoryAdjustmentCount,
      inventoryOperationCount,
      inventoryCount,
      fifoConsumptionLedgerCount,
      batchSpecificationCount,
      temporaryProductCount,
      productCount,
      categoryCount,
      statementTxCount,
      statementCount,
      prepaymentUsageCount,
      expiredInventoryOps,
    ] = await Promise.all([
      prisma.salesOrder.count(),
      prisma.salesOrderItem.count(),
      prisma.salesOrderFeeItem.count(),
      prisma.returnOrder.count(),
      prisma.returnOrderItem.count(),
      prisma.paymentRecord.count(),
      prisma.refundRecord.count(),
      prisma.payableRecord.count(),
      prisma.paymentOutRecord.count(),
      prisma.expenseRecord.count(),
      prisma.purchaseOrder.count(),
      prisma.purchaseOrderItem.count(),
      prisma.factoryShipmentOrder.count(),
      prisma.factoryShipmentOrderItem.count(),
      prisma.factoryShipmentOrderFeeItem.count(),
      prisma.shippingQuery.count(),
      prisma.inboundRecord.count(),
      prisma.outboundRecord.count(),
      prisma.inventoryCostQueue.count(),
      prisma.inventoryCount.count(),
      prisma.inventoryCountItem.count(),
      prisma.inventoryAdjustment.count(),
      prisma.inventoryOperation.count(),
      prisma.inventory.count(),
      prisma.fifoConsumptionLedger.count(),
      prisma.batchSpecification.count(),
      prisma.temporaryProduct.count(),
      prisma.product.count(),
      prisma.category.count(),
      prisma.statementTransaction.count(),
      prisma.accountStatement.count(),
      prisma.prepaymentUsage.count(),
      prisma.inventoryOperation.count({
        where: { status: 'processing', expiresAt: { lt: now } },
      }),
    ]);

    const residues = [
      ['sales_orders', salesOrderCount],
      ['sales_order_items', salesOrderItemCount],
      ['sales_order_fee_items', salesOrderFeeItemCount],
      ['return_orders', returnOrderCount],
      ['return_order_items', returnOrderItemCount],
      ['payment_records', paymentCount],
      ['refund_records', refundCount],
      ['payable_records', payableCount],
      ['payment_out_records', paymentOutCount],
      ['expense_records', expenseCount],
      ['purchase_orders', purchaseOrderCount],
      ['purchase_order_items', purchaseOrderItemCount],
      ['factory_shipment_orders', factoryShipmentOrderCount],
      ['factory_shipment_order_items', factoryShipmentOrderItemCount],
      ['factory_shipment_order_fee_items', factoryShipmentOrderFeeItemCount],
      ['shipping_queries', shippingQueryCount],
      ['inbound_records', inboundRecordCount],
      ['outbound_records', outboundRecordCount],
      ['inventory_cost_queue', inventoryCostQueueCount],
      ['inventory_counts', inventoryCountCount],
      ['inventory_count_items', inventoryCountItemCount],
      ['inventory_adjustments', inventoryAdjustmentCount],
      ['inventory_operations', inventoryOperationCount],
      ['inventory', inventoryCount],
      ['fifo_consumption_ledger', fifoConsumptionLedgerCount],
      ['batch_specifications', batchSpecificationCount],
      ['temporary_products', temporaryProductCount],
      ['products', productCount],
      ['categories', categoryCount],
      ['statement_transactions', statementTxCount],
      ['account_statements', statementCount],
      ['prepayment_usages', prepaymentUsageCount],
      ['inventory_operations_expired_processing', expiredInventoryOps],
    ] as const;

    for (const [entity, count] of residues) {
      if (count !== 0) {
        errors.push({
          code: 'RESIDUE',
          message: `试用重置后仍存在残留: ${entity}=${count}`,
          details: { entity, count },
        });
      }
    }

    // 试用重置后：核心报表/概览必须归零（否则视为仍有数据残留或缓存未清）
    try {
      const [overview, profitLoss, monthly, annual] = await Promise.all([
        getFinanceOverview(),
        getProfitLossAnalysis(
          new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0],
          now.toISOString().split('T')[0],
          'day',
          false
        ),
        getMonthlyReport(now.getFullYear(), now.getMonth() + 1, false),
        getAnnualReport(now.getFullYear(), false),
      ]);

      const reportResidues = [
        ['overview.totalReceivable', overview.totalReceivable],
        ['overview.totalRefundable', overview.totalRefundable],
        ['overview.monthlyReceived', overview.monthlyReceived],
        ['profitLoss.revenue.totalRevenue', profitLoss.revenue.totalRevenue],
        ['profitLoss.costs.totalCost', profitLoss.costs.totalCost],
        [
          'profitLoss.expenses.totalExpenses',
          profitLoss.expenses.totalExpenses,
        ],
        ['profitLoss.profit.netProfit', profitLoss.profit.netProfit],
        ['monthly.revenue.salesRevenue', monthly.revenue.salesRevenue],
        ['monthly.expenses.totalExpenses', monthly.expenses.totalExpenses],
        ['monthly.costs.totalCost', monthly.costs.totalCost],
        ['monthly.profit.netProfit', monthly.profit.netProfit],
        ['annual.summary.totalRevenue', annual.summary.totalRevenue],
        ['annual.summary.totalExpenses', annual.summary.totalExpenses],
        ['annual.summary.totalCost', annual.summary.totalCost],
        ['annual.summary.totalProfit', annual.summary.totalProfit],
      ] as const;

      for (const [field, value] of reportResidues) {
        if (Math.abs(value) > 0.001) {
          errors.push({
            code: 'REPORT_RESIDUE',
            message: `试用重置后报表仍不为 0: ${field}=${value}`,
            details: { field, value },
          });
        }
      }
    } catch (error) {
      errors.push({
        code: 'REPORT_ERROR',
        message: '试用重置后报表核验失败（报表服务报错）',
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  if (action === 'cleanup_test') {
    const [
      salesOrderActive,
      returnOrderActive,
      paymentActive,
      refundActive,
      payableActive,
      paymentOutActive,
      expenseActive,
      expiredInventoryOps,
    ] = await Promise.all([
      prisma.salesOrder.count({
        where: { dataTag: 'test', voidedAt: null } as any,
      }),
      prisma.returnOrder.count({
        where: { dataTag: 'test', voidedAt: null } as any,
      }),
      prisma.paymentRecord.count({
        where: { dataTag: 'test', voidedAt: null } as any,
      }),
      prisma.refundRecord.count({
        where: { dataTag: 'test', voidedAt: null } as any,
      }),
      prisma.payableRecord.count({
        where: { dataTag: 'test', voidedAt: null } as any,
      }),
      prisma.paymentOutRecord.count({
        where: { dataTag: 'test', voidedAt: null } as any,
      }),
      prisma.expenseRecord.count({
        where: { dataTag: 'test', voidedAt: null } as any,
      }),
      prisma.inventoryOperation.count({
        where: { status: 'processing', expiresAt: { lt: now } },
      }),
    ]);

    const residues = [
      ['sales_orders_active_test', salesOrderActive],
      ['return_orders_active_test', returnOrderActive],
      ['payment_records_active_test', paymentActive],
      ['refund_records_active_test', refundActive],
      ['payable_records_active_test', payableActive],
      ['payment_out_records_active_test', paymentOutActive],
      ['expense_records_active_test', expenseActive],
      ['inventory_operations_expired_processing', expiredInventoryOps],
    ] as const;

    for (const [entity, count] of residues) {
      if (count !== 0) {
        errors.push({
          code: 'RESIDUE',
          message: `清理测试数据后仍存在残留: ${entity}=${count}`,
          details: { entity, count },
        });
      }
    }

    if (systemMode !== 'production') {
      errors.push({
        code: 'MODE_MISMATCH',
        message: `系统模式异常: 期望 production，实际 ${systemMode}`,
      });
    }

    // 清理后预览应归零（幂等核验）
    try {
      const preview = await buildPreview(action);
      if (preview.totals.count !== 0) {
        errors.push({
          code: 'IDEMPOTENCY',
          message: `清理测试数据后再次预览仍有数量: count=${preview.totals.count}`,
          details: preview,
        });
      }
    } catch (error) {
      errors.push({
        code: 'IDEMPOTENCY_ERROR',
        message: '清理测试数据后幂等预览核验失败（预览接口报错）',
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }

    // 若系统中不存在任何有效 prod 单据，则对外可见报表必须归零
    try {
      const [
        prodSales,
        prodReturns,
        prodPayments,
        prodRefunds,
        prodPayables,
        prodPaymentOuts,
        prodExpenses,
      ] = await Promise.all([
        prisma.salesOrder.count({
          where: { dataTag: 'prod', voidedAt: null } as any,
        }),
        prisma.returnOrder.count({
          where: { dataTag: 'prod', voidedAt: null } as any,
        }),
        prisma.paymentRecord.count({
          where: { dataTag: 'prod', voidedAt: null } as any,
        }),
        prisma.refundRecord.count({
          where: { dataTag: 'prod', voidedAt: null } as any,
        }),
        prisma.payableRecord.count({
          where: { dataTag: 'prod', voidedAt: null } as any,
        }),
        prisma.paymentOutRecord.count({
          where: { dataTag: 'prod', voidedAt: null } as any,
        }),
        prisma.expenseRecord.count({
          where: { dataTag: 'prod', voidedAt: null } as any,
        }),
      ]);

      const hasProdData =
        prodSales +
          prodReturns +
          prodPayments +
          prodRefunds +
          prodPayables +
          prodPaymentOuts +
          prodExpenses >
        0;

      if (!hasProdData) {
        const [overview, profitLoss, monthly, annual] = await Promise.all([
          getFinanceOverview(),
          getProfitLossAnalysis(
            new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0],
            now.toISOString().split('T')[0],
            'day',
            false
          ),
          getMonthlyReport(now.getFullYear(), now.getMonth() + 1, false),
          getAnnualReport(now.getFullYear(), false),
        ]);

        const reportResidues = [
          ['overview.totalReceivable', overview.totalReceivable],
          ['overview.totalRefundable', overview.totalRefundable],
          ['overview.monthlyReceived', overview.monthlyReceived],
          ['profitLoss.revenue.totalRevenue', profitLoss.revenue.totalRevenue],
          ['profitLoss.costs.totalCost', profitLoss.costs.totalCost],
          [
            'profitLoss.expenses.totalExpenses',
            profitLoss.expenses.totalExpenses,
          ],
          ['profitLoss.profit.netProfit', profitLoss.profit.netProfit],
          ['monthly.revenue.salesRevenue', monthly.revenue.salesRevenue],
          ['monthly.expenses.totalExpenses', monthly.expenses.totalExpenses],
          ['monthly.costs.totalCost', monthly.costs.totalCost],
          ['monthly.profit.netProfit', monthly.profit.netProfit],
          ['annual.summary.totalRevenue', annual.summary.totalRevenue],
          ['annual.summary.totalExpenses', annual.summary.totalExpenses],
          ['annual.summary.totalCost', annual.summary.totalCost],
          ['annual.summary.totalProfit', annual.summary.totalProfit],
        ] as const;

        for (const [field, value] of reportResidues) {
          if (Math.abs(value) > 0.001) {
            errors.push({
              code: 'REPORT_RESIDUE',
              message: `清理测试数据后（无 prod 数据）报表仍不为 0: ${field}=${value}`,
              details: { field, value },
            });
          }
        }

        // 台账非零核验（无 prod 数据时必须全部归零）
        const nonZeroStatements = await prisma.accountStatement.count({
          where: {
            currentBalance: { not: 0 },
          },
        });
        if (nonZeroStatements !== 0) {
          errors.push({
            code: 'LEDGER_RESIDUE',
            message: `清理测试数据后（无 prod 数据）仍存在余额不为 0 的台账: ${nonZeroStatements}`,
            details: { nonZeroStatements },
          });
        }
      }
    } catch (error) {
      errors.push({
        code: 'REPORT_ERROR',
        message: '清理测试数据后报表核验失败（报表服务报错）',
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  try {
    errors.push(...(await verifyStatementTransactionOrphans()));
  } catch (error) {
    errors.push({
      code: 'ORPHAN_CHECK_ERROR',
      message: '孤儿流水核验失败（SQL 执行失败）',
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }

  return { ok: errors.length === 0, errors };
}

export async function runDataManagementTask(taskId: string) {
  const task = await prisma.dataManagementTask.findUnique({
    where: { id: taskId },
  });
  if (!task) {
    return;
  }

  const action = task.action as DataManagementAction;
  const userId = task.requestedBy;
  const scope = parseJson<{
    ipAddress?: string | null;
    userAgent?: string | null;
  }>(task.scope);
  const ipAddress = scope?.ipAddress ?? null;
  const userAgent = scope?.userAgent ?? null;

  const updated = await prisma.dataManagementTask.updateMany({
    where: { id: taskId, status: 'queued' },
    data: { status: 'running', startedAt: new Date(), stage: 'S0' },
  });
  if (updated.count === 0) {
    return;
  }

  try {
    const systemMode = await getSystemMode();
    assertActionAllowedForMode(action, systemMode);

    const lock = buildWriteLock(taskId, userId, action);
    await setSystemWriteLock(lock);
    await writeSystemLog(
      taskId,
      userId,
      action,
      'info',
      '数据管理任务开始',
      {
        taskId,
        action,
      },
      ipAddress,
      userAgent
    );

    // 预览统计可能非常耗时（大表 COUNT/SUM），执行阶段优先保证“尽快开始清理”，
    // 预览快照可由前端在执行前调用 /preview 并随执行请求传入（存入 task.preview）。
    await prisma.dataManagementTask.update({
      where: { id: taskId },
      data: { stage: 'S1' },
    });

    const now = new Date();
    const cleanupContext: CleanupExecuteContext = {
      taskId,
      userId,
      action,
      now,
      affectedEntityIds: new Set<string>(),
    };

    // S1: 关联/中间表 + 过期幂等锁
    await cleanupExpiredInventoryOperations(now);
    await executeCleanupStage('S1', cleanupContext);

    await updateTask(taskId, { stage: 'S2' });

    await executeCleanupStage('S2', cleanupContext);

    await updateTask(taskId, { stage: 'S3' });
    await executeCleanupStage('S3', cleanupContext);

    await updateTask(taskId, { stage: 'S4' });
    await executeCleanupStage('S4', cleanupContext);

    await updateTask(taskId, { stage: 'S5' });

    await Promise.allSettled([
      clearAllFinanceCache(),
      clearAllInventoryCache(),
      clearAllProductCache(),
      invalidateReportCache(),
      revalidateSalesOrders(),
      revalidateReturnOrders(),
      revalidateFinance(),
    ]);

    const verification = await verifyAfterRun(action);
    if (!verification.ok) {
      await updateTask(taskId, {
        status: 'failed',
        result: serialiseJson({ verification }),
        errorMessage: '核验失败：发现残留数据',
        finishedAt: new Date(),
        stage: 'S6',
      });
      await writeSystemLog(
        taskId,
        userId,
        action,
        'error',
        '数据管理任务失败：核验未通过',
        {
          taskId,
          action,
          verification,
        },
        ipAddress,
        userAgent
      );
      return;
    }

    await updateTask(taskId, {
      status: 'completed',
      result: serialiseJson({ verification }),
      finishedAt: new Date(),
      stage: 'S6',
    });

    await writeSystemLog(
      taskId,
      userId,
      action,
      'info',
      '数据管理任务完成',
      {
        taskId,
        action,
        verification,
      },
      ipAddress,
      userAgent
    );
  } catch (error) {
    await markTaskFailed(taskId, error);
    await writeSystemLog(
      taskId,
      userId,
      action,
      'error',
      '数据管理任务异常终止',
      {
        taskId,
        action,
        error: error instanceof Error ? error.message : String(error),
      },
      ipAddress,
      userAgent
    );
  } finally {
    await clearSystemWriteLock(taskId);
  }
}
