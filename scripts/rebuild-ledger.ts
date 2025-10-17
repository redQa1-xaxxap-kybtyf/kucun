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
  });

  return orders
    .filter(order => order.customerId && order.totalAmount > 0)
    .map(order => ({
      partnerId: order.customerId,
      partnerRole: 'customer' as PartnerRole,
      entityType: 'customer' as StatementType,
      transactionType: 'sale' as TransactionType,
      amount: order.totalAmount,
      referenceId: order.id,
      referenceNumber: order.orderNumber,
      description: '销售订单',
      occurredAt: toDate(order.createdAt),
      metadata: {
        source: 'sales_order',
        status: order.status,
      },
    }));
}

async function collectReturnOrderEvents(): Promise<LedgerEvent[]> {
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
  });

  return returnOrders
    .filter(
      order => order.customerId && (order.refundAmount || order.totalAmount)
    )
    .map(order => ({
      partnerId: order.customerId,
      partnerRole: 'customer' as PartnerRole,
      entityType: 'customer' as StatementType,
      transactionType: 'sales_return' as TransactionType,
      amount: order.refundAmount || order.totalAmount || 0,
      referenceId: order.id,
      referenceNumber: order.returnNumber,
      description: '销售退货',
      occurredAt: toDate(order.completedAt || order.createdAt),
      metadata: {
        source: 'return_order',
        status: order.status,
      },
    }));
}

async function collectPaymentRecordEvents(): Promise<LedgerEvent[]> {
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
  });

  return payments
    .filter(payment => payment.customerId && payment.paymentAmount > 0)
    .map(payment => ({
      partnerId: payment.customerId,
      partnerRole: 'customer' as PartnerRole,
      entityType: 'customer' as StatementType,
      transactionType:
        payment.paymentType === 'prepayment'
          ? ('prepayment_in' as TransactionType)
          : ('payment_in' as TransactionType),
      amount: payment.paymentAmount,
      referenceId: payment.id,
      referenceNumber: payment.paymentNumber,
      description: payment.paymentType === 'prepayment' ? '预收款' : '订单收款',
      occurredAt: toDate(payment.paymentDate),
      metadata: {
        source: 'payment_record',
        paymentType: payment.paymentType,
        salesOrderId: payment.salesOrderId,
      },
    }));
}

async function collectRefundRecordEvents(): Promise<LedgerEvent[]> {
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
  });

  return refunds
    .filter(refund => refund.customerId && refund.refundAmount > 0)
    .map(refund => ({
      partnerId: refund.customerId,
      partnerRole: 'customer' as PartnerRole,
      entityType: 'customer' as StatementType,
      transactionType: 'refund' as TransactionType,
      amount: refund.refundAmount,
      referenceId: refund.id,
      referenceNumber: refund.refundNumber,
      description: `退款 - ${refund.reason ?? '销售退款'}`,
      occurredAt: toDate(refund.refundDate),
      status: refund.status === 'completed' ? 'completed' : 'pending',
      metadata: {
        source: 'refund_record',
        status: refund.status,
      },
    }));
}

async function collectPayableRecordEvents(): Promise<LedgerEvent[]> {
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
  });

  const validPayables = payables.filter(
    (payable): payable is typeof payable & { supplierId: string } =>
      typeof payable.supplierId === 'string' && payable.supplierId.length > 0
  );

  return validPayables.map(payable => ({
    partnerId: payable.supplierId,
    partnerRole: 'supplier' as PartnerRole,
    entityType: 'supplier' as StatementType,
    transactionType: 'purchase' as TransactionType,
    amount: payable.payableAmount,
    referenceId: payable.id,
    referenceNumber: payable.payableNumber ?? payable.sourceNumber ?? undefined,
    description: `采购账款 - ${payable.sourceType ?? '其他'}`,
    occurredAt: toDate(payable.createdAt),
    dueDate: payable.dueDate ? toDate(payable.dueDate) : undefined,
    metadata: {
      source: 'payable_record',
      status: payable.status,
      sourceType: payable.sourceType,
    },
  }));
}

async function collectPaymentOutRecordEvents(): Promise<LedgerEvent[]> {
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
  });

  return payments
    .filter(payment => payment.supplierId && payment.paymentAmount > 0)
    .map(payment => ({
      partnerId: payment.supplierId,
      partnerRole: 'supplier' as PartnerRole,
      entityType: 'supplier' as StatementType,
      transactionType: 'payment_out' as TransactionType,
      amount: payment.paymentAmount,
      referenceId: payment.id,
      referenceNumber: payment.paymentNumber,
      description: '供应商付款',
      occurredAt: toDate(payment.paymentDate),
      status: payment.status === 'confirmed' ? 'completed' : 'pending',
      metadata: {
        source: 'payment_out_record',
        payableRecordId: payment.payableRecordId,
      },
    }));
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
  const statements = await prisma.accountStatement.findMany();
  const transactionsCount = await prisma.statementTransaction.count();

  const totals = statements.reduce(
    (acc, statement) => {
      const balance = statement.currentBalance ?? 0;
      if (balance >= 0) {
        acc.totalReceivable += balance;
      } else {
        acc.totalPayable += Math.abs(balance);
      }
      return acc;
    },
    { totalReceivable: 0, totalPayable: 0 }
  );

  const report = {
    generatedAt: new Date().toISOString(),
    totals: {
      statements: statements.length,
      transactions: transactionsCount,
      totalReceivable: totals.totalReceivable,
      totalPayable: totals.totalPayable,
    },
    eventCounters: counters,
    sampleStatements: statements.slice(0, 10).map(statement => ({
      entityId: statement.entityId,
      entityName: statement.entityName,
      partnerRole: statement.partnerRole,
      currentBalance: statement.currentBalance,
      totalAmount: statement.totalAmount,
      paidAmount: statement.paidAmount,
      pendingAmount: statement.pendingAmount,
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
