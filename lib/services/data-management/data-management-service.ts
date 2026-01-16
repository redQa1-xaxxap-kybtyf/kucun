import { Prisma } from '@prisma/client';

import {
  revalidateFinance,
  revalidateReturnOrders,
  revalidateSalesOrders,
} from '@/lib/cache';
import { clearAllFinanceCache, invalidateReportCache } from '@/lib/cache/finance-cache';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { recordPartnerTransaction } from '@/lib/services/partner-ledger-service';
import { getSystemMode } from '@/lib/services/system-mode-service';
import { clearSystemWriteLock, setSystemWriteLock, type SystemWriteLock } from '@/lib/services/system-write-lock';
import type { PartnerRole, StatementType, TransactionType } from '@/lib/types/statement';
import { toNumber } from '@/lib/utils/number';

export type DataManagementAction = 'reset_trial' | 'cleanup_test';
export type DataManagementStage = 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6';
export type DataManagementStatus = 'queued' | 'running' | 'completed' | 'failed';

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

const BASE_TRANSACTION_TYPES = Object.keys(
  REVERSAL_TRANSACTION_TYPE
) as Array<Exclude<TransactionType, `${string}_reversal`>>;

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
    finishedAt: task.finishedAt ? new Date(task.finishedAt).toISOString() : null,
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

