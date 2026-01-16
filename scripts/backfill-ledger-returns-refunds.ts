/* eslint-disable no-console */
export {};

/**
 * Backfill partner ledger for:
 * - Return orders (sales_return)
 * - Refund records (refund)
 *
 * 用途：修复存量数据中“往来明细/应收应付总账缺少退货、退款流水”的问题。
 *
 * 默认 dry-run，可加 --commit 真正写入。
 * 可选：--customerId <uuid> 仅处理指定客户。
 */

import dotenv from 'dotenv';

import { toNumber } from '../lib/utils/number';

dotenv.config({ path: '.env' });

type Options = {
  commit: boolean;
  customerId?: string;
};

type PrismaInstance = (typeof import('../lib/db'))['prisma'];
type RecordPartnerTransactionFn =
  (typeof import('../lib/services/partner-ledger-service'))['recordPartnerTransaction'];

function parseArgs(argv: string[]): Options {
  const opts: Options = { commit: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--commit') {
      opts.commit = true;
      continue;
    }
    if (arg === '--customerId') {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('Missing value for --customerId');
      }
      opts.customerId = value;
      i += 1;
      continue;
    }
  }
  return opts;
}

async function backfillSalesReturns(
  prisma: PrismaInstance,
  recordPartnerTransaction: RecordPartnerTransactionFn,
  options: Options
) {
  const where = {
    status: 'completed',
    processType: 'refund',
    refundAmount: { gt: 0 },
    ...(options.customerId ? { customerId: options.customerId } : {}),
  } as const;

  const orders = await prisma.returnOrder.findMany({
    where,
    select: {
      id: true,
      returnNumber: true,
      customerId: true,
      salesOrderId: true,
      refundAmount: true,
      completedAt: true,
      createdAt: true,
    },
    orderBy: { id: 'asc' },
  });

  let created = 0;
  let skipped = 0;

  for (const order of orders) {
    const existing = await prisma.statementTransaction.findFirst({
      where: {
        referenceId: order.id,
        transactionType: 'sales_return',
      },
      select: { id: true },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    const amount = toNumber(order.refundAmount, 0);
    if (amount <= 0) {
      skipped += 1;
      continue;
    }

    if (!options.commit) {
      created += 1;
      console.log('[dry-run] would create sales_return', {
        returnOrderId: order.id,
        returnNumber: order.returnNumber,
        customerId: order.customerId,
        amount,
      });
      continue;
    }

    await recordPartnerTransaction({
      partnerId: order.customerId,
      partnerRole: 'customer',
      entityType: 'customer',
      transactionType: 'sales_return',
      amount,
      referenceId: order.id,
      referenceNumber: order.returnNumber,
      description: `销售退货 ${order.returnNumber} 回补入账`,
      occurredAt: order.completedAt ?? order.createdAt,
      metadata: {
        source: 'return_order',
        salesOrderId: order.salesOrderId ?? undefined,
        triggeredBy: 'scripts/backfill-ledger-returns-refunds.ts',
      },
    });

    created += 1;
    console.log('[commit] created sales_return', {
      returnOrderId: order.id,
      returnNumber: order.returnNumber,
      amount,
    });
  }

  return { scanned: orders.length, created, skipped };
}

async function backfillRefunds(
  prisma: PrismaInstance,
  recordPartnerTransaction: RecordPartnerTransactionFn,
  options: Options
) {
  const where = {
    status: 'completed',
    ...(options.customerId ? { customerId: options.customerId } : {}),
  } as const;

  const refunds = await prisma.refundRecord.findMany({
    where,
    select: {
      id: true,
      refundNumber: true,
      customerId: true,
      salesOrderId: true,
      returnOrderId: true,
      refundMethod: true,
      refundType: true,
      refundAmount: true,
      processedAmount: true,
      refundDate: true,
      processedDate: true,
    },
    orderBy: { id: 'asc' },
  });

  let created = 0;
  let skipped = 0;

  for (const refund of refunds) {
    const existing = await prisma.statementTransaction.findFirst({
      where: {
        referenceId: refund.id,
        transactionType: 'refund',
      },
      select: { id: true },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    const processedAmount = toNumber(refund.processedAmount, 0);
    const fallbackAmount = toNumber(refund.refundAmount, 0);
    const amount = processedAmount > 0 ? processedAmount : fallbackAmount;

    if (amount <= 0) {
      skipped += 1;
      continue;
    }

    if (!options.commit) {
      created += 1;
      console.log('[dry-run] would create refund', {
        refundId: refund.id,
        refundNumber: refund.refundNumber,
        customerId: refund.customerId,
        amount,
      });
      continue;
    }

    await recordPartnerTransaction({
      partnerId: refund.customerId,
      partnerRole: 'customer',
      entityType: 'customer',
      transactionType: 'refund',
      amount,
      referenceId: refund.id,
      referenceNumber: refund.refundNumber,
      description: `退款 ${refund.refundNumber} 回补入账`,
      occurredAt: refund.processedDate ?? refund.refundDate,
      metadata: {
        source: 'refund_record',
        salesOrderId: refund.salesOrderId,
        returnOrderId: refund.returnOrderId ?? undefined,
        refundMethod: refund.refundMethod,
        refundType: refund.refundType,
        triggeredBy: 'scripts/backfill-ledger-returns-refunds.ts',
      },
    });

    created += 1;
    console.log('[commit] created refund', {
      refundId: refund.id,
      refundNumber: refund.refundNumber,
      amount,
    });
  }

  return { scanned: refunds.length, created, skipped };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  console.log('ledger backfill start', {
    mode: options.commit ? 'commit' : 'dry-run',
    customerId: options.customerId ?? null,
  });

  const [{ prisma }, { recordPartnerTransaction }] = await Promise.all([
    import('../lib/db'),
    import('../lib/services/partner-ledger-service'),
  ]);

  const [salesReturnResult, refundResult] = await Promise.all([
    backfillSalesReturns(prisma, recordPartnerTransaction, options),
    backfillRefunds(prisma, recordPartnerTransaction, options),
  ]);

  console.log('ledger backfill summary', {
    sales_return: salesReturnResult,
    refund: refundResult,
  });

  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch(async error => {
    console.error('ledger backfill failed:', error);
    try {
      const { prisma } = await import('../lib/db');
      await prisma.$disconnect();
    } catch {
      // ignore
    }
    process.exit(1);
  });
