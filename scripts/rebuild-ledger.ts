/* eslint-disable no-console */
import fs from 'node:fs/promises';
import path from 'node:path';

import { prisma } from '../lib/db';
import { recordPartnerTransaction } from '../lib/services/partner-ledger-service';
import type {
  PartnerRole,
  StatementType,
  TransactionType,
} from '../lib/types/statement';
import { toNumber } from '../lib/utils/number';

const SCRIPT_QUERY_BATCH_SIZE = 1000;

type LedgerEvent = {
  partnerId: string;
  partnerRole: PartnerRole;
  entityType: StatementType;
  transactionType: TransactionType;
  amount: number;
  referenceId: string;
  referenceNumber?: string;
  description: string;
  occurredAt: Date;
  dueDate?: Date;
  status?: 'pending' | 'completed' | 'overdue';
  metadata?: Record<string, unknown>;
};

function toDate(value: Date | string | null | undefined): Date {
  if (!value) {
    return new Date();
  }
  return value instanceof Date ? value : new Date(value);
}

function buildLedgerEventCounters(events: LedgerEvent[]) {
  const counters = new Map<TransactionType, number>();
  for (const event of events) {
    counters.set(
      event.transactionType,
      (counters.get(event.transactionType) ?? 0) + 1
    );
  }
  return Object.fromEntries(counters.entries());
}