async function buildPreview(action: DataManagementAction): Promise<DataManagementPreview> {
  const systemMode = await getSystemMode();
  if (action === 'reset_trial' && systemMode !== 'trial') {
    throw new Error('当前为正式账套，禁止重置试用数据');
  }
  if (action === 'cleanup_test' && systemMode !== 'production') {
    throw new Error('当前为试用账套，仅允许重置试用数据');
  }

  const isTrialReset = action === 'reset_trial';
  const baseWhere = isTrialReset
    ? undefined
    : ({
        dataTag: 'test',
      } satisfies Record<string, unknown>);

  const [
    salesOrderAgg,
    returnOrderAgg,
    paymentAgg,
    refundAgg,
    purchaseAgg,
    factoryShipmentAgg,
    payableAgg,
    paymentOutAgg,
    expenseAgg,
  ] = await Promise.all([
    prisma.salesOrder.aggregate({
      where: isTrialReset ? undefined : ({ ...baseWhere, voidedAt: null } as any),
      _count: { id: true },
      _sum: { totalAmount: true },
    }),
    prisma.returnOrder.aggregate({
      where: isTrialReset ? undefined : ({ ...baseWhere, voidedAt: null } as any),
      _count: { id: true },
      _sum: { refundAmount: true, totalAmount: true },
    }),
    prisma.paymentRecord.aggregate({
      where: isTrialReset ? undefined : ({ ...baseWhere, voidedAt: null } as any),
      _count: { id: true },
      _sum: { paymentAmount: true },
    }),
    prisma.refundRecord.aggregate({
      where: isTrialReset ? undefined : ({ ...baseWhere, voidedAt: null } as any),
      _count: { id: true },
      _sum: { refundAmount: true, processedAmount: true },
    }),
    prisma.purchaseOrder.aggregate({
      where: isTrialReset ? undefined : ({ ...baseWhere, voidedAt: null } as any),
      _count: { id: true },
      _sum: { totalAmount: true },
    }),
    prisma.factoryShipmentOrder.aggregate({
      where: isTrialReset ? undefined : ({ ...baseWhere, voidedAt: null } as any),
      _count: { id: true },
      _sum: { receivableAmount: true },
    }),
    prisma.payableRecord.aggregate({
      where: isTrialReset ? undefined : ({ ...baseWhere, voidedAt: null } as any),
      _count: { id: true },
      _sum: { payableAmount: true },
    }),
    prisma.paymentOutRecord.aggregate({
      where: isTrialReset ? undefined : ({ ...baseWhere, voidedAt: null } as any),
      _count: { id: true },
      _sum: { paymentAmount: true },
    }),
    prisma.expenseRecord.aggregate({
      where: isTrialReset ? undefined : ({ ...baseWhere, voidedAt: null } as any),
      _count: { id: true },
      _sum: { expenseAmount: true },
    }),
  ]);

  const items: DataManagementPreviewItem[] = [
    {
      id: 'sales_orders',
      label: '销售订单',
      count: salesOrderAgg._count.id ?? 0,
      amountSum: toNumber(salesOrderAgg._sum.totalAmount),
    },
    {
      id: 'return_orders',
      label: '退货订单',
      count: returnOrderAgg._count.id ?? 0,
      amountSum: toNumber(
        returnOrderAgg._sum.refundAmount ?? returnOrderAgg._sum.totalAmount
      ),
    },
    {
      id: 'payment_records',
      label: '收款记录',
      count: paymentAgg._count.id ?? 0,
      amountSum: toNumber(paymentAgg._sum.paymentAmount),
    },
    {
      id: 'refund_records',
      label: '退款记录',
      count: refundAgg._count.id ?? 0,
      amountSum: toNumber(refundAgg._sum.processedAmount ?? refundAgg._sum.refundAmount),
    },
    {
      id: 'purchase_orders',
      label: '仓库进货',
      count: purchaseAgg._count.id ?? 0,
      amountSum: toNumber(purchaseAgg._sum.totalAmount),
    },
    {
      id: 'factory_shipment_orders',
      label: '厂家发货/客户直发',
      count: factoryShipmentAgg._count.id ?? 0,
      amountSum: toNumber(factoryShipmentAgg._sum.receivableAmount),
    },
    {
      id: 'payable_records',
      label: '应付货款',
      count: payableAgg._count.id ?? 0,
      amountSum: toNumber(payableAgg._sum.payableAmount),
    },
    {
      id: 'payment_out_records',
      label: '付款记录',
      count: paymentOutAgg._count.id ?? 0,
      amountSum: toNumber(paymentOutAgg._sum.paymentAmount),
    },
    {
      id: 'expense_records',
      label: '费用记录',
      count: expenseAgg._count.id ?? 0,
      amountSum: toNumber(expenseAgg._sum.expenseAmount),
    },
  ];

  if (action === 'cleanup_test') {
    const [orderIds, returnIds, paymentIds, refundIds, payableIds, paymentOutIds] =
      await Promise.all([
        prisma.salesOrder.findMany({ where: { dataTag: 'test' }, select: { id: true }, take: 100000 }),
        prisma.returnOrder.findMany({ where: { dataTag: 'test' }, select: { id: true }, take: 100000 }),
        prisma.paymentRecord.findMany({ where: { dataTag: 'test' }, select: { id: true }, take: 100000 }),
        prisma.refundRecord.findMany({ where: { dataTag: 'test' }, select: { id: true }, take: 100000 }),
        prisma.payableRecord.findMany({ where: { dataTag: 'test' }, select: { id: true }, take: 100000 }),
        prisma.paymentOutRecord.findMany({ where: { dataTag: 'test' }, select: { id: true }, take: 100000 }),
      ]);

    const missingCounts = await Promise.all([
      computeReversalMissingCountForReferenceIds('sale', orderIds.map(r => r.id)),
      computeReversalMissingCountForReferenceIds('order_cancellation', orderIds.map(r => r.id)),
      computeReversalMissingCountForReferenceIds('sales_return', returnIds.map(r => r.id)),
      computeReversalMissingCountForReferenceIds('payment_in', paymentIds.map(r => r.id)),
      computeReversalMissingCountForReferenceIds('prepayment_in', paymentIds.map(r => r.id)),
      computeReversalMissingCountForReferenceIds('refund', refundIds.map(r => r.id)),
      computeReversalMissingCountForReferenceIds('purchase', payableIds.map(r => r.id)),
      computeReversalMissingCountForReferenceIds('payment_out', paymentOutIds.map(r => r.id)),
    ]);

    items.push({
      id: 'statement_transactions_to_reverse',
      label: '往来流水（待冲销分录数）',
      count: missingCounts.reduce((acc, v) => acc + v, 0),
    });
  } else {
    const [statementTxCount, statementCount] = await Promise.all([
      prisma.statementTransaction.count(),
      prisma.accountStatement.count(),
    ]);
    items.push(
      { id: 'statement_transactions', label: '往来流水', count: statementTxCount },
      { id: 'account_statements', label: '往来台账', count: statementCount }
    );
  }

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
}) {
  const { action, requestedBy, idempotencyKey, scope } = input;
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
    },
  });
  return toDTO(created);
}