async function collectSalesOrderEvents(): Promise<LedgerEvent[]> {
  const events: LedgerEvent[] = [];
  let cursor: string | undefined;

  while (true) {
    const orders = await prisma.salesOrder.findMany({
      select: {
        id: true,
        orderNumber: true,
        customerId: true,
        totalAmount: true,
        createdAt: true,
        status: true,
      },
      where: {
        status: { in: ['confirmed', 'shipped', 'completed'] },
      },
      orderBy: {
        id: 'asc',
      },
      take: SCRIPT_QUERY_BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    if (orders.length === 0) {
      break;
    }

    for (const order of orders) {
      if (!order.customerId || toNumber(order.totalAmount, 0) <= 0) {
        continue;
      }

      events.push({
        partnerId: order.customerId,
        partnerRole: 'customer' as PartnerRole,
        entityType: 'customer' as StatementType,
        transactionType: 'sale' as TransactionType,
        amount: toNumber(order.totalAmount, 0),
        referenceId: order.id,
        referenceNumber: order.orderNumber,
        description: '销售订单',
        occurredAt: toDate(order.createdAt),
        metadata: {
          source: 'sales_order',
          status: order.status,
        },
      });
    }

    cursor = orders[orders.length - 1].id;
  }

  return events;
}

async function collectReturnOrderEvents(): Promise<LedgerEvent[]> {
  const events: LedgerEvent[] = [];
  let cursor: string | undefined;

  while (true) {
    const returnOrders = await prisma.returnOrder.findMany({
      select: {
        id: true,
        returnNumber: true,
        customerId: true,
        refundAmount: true,
        totalAmount: true,
        completedAt: true,
        createdAt: true,
        status: true,
      },
      where: {
        status: { in: ['approved', 'processing', 'completed'] },
      },
      orderBy: {
        id: 'asc',
      },
      take: SCRIPT_QUERY_BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    if (returnOrders.length === 0) {
      break;
    }

    for (const order of returnOrders) {
      if (!order.customerId || (!order.refundAmount && !order.totalAmount)) {
        continue;
      }

      events.push({
        partnerId: order.customerId,
        partnerRole: 'customer' as PartnerRole,
        entityType: 'customer' as StatementType,
        transactionType: 'sales_return' as TransactionType,
        amount: toNumber(order.refundAmount ?? order.totalAmount ?? 0, 0),
        referenceId: order.id,
        referenceNumber: order.returnNumber,
        description: '销售退货',
        occurredAt: toDate(order.completedAt || order.createdAt),
        metadata: {
          source: 'return_order',
          status: order.status,
        },
      });
    }

    cursor = returnOrders[returnOrders.length - 1].id;
  }

  return events;
}

async function collectPaymentRecordEvents(): Promise<LedgerEvent[]> {
  const events: LedgerEvent[] = [];
  let cursor: string | undefined;

  while (true) {
    const payments = await prisma.paymentRecord.findMany({
      select: {
        id: true,
        paymentNumber: true,
        customerId: true,
        paymentAmount: true,
        paymentDate: true,
        paymentType: true,
        status: true,
        salesOrderId: true,
      },
      where: {
        status: { in: ['confirmed', 'applied'] },
      },
      orderBy: {
        id: 'asc',
      },
      take: SCRIPT_QUERY_BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    if (payments.length === 0) {
      break;
    }

    for (const payment of payments) {
      if (!payment.customerId || Number(payment.paymentAmount ?? 0) <= 0) {
        continue;
      }

      events.push({
        partnerId: payment.customerId,
        partnerRole: 'customer' as PartnerRole,
        entityType: 'customer' as StatementType,
        transactionType:
          payment.paymentType === 'prepayment'
            ? ('prepayment_in' as TransactionType)
            : ('payment_in' as TransactionType),
        amount: Number(payment.paymentAmount ?? 0),
        referenceId: payment.id,
        referenceNumber: payment.paymentNumber,
        description: payment.paymentType === 'prepayment' ? '预收款' : '订单收款',
        occurredAt: toDate(payment.paymentDate),
        metadata: {
          source: 'payment_record',
          paymentType: payment.paymentType,
          salesOrderId: payment.salesOrderId,
        },
      });
    }

    cursor = payments[payments.length - 1].id;
  }

  return events;
}

async function collectRefundRecordEvents(): Promise<LedgerEvent[]> {
  const events: LedgerEvent[] = [];
  let cursor: string | undefined;

  while (true) {
    const refunds = await prisma.refundRecord.findMany({
      select: {
        id: true,
        refundNumber: true,
        customerId: true,
        refundAmount: true,
        refundDate: true,
        status: true,
        reason: true,
      },
      where: {
        status: { in: ['completed', 'processing', 'pending'] },
      },
      orderBy: {
        id: 'asc',
      },
      take: SCRIPT_QUERY_BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    if (refunds.length === 0) {
      break;
    }

    for (const refund of refunds) {
      if (!refund.customerId || Number(refund.refundAmount ?? 0) <= 0) {
        continue;
      }

      events.push({
        partnerId: refund.customerId,
        partnerRole: 'customer' as PartnerRole,
        entityType: 'customer' as StatementType,
        transactionType: 'refund' as TransactionType,
        amount: Number(refund.refundAmount ?? 0),
        referenceId: refund.id,
        referenceNumber: refund.refundNumber,
        description: `退款 - ${refund.reason ?? '销售退款'}`,
        occurredAt: toDate(refund.refundDate),
        status: refund.status === 'completed' ? 'completed' : 'pending',
        metadata: {
          source: 'refund_record',
          status: refund.status,
        },
      });
    }

    cursor = refunds[refunds.length - 1].id;
  }

  return events;
}

async function collectPayableRecordEvents(): Promise<LedgerEvent[]> {
  const events: LedgerEvent[] = [];
  let cursor: string | undefined;

  while (true) {
    const payables = await prisma.payableRecord.findMany({
      select: {
        id: true,
        payableNumber: true,
        supplierId: true,
        payableAmount: true,
        sourceType: true,
        sourceNumber: true,
        createdAt: true,
        dueDate: true,
        status: true,
      },
      where: {
        payableAmount: { gt: 0 },
      },
      orderBy: {
        id: 'asc',
      },
      take: SCRIPT_QUERY_BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    if (payables.length === 0) {
      break;
    }

    for (const payable of payables) {
      if (
        typeof payable.supplierId !== 'string' ||
        payable.supplierId.length === 0
      ) {
        continue;
      }

      events.push({
        partnerId: payable.supplierId,
        partnerRole: 'supplier' as PartnerRole,
        entityType: 'supplier' as StatementType,
        transactionType: 'purchase' as TransactionType,
        amount: Number(payable.payableAmount ?? 0),
        referenceId: payable.id,
        referenceNumber:
          payable.payableNumber ?? payable.sourceNumber ?? undefined,
        description: `采购账款 - ${payable.sourceType ?? '其他'}`,
        occurredAt: toDate(payable.createdAt),
        dueDate: payable.dueDate ? toDate(payable.dueDate) : undefined,
        metadata: {
          source: 'payable_record',
          status: payable.status,
          sourceType: payable.sourceType,
        },
      });
    }

    cursor = payables[payables.length - 1].id;
  }

  return events;
}

async function collectPaymentOutRecordEvents(): Promise<LedgerEvent[]> {
  const events: LedgerEvent[] = [];
  let cursor: string | undefined;

  while (true) {
    const payments = await prisma.paymentOutRecord.findMany({
      select: {
        id: true,
        paymentNumber: true,
        supplierId: true,
        paymentAmount: true,
        paymentDate: true,
        status: true,
        payableRecordId: true,
      },
      where: {
        status: { in: ['confirmed', 'pending'] },
      },
      orderBy: {
        id: 'asc',
      },
      take: SCRIPT_QUERY_BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    if (payments.length === 0) {
      break;
    }

    for (const payment of payments) {
      if (!payment.supplierId || Number(payment.paymentAmount ?? 0) <= 0) {
        continue;
      }

      events.push({
        partnerId: payment.supplierId,
        partnerRole: 'supplier' as PartnerRole,
        entityType: 'supplier' as StatementType,
        transactionType: 'payment_out' as TransactionType,
        amount: Number(payment.paymentAmount ?? 0),
        referenceId: payment.id,
        referenceNumber: payment.paymentNumber,
        description: '供应商付款',
        occurredAt: toDate(payment.paymentDate),
        status: payment.status === 'confirmed' ? 'completed' : 'pending',
        metadata: {
          source: 'payment_out_record',
          payableRecordId: payment.payableRecordId,
        },
      });
    }

    cursor = payments[payments.length - 1].id;
  }

  return events;
}

async function collectLedgerEvents(): Promise<LedgerEvent[]> {
  const [
    salesEvents,
    returnEvents,
    paymentEvents,
    refundEvents,
    payableEvents,
    paymentOutEvents,
  ] = await Promise.all([
    collectSalesOrderEvents(),
    collectReturnOrderEvents(),
    collectPaymentRecordEvents(),
    collectRefundRecordEvents(),
    collectPayableRecordEvents(),
    collectPaymentOutRecordEvents(),
  ]);

  const events = [
    ...salesEvents,
    ...returnEvents,
    ...paymentEvents,
    ...refundEvents,
    ...payableEvents,
    ...paymentOutEvents,
  ];

  events.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  return events;
}

async function writeReport(report: unknown) {
  const reportsDir = path.resolve(process.cwd(), 'reports');
  await fs.mkdir(reportsDir, { recursive: true });
  const filePath = path.join(
    reportsDir,
    `ledger-rebuild-report-${Date.now()}.json`
  );
  await fs.writeFile(filePath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`📄 报表已生成: ${filePath}`);
}

async function main() {
  console.log('🧹 清理旧的账本数据...');
  await prisma.statementTransaction.deleteMany();
  await prisma.accountStatement.deleteMany();

  console.log('📦 收集业务事件...');
  const events = await collectLedgerEvents();
  const counters = buildLedgerEventCounters(events);
  console.log(`📈 共收集 ${events.length} 条事务事件，类型分布:`, counters);

  console.log('🧾 生成期初余额调整记录（如有需要可在此注入手动期初数据）');
  // 该脚本保留期初调整入口，如需导入历史余额可在此扩展

  console.log('🪵 重放交易流水...');
  for (const event of events) {
    await recordPartnerTransaction({
      partnerId: event.partnerId,
      partnerRole: event.partnerRole,
      entityType: event.entityType,
      transactionType: event.transactionType,
      amount: event.amount,
      referenceId: event.referenceId,
      referenceNumber: event.referenceNumber,
      description: event.description,
      occurredAt: event.occurredAt,
      dueDate: event.dueDate,
      status: event.status,
      metadata: event.metadata,
    });
  }

  console.log('📊 生成汇总数据...');
  const [statementCount, sampleStatements, totals] = await Promise.all([
    prisma.accountStatement.count(),
    prisma.accountStatement.findMany({
      select: {
        entityId: true,
        entityName: true,
        partnerRole: true,
        currentBalance: true,
        totalAmount: true,
        paidAmount: true,
        pendingAmount: true,
      },
      orderBy: {
        id: 'asc',
      },
      take: 10,
    }),
    Promise.all([
      prisma.accountStatement.aggregate({
        where: { currentBalance: { gt: 0 } },
        _sum: { currentBalance: true },
      }),
      prisma.accountStatement.aggregate({
        where: { currentBalance: { lt: 0 } },
        _sum: { currentBalance: true },
      }),
    ]).then(([positive, negative]) => ({
      totalReceivable: toNumber(positive._sum.currentBalance, 0),
      totalPayable: Math.abs(toNumber(negative._sum.currentBalance, 0)),
    })),
  ]);
  const transactionsCount = await prisma.statementTransaction.count();

  const report = {
    generatedAt: new Date().toISOString(),
    totals: {
      statements: statementCount,
      transactions: transactionsCount,
      totalReceivable: totals.totalReceivable,
      totalPayable: totals.totalPayable,
    },
    eventCounters: counters,
    sampleStatements: sampleStatements.map(statement => ({
      entityId: statement.entityId,
      entityName: statement.entityName,
      partnerRole: statement.partnerRole,
      currentBalance: toNumber(statement.currentBalance, 0),
      totalAmount: toNumber(statement.totalAmount, 0),
      paidAmount: toNumber(statement.paidAmount, 0),
      pendingAmount: toNumber(statement.pendingAmount, 0),
    })),
  };

  await writeReport(report);
  console.log('✅ 账本重建完成');
}

main()
  .catch(error => {
    console.error('❌ 账本重建失败:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