export async function getDataManagementTask(taskId: string) {
  const task = await prisma.dataManagementTask.findUnique({ where: { id: taskId } });
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
  metadata?: Record<string, unknown>
) {
  try {
    await prisma.systemLog.create({
      data: {
        type: 'system_event',
        level,
        action: `data-management:${action}`,
        description: description.slice(0, 191),
        userId,
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

async function verifyAfterRun(action: DataManagementAction): Promise<VerificationResult> {
  const errors: VerificationError[] = [];
  const systemMode = await getSystemMode();

  if (action === 'reset_trial') {
    const [
      salesOrderCount,
      returnOrderCount,
      paymentCount,
      refundCount,
      payableCount,
      paymentOutCount,
      expenseCount,
      statementTxCount,
      statementCount,
      prepaymentUsageCount,
      expiredInventoryOps,
    ] = await Promise.all([
      prisma.salesOrder.count(),
      prisma.returnOrder.count(),
      prisma.paymentRecord.count(),
      prisma.refundRecord.count(),
      prisma.payableRecord.count(),
      prisma.paymentOutRecord.count(),
      prisma.expenseRecord.count(),
      prisma.statementTransaction.count(),
      prisma.accountStatement.count(),
      prisma.prepaymentUsage.count(),
      prisma.inventoryOperation.count({
        where: { status: 'processing', expiresAt: { lt: new Date() } },
      }),
    ]);

    const residues = [
      ['sales_orders', salesOrderCount],
      ['return_orders', returnOrderCount],
      ['payment_records', paymentCount],
      ['refund_records', refundCount],
      ['payable_records', payableCount],
      ['payment_out_records', paymentOutCount],
      ['expense_records', expenseCount],
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
      prisma.salesOrder.count({ where: { dataTag: 'test', voidedAt: null } as any }),
      prisma.returnOrder.count({ where: { dataTag: 'test', voidedAt: null } as any }),
      prisma.paymentRecord.count({ where: { dataTag: 'test', voidedAt: null } as any }),
      prisma.refundRecord.count({ where: { dataTag: 'test', voidedAt: null } as any }),
      prisma.payableRecord.count({ where: { dataTag: 'test', voidedAt: null } as any }),
      prisma.paymentOutRecord.count({ where: { dataTag: 'test', voidedAt: null } as any }),
      prisma.expenseRecord.count({ where: { dataTag: 'test', voidedAt: null } as any }),
      prisma.inventoryOperation.count({
        where: { status: 'processing', expiresAt: { lt: new Date() } },
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
  }

  return { ok: errors.length === 0, errors };
}

export async function runDataManagementTask(taskId: string) {
  const task = await prisma.dataManagementTask.findUnique({ where: { id: taskId } });
  if (!task) {
    return;
  }

  const action = task.action as DataManagementAction;
  const userId = task.requestedBy;

  const updated = await prisma.dataManagementTask.updateMany({
    where: { id: taskId, status: 'queued' },
    data: { status: 'running', startedAt: new Date(), stage: 'S0' },
  });
  if (updated.count === 0) {
    return;
  }

  const lock = buildWriteLock(taskId, userId, action);
  await setSystemWriteLock(lock);
  await writeSystemLog(taskId, userId, action, 'info', '数据管理任务开始', {
    taskId,
    action,
  });

  try {
    const preview = await buildPreview(action);
    await prisma.dataManagementTask.update({
      where: { id: taskId },
      data: { preview: serialiseJson(preview), stage: 'S1' },
    });

    const now = new Date();

    // S1: 关联/中间表 + 过期幂等锁
    await cleanupExpiredInventoryOperations(now);

    if (action === 'cleanup_test') {
      const [paymentIds, salesOrderIds] = await Promise.all([
        prisma.paymentRecord.findMany({
          where: { dataTag: 'test' },
          select: { id: true },
          take: 100000,
        }),
        prisma.salesOrder.findMany({
          where: { dataTag: 'test' },
          select: { id: true },
          take: 100000,
        }),
      ]);

      const paymentIdList = paymentIds.map(row => row.id);
      const salesOrderIdList = salesOrderIds.map(row => row.id);

      await prisma.prepaymentUsage.deleteMany({
        where: {
          OR: [
            paymentIdList.length > 0
              ? { paymentRecordId: { in: paymentIdList } }
              : undefined,
            salesOrderIdList.length > 0
              ? { salesOrderId: { in: salesOrderIdList } }
              : undefined,
          ].filter(Boolean) as any,
        },
      });
    } else {
      await prisma.prepaymentUsage.deleteMany();
    }

    await updateTask(taskId, { stage: 'S2' });

    // S2: 业务主表（trial=delete，production=test=void）
    if (action === 'reset_trial') {
      await prisma.statementTransaction.deleteMany();
      await prisma.accountStatement.deleteMany();

      await prisma.refundRecord.deleteMany();
      await prisma.paymentRecord.deleteMany();
      await prisma.paymentOutRecord.deleteMany();
      await prisma.expenseRecord.deleteMany();
      await prisma.payableRecord.deleteMany();
      await prisma.returnOrder.deleteMany();
      await prisma.factoryShipmentOrder.deleteMany();
      await prisma.purchaseOrder.deleteMany();
      await prisma.salesOrder.deleteMany();
    } else {
      const voidData = {
        voidedAt: now,
        voidedBy: userId,
        voidReason: 'test_cleanup',
      };

      await Promise.all([
        prisma.salesOrder.updateMany({
          where: { dataTag: 'test', voidedAt: null } as any,
          data: voidData as any,
        }),
        prisma.returnOrder.updateMany({
          where: { dataTag: 'test', voidedAt: null } as any,
          data: voidData as any,
        }),
        prisma.paymentRecord.updateMany({
          where: { dataTag: 'test', voidedAt: null } as any,
          data: voidData as any,
        }),
        prisma.refundRecord.updateMany({
          where: { dataTag: 'test', voidedAt: null } as any,
          data: voidData as any,
        }),
        prisma.purchaseOrder.updateMany({
          where: { dataTag: 'test', voidedAt: null } as any,
          data: voidData as any,
        }),
        prisma.factoryShipmentOrder.updateMany({
          where: { dataTag: 'test', voidedAt: null } as any,
          data: voidData as any,
        }),
        prisma.payableRecord.updateMany({
          where: { dataTag: 'test', voidedAt: null } as any,
          data: voidData as any,
        }),
        prisma.paymentOutRecord.updateMany({
          where: { dataTag: 'test', voidedAt: null } as any,
          data: voidData as any,
        }),
        prisma.expenseRecord.updateMany({
          where: { dataTag: 'test', voidedAt: null } as any,
          data: voidData as any,
        }),
      ]);
    }

    await updateTask(taskId, { stage: 'S3' });

    // S3: 往来流水冲销（仅 production cleanup_test）
    const affectedEntityIds = new Set<string>();

    if (action === 'cleanup_test') {
      const [orderIds, returnIds, paymentIds, refundIds, payableIds, paymentOutIds] =
        await Promise.all([
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

      const queryGroups: Array<{
        referenceIds: string[];
        types: TransactionType[];
      }> = [
        {
          referenceIds: orderIds.map(r => r.id),
          types: ['sale', 'order_cancellation'],
        },
        {
          referenceIds: returnIds.map(r => r.id),
          types: ['sales_return'],
        },
        {
          referenceIds: paymentIds.map(r => r.id),
          types: ['payment_in', 'prepayment_in', 'prepayment_out'],
        },
        {
          referenceIds: refundIds.map(r => r.id),
          types: ['refund'],
        },
        {
          referenceIds: payableIds.map(r => r.id),
          types: ['purchase'],
        },
        {
          referenceIds: paymentOutIds.map(r => r.id),
          types: ['payment_out'],
        },
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

        await reverseTransactionsForRows(taskId, userId, txRows as any);
      }
    }

    await updateTask(taskId, { stage: 'S4' });

    if (action === 'cleanup_test') {
      await rebuildAccountStatementsForEntityIds(Array.from(affectedEntityIds));
    }

    await updateTask(taskId, { stage: 'S5' });

    await Promise.allSettled([
      clearAllFinanceCache(),
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
      await writeSystemLog(taskId, userId, action, 'error', '数据管理任务失败：核验未通过', {
        taskId,
        action,
        verification,
      });
      return;
    }

    await updateTask(taskId, {
      status: 'completed',
      result: serialiseJson({ verification }),
      finishedAt: new Date(),
      stage: 'S6',
    });

    await writeSystemLog(taskId, userId, action, 'info', '数据管理任务完成', {
      taskId,
      action,
      verification,
    });
  } catch (error) {
    await markTaskFailed(taskId, error);
    await writeSystemLog(taskId, userId, action, 'error', '数据管理任务异常终止', {
      taskId,
      action,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await clearSystemWriteLock(taskId);
  }
}
