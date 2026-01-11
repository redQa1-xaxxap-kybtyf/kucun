/**
 * 全量业务一致性审计（库存/销售/退货退款/往来账/应付/厂家直发/采购）
 *
 * 运行：
 * - npm run audit:full
 * - npm run audit:full -- 2025-01-01 2025-12-31 --fail
 * - npm run audit:full -- --start 2025-01-01 --end 2025-12-31 --out test-results/full-audit
 */

import fs from 'fs';
import path from 'path';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type OutputFormat = 'both' | 'json' | 'csv';
type Options = {
  startDate?: Date;
  endDate?: Date;
  outPrefix: string;
  format: OutputFormat;
  batchSize: number;
  take?: number;
  failOnIssues: boolean;
};

type Anomaly = {
  domain: string;
  code: string;
  message: string;
  entityType: string;
  entityId: string;
  entityNumber?: string;
  createdAt?: string;
  expected?: number | string;
  actual?: number | string;
  diff?: number;
  extra?: Record<string, unknown>;
};

const EPS_CURRENCY = 0.05;
const EPS_QTY = 0.001;

const roundCurrency = (v: number) => Math.round((v ?? 0) * 100) / 100;
const nearlyEqual = (a: number, b: number, eps = EPS_CURRENCY) =>
  Math.abs((a ?? 0) - (b ?? 0)) <= eps;

function parseDate(input?: string | null): Date | undefined {
  if (!input) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    throw new Error(`无效日期格式（期望 YYYY-MM-DD）：${input}`);
  }
  const [year, month, day] = input.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatLocalYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function ensureDirForFile(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw = String(value);
  if (raw.includes('"') || raw.includes(',') || raw.includes('\n')) {
    return `"${raw.replace(/\"/g, '""')}"`;
  }
  return raw;
}

function parseArgs(argv: string[]): Options {
  const args = [...argv];
  const first = args[0];
  const second = args[1];
  const positionalStart = first && !first.startsWith('--') ? first : undefined;
  const positionalEnd =
    positionalStart && second && !second.startsWith('--') ? second : undefined;

  const getFlag = (name: string) => {
    const idx = args.findIndex(a => a === name);
    return idx >= 0 ? args[idx + 1] : undefined;
  };
  const hasFlag = (name: string) => args.includes(name);

  const startDate = parseDate(getFlag('--start') ?? positionalStart);
  const endDate = parseDate(getFlag('--end') ?? positionalEnd);

  const outPrefixRaw = getFlag('--out');
  const format = (getFlag('--format') as OutputFormat | undefined) ?? 'both';
  const batchSizeRaw = Number(getFlag('--batch') ?? 200);
  const takeRaw = getFlag('--take');
  const take = takeRaw ? Number(takeRaw) : undefined;

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outPrefix = outPrefixRaw || path.join('test-results', `full-audit-${ts}`);

  return {
    startDate,
    endDate,
    outPrefix,
    format,
    batchSize:
      Number.isFinite(batchSizeRaw) && batchSizeRaw > 0 ? batchSizeRaw : 200,
    take: take !== undefined && Number.isFinite(take) && take > 0 ? take : undefined,
    failOnIssues: hasFlag('--fail'),
  };
}

function buildCreatedAtWhere(startDate?: Date, endDate?: Date) {
  const where: { createdAt?: { gte?: Date; lte?: Date } } = {};
  if (!startDate && !endDate) return where;
  where.createdAt = {};
  if (startDate) where.createdAt.gte = startDate;
  if (endDate) {
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);
    where.createdAt.lte = endOfDay;
  }
  return where;
}

function buildDateWhere(startDate?: Date, endDate?: Date) {
  const where: { gte?: Date; lte?: Date } = {};
  if (startDate) where.gte = startDate;
  if (endDate) {
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);
    where.lte = endOfDay;
  }
  return Object.keys(where).length > 0 ? where : undefined;
}

function pvBatchKey(
  productId: string,
  variantId: string | null,
  batch: string | null
) {
  return `${productId}|${variantId ?? ''}|${batch ?? ''}`;
}

async function auditAccountStatements(batchSize: number): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];
  let cursorId: string | undefined;

  while (true) {
    const statements = await prisma.accountStatement.findMany({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: batchSize,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      select: {
        id: true,
        entityName: true,
        totalOrders: true,
        totalAmount: true,
        paidAmount: true,
        pendingAmount: true,
        currentBalance: true,
        lastTransactionDate: true,
        createdAt: true,
      },
    });
    if (statements.length === 0) break;
    cursorId = statements[statements.length - 1].id;

    const ids = statements.map(s => s.id);
    const txs = await prisma.statementTransaction.findMany({
      where: { statementId: { in: ids } },
      orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        statementId: true,
        transactionType: true,
        direction: true,
        amount: true,
        debitAmount: true,
        creditAmount: true,
        beforeBalance: true,
        afterBalance: true,
        balance: true,
        transactionDate: true,
        referenceNumber: true,
        createdAt: true,
      },
    });

    const grouped = new Map<string, typeof txs>();
    for (const tx of txs) {
      if (!grouped.has(tx.statementId)) grouped.set(tx.statementId, []);
      grouped.get(tx.statementId)!.push(tx);
    }

    for (const s of statements) {
      const statementTxs = grouped.get(s.id) ?? [];
      const balance = Number(s.currentBalance ?? 0);
      const pending = Number(s.pendingAmount ?? 0);

      if (!nearlyEqual(pending, Math.abs(balance), 0.01)) {
        anomalies.push({
          domain: 'finance-ledger',
          code: 'STATEMENT_PENDING_MISMATCH',
          message: 'pendingAmount != |currentBalance|',
          entityType: 'AccountStatement',
          entityId: s.id,
          entityNumber: s.entityName,
          createdAt: s.createdAt.toISOString(),
          expected: roundCurrency(Math.abs(balance)),
          actual: roundCurrency(pending),
          diff: roundCurrency(pending - Math.abs(balance)),
        });
      }

      if (statementTxs.length === 0) continue;

      let lastAfter = Number(statementTxs[0].beforeBalance ?? 0);
      let expectedTotalAmount = 0;
      let expectedPaidAmount = 0;
      let expectedOrders = 0;
      let maxTxDate = statementTxs[0].transactionDate;

      for (const tx of statementTxs) {
        const amount = Number(tx.amount ?? 0);
        const direction = tx.direction === 'debit' ? 'debit' : 'credit';
        const delta = direction === 'debit' ? amount : -amount;
        const expectedAfter = Number(tx.beforeBalance ?? 0) + delta;

        if (!nearlyEqual(Number(tx.beforeBalance ?? 0), lastAfter, 0.01)) {
          anomalies.push({
            domain: 'finance-ledger',
            code: 'TX_CHAIN_BROKEN',
            message: 'beforeBalance != prev.afterBalance',
            entityType: 'StatementTransaction',
            entityId: tx.id,
            entityNumber: tx.referenceNumber,
            createdAt: tx.createdAt.toISOString(),
            expected: roundCurrency(lastAfter),
            actual: roundCurrency(Number(tx.beforeBalance ?? 0)),
          });
        }

        if (
          !nearlyEqual(Number(tx.afterBalance ?? 0), expectedAfter, 0.01) ||
          !nearlyEqual(Number(tx.balance ?? 0), expectedAfter, 0.01)
        ) {
          anomalies.push({
            domain: 'finance-ledger',
            code: 'TX_BALANCE_MISMATCH',
            message: 'afterBalance/balance != beforeBalance +/- amount',
            entityType: 'StatementTransaction',
            entityId: tx.id,
            entityNumber: tx.referenceNumber,
            createdAt: tx.createdAt.toISOString(),
            expected: roundCurrency(expectedAfter),
            actual: roundCurrency(Number(tx.afterBalance ?? 0)),
            extra: {
              direction,
              amount,
              beforeBalance: tx.beforeBalance,
              balance: tx.balance,
            },
          });
        }

        const expectedDebit = direction === 'debit' ? amount : 0;
        const expectedCredit = direction === 'credit' ? amount : 0;
        if (
          !nearlyEqual(Number(tx.debitAmount ?? 0), expectedDebit, 0.01) ||
          !nearlyEqual(Number(tx.creditAmount ?? 0), expectedCredit, 0.01)
        ) {
          anomalies.push({
            domain: 'finance-ledger',
            code: 'TX_DEBIT_CREDIT_MISMATCH',
            message: 'debitAmount/creditAmount mismatch direction',
            entityType: 'StatementTransaction',
            entityId: tx.id,
            entityNumber: tx.referenceNumber,
            createdAt: tx.createdAt.toISOString(),
          });
        }

        // 复算 statement 汇总字段（对齐 partner-ledger-service 的规则）
        if (tx.transactionType === 'sale' || tx.transactionType === 'purchase') {
          expectedOrders += 1;
        }
        if (
          tx.transactionType === 'sale' ||
          tx.transactionType === 'sales_return' ||
          tx.transactionType === 'order_cancellation' ||
          tx.transactionType === 'purchase'
        ) {
          expectedTotalAmount += delta;
        }
        if (
          tx.transactionType === 'payment_in' ||
          tx.transactionType === 'payment_out' ||
          tx.transactionType === 'prepayment_in' ||
          tx.transactionType === 'prepayment_out' ||
          tx.transactionType === 'refund'
        ) {
          expectedPaidAmount += amount;
        }

        if (tx.transactionDate > maxTxDate) maxTxDate = tx.transactionDate;
        lastAfter = Number(tx.afterBalance ?? expectedAfter);
      }

      if (!nearlyEqual(balance, lastAfter, 0.01)) {
        anomalies.push({
          domain: 'finance-ledger',
          code: 'STATEMENT_BALANCE_MISMATCH',
          message: 'currentBalance != last.afterBalance',
          entityType: 'AccountStatement',
          entityId: s.id,
          entityNumber: s.entityName,
          createdAt: s.createdAt.toISOString(),
          expected: roundCurrency(lastAfter),
          actual: roundCurrency(balance),
        });
      }

      if (!nearlyEqual(Number(s.totalOrders ?? 0), expectedOrders, 0.01)) {
        anomalies.push({
          domain: 'finance-ledger',
          code: 'STATEMENT_TOTAL_ORDERS_MISMATCH',
          message: "totalOrders != count('sale'+'purchase')",
          entityType: 'AccountStatement',
          entityId: s.id,
          entityNumber: s.entityName,
          createdAt: s.createdAt.toISOString(),
          expected: expectedOrders,
          actual: Number(s.totalOrders ?? 0),
        });
      }

      const expectedTotal = roundCurrency(expectedTotalAmount);
      if (!nearlyEqual(Number(s.totalAmount ?? 0), expectedTotal, 0.5)) {
        anomalies.push({
          domain: 'finance-ledger',
          code: 'STATEMENT_TOTAL_AMOUNT_MISMATCH',
          message: 'totalAmount != recomputed(total tx)',
          entityType: 'AccountStatement',
          entityId: s.id,
          entityNumber: s.entityName,
          createdAt: s.createdAt.toISOString(),
          expected: expectedTotal,
          actual: roundCurrency(Number(s.totalAmount ?? 0)),
          diff: roundCurrency(Number(s.totalAmount ?? 0) - expectedTotal),
        });
      }

      const expectedPaid = roundCurrency(expectedPaidAmount);
      if (!nearlyEqual(Number(s.paidAmount ?? 0), expectedPaid, 0.5)) {
        anomalies.push({
          domain: 'finance-ledger',
          code: 'STATEMENT_PAID_AMOUNT_MISMATCH',
          message: 'paidAmount != recomputed(paid tx)',
          entityType: 'AccountStatement',
          entityId: s.id,
          entityNumber: s.entityName,
          createdAt: s.createdAt.toISOString(),
          expected: expectedPaid,
          actual: roundCurrency(Number(s.paidAmount ?? 0)),
          diff: roundCurrency(Number(s.paidAmount ?? 0) - expectedPaid),
        });
      }

      if (
        s.lastTransactionDate &&
        Math.abs(s.lastTransactionDate.getTime() - maxTxDate.getTime()) >
          1000 * 60 * 60
      ) {
        anomalies.push({
          domain: 'finance-ledger',
          code: 'STATEMENT_LAST_TX_DATE_MISMATCH',
          message: 'lastTransactionDate != max(txDate)',
          entityType: 'AccountStatement',
          entityId: s.id,
          entityNumber: s.entityName,
          createdAt: s.createdAt.toISOString(),
          expected: maxTxDate.toISOString(),
          actual: s.lastTransactionDate.toISOString(),
        });
      }
    }
  }

  return anomalies;
}

async function auditPayables(options: Options): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];
  const whereCreatedAt = buildCreatedAtWhere(options.startDate, options.endDate);
  let cursorId: string | undefined;

  while (true) {
    const payables = await prisma.payableRecord.findMany({
      where: { ...whereCreatedAt },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: options.batchSize,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      select: {
        id: true,
        payableNumber: true,
        payableAmount: true,
        paidAmount: true,
        remainingAmount: true,
        createdAt: true,
      },
    });
    if (payables.length === 0) break;
    cursorId = payables[payables.length - 1].id;

    const ids = payables.map(p => p.id);
    const paidConfirmed = await prisma.paymentOutRecord.groupBy({
      by: ['payableRecordId', 'status'],
      where: { payableRecordId: { in: ids } },
      _sum: { paymentAmount: true },
    });
    const paidMap = new Map<string, number>();
    for (const row of paidConfirmed) {
      if (!row.payableRecordId || row.status !== 'confirmed') continue;
      paidMap.set(row.payableRecordId, Number(row._sum.paymentAmount ?? 0));
    }

    for (const p of payables) {
      const payableAmount = Number(p.payableAmount ?? 0);
      const paidAmount = Number(p.paidAmount ?? 0);
      const remaining = Number(p.remainingAmount ?? 0);
      const expectedRemaining = roundCurrency(Math.max(0, payableAmount - paidAmount));

      if (!nearlyEqual(remaining, expectedRemaining, 0.5)) {
        anomalies.push({
          domain: 'payables',
          code: 'PAYABLE_REMAINING_MISMATCH',
          message: 'remainingAmount != payableAmount - paidAmount',
          entityType: 'PayableRecord',
          entityId: p.id,
          entityNumber: p.payableNumber,
          createdAt: p.createdAt.toISOString(),
          expected: expectedRemaining,
          actual: roundCurrency(remaining),
          diff: roundCurrency(remaining - expectedRemaining),
        });
      }

      const confirmed = Number(paidMap.get(p.id) ?? 0);
      if (!nearlyEqual(paidAmount, confirmed, 0.5)) {
        anomalies.push({
          domain: 'payables',
          code: 'PAYABLE_PAID_AMOUNT_MISMATCH',
          message: "paidAmount != sum(paymentOut confirmed)",
          entityType: 'PayableRecord',
          entityId: p.id,
          entityNumber: p.payableNumber,
          createdAt: p.createdAt.toISOString(),
          expected: roundCurrency(confirmed),
          actual: roundCurrency(paidAmount),
          diff: roundCurrency(paidAmount - confirmed),
        });
      }
    }
  }

  return anomalies;
}

async function auditInventory(options: Options): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];
  let cursorId: string | undefined;

  while (true) {
    const inventories = await prisma.inventory.findMany({
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: options.batchSize,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      select: {
        id: true,
        productId: true,
        variantId: true,
        batchNumber: true,
        quantity: true,
        reservedQuantity: true,
        updatedAt: true,
      },
    });
    if (inventories.length === 0) break;
    cursorId = inventories[inventories.length - 1].id;

    const keySet = new Set<string>();
    const productIds = new Set<string>();

    for (const inv of inventories) {
      const qty = Number(inv.quantity ?? 0);
      const reserved = Number(inv.reservedQuantity ?? 0);

      if (qty < 0) {
        anomalies.push({
          domain: 'inventory',
          code: 'INVENTORY_NEGATIVE_QTY',
          message: 'quantity < 0',
          entityType: 'Inventory',
          entityId: inv.id,
          entityNumber: inv.productId,
          createdAt: inv.updatedAt.toISOString(),
          actual: qty,
          extra: { variantId: inv.variantId, batchNumber: inv.batchNumber },
        });
      }
      if (reserved < 0) {
        anomalies.push({
          domain: 'inventory',
          code: 'INVENTORY_NEGATIVE_RESERVED',
          message: 'reservedQuantity < 0',
          entityType: 'Inventory',
          entityId: inv.id,
          entityNumber: inv.productId,
          createdAt: inv.updatedAt.toISOString(),
          actual: reserved,
          extra: { variantId: inv.variantId, batchNumber: inv.batchNumber },
        });
      }
      if (reserved > qty) {
        anomalies.push({
          domain: 'inventory',
          code: 'INVENTORY_RESERVED_GT_QTY',
          message: 'reservedQuantity > quantity',
          entityType: 'Inventory',
          entityId: inv.id,
          entityNumber: inv.productId,
          createdAt: inv.updatedAt.toISOString(),
          expected: qty,
          actual: reserved,
          diff: roundCurrency(reserved - qty),
          extra: { variantId: inv.variantId, batchNumber: inv.batchNumber },
        });
      }

      keySet.add(pvBatchKey(inv.productId, inv.variantId ?? null, inv.batchNumber ?? null));
      productIds.add(inv.productId);
    }

    const costGroups = await prisma.inventoryCostQueue.groupBy({
      by: ['productId', 'variantId', 'batchNumber'],
      where: { productId: { in: Array.from(productIds) } },
      _sum: { remainingQty: true },
    });

    const costMap = new Map<string, number>();
    for (const row of costGroups) {
      const key = pvBatchKey(row.productId, row.variantId ?? null, row.batchNumber ?? null);
      if (!keySet.has(key)) continue;
      costMap.set(key, Number(row._sum.remainingQty ?? 0));
    }

    for (const inv of inventories) {
      const key = pvBatchKey(inv.productId, inv.variantId ?? null, inv.batchNumber ?? null);
      const invQty = Number(inv.quantity ?? 0);
      const queueQty = Number(costMap.get(key) ?? 0);

      // FIFO 队列口径应接近库存数量（整数/浮点差异允许容差）
      if (!nearlyEqual(queueQty, invQty, 1)) {
        anomalies.push({
          domain: 'inventory',
          code: 'COST_QUEUE_QTY_MISMATCH',
          message: 'sum(remainingQty) != inventory.quantity',
          entityType: 'Inventory',
          entityId: inv.id,
          entityNumber: inv.productId,
          createdAt: inv.updatedAt.toISOString(),
          expected: invQty,
          actual: roundCurrency(queueQty),
          diff: roundCurrency(queueQty - invQty),
          extra: { variantId: inv.variantId, batchNumber: inv.batchNumber },
        });
      }
    }
  }

  return anomalies;
}

async function auditSalesOutbound(options: Options): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];
  const whereCreatedAt = buildCreatedAtWhere(options.startDate, options.endDate);

  let cursorId: string | undefined;
  let scanned = 0;

  while (true) {
    const remainingTake = options.take ? Math.max(0, options.take - scanned) : undefined;
    const pageTake = remainingTake
      ? Math.min(options.batchSize, remainingTake)
      : options.batchSize;
    if (pageTake <= 0) break;

    const orders = await prisma.salesOrder.findMany({
      where: { ...whereCreatedAt, status: { in: ['shipped', 'completed'] } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: pageTake,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        orderType: true,
        transferMode: true,
        items: {
          select: {
            productId: true,
            variantId: true,
            quantity: true,
            localQuantity: true,
          },
        },
      },
    });
    if (orders.length === 0) break;
    scanned += orders.length;
    cursorId = orders[orders.length - 1].id;

    const orderIds = orders.map(o => o.id);
    const outboundGroups = await prisma.outboundRecord.groupBy({
      by: ['salesOrderId', 'productId', 'variantId'],
      where: { salesOrderId: { in: orderIds } },
      _sum: { quantity: true },
    });
    const outboundMap = new Map<string, Map<string, number>>();
    for (const row of outboundGroups) {
      const orderId = row.salesOrderId;
      if (!orderId) continue;
      const key = `${row.productId}|${row.variantId ?? ''}`;
      const qty = Number(row._sum.quantity ?? 0);
      if (!outboundMap.has(orderId)) outboundMap.set(orderId, new Map());
      outboundMap.get(orderId)!.set(key, qty);
    }

    for (const order of orders) {
      const expectedByPv = new Map<string, number>();
      for (const it of order.items) {
        if (!it.productId) continue;
        const pv = `${it.productId}|${it.variantId ?? ''}`;
        const qty = Number(it.quantity ?? 0);
        const local = Number(it.localQuantity ?? 0);
        const expected =
          order.orderType === 'TRANSFER'
            ? order.transferMode === 'MIXED'
              ? local
              : 0
            : qty;
        expectedByPv.set(pv, (expectedByPv.get(pv) ?? 0) + expected);
      }

      const actualByPv = outboundMap.get(order.id) ?? new Map<string, number>();
      const keys = new Set([...expectedByPv.keys(), ...actualByPv.keys()]);

      for (const pv of keys) {
        const expected = Number(expectedByPv.get(pv) ?? 0);
        const actual = Number(actualByPv.get(pv) ?? 0);

        if (expected <= EPS_QTY && actual > EPS_QTY) {
          anomalies.push({
            domain: 'sales-outbound',
            code: 'OUTBOUND_UNEXPECTED',
            message: 'unexpected outbound',
            entityType: 'SalesOrder',
            entityId: order.id,
            entityNumber: order.orderNumber,
            createdAt: order.createdAt.toISOString(),
            expected: 0,
            actual: roundCurrency(actual),
            extra: { pv, orderType: order.orderType, transferMode: order.transferMode },
          });
          continue;
        }

        if (expected > EPS_QTY && actual <= EPS_QTY) {
          anomalies.push({
            domain: 'sales-outbound',
            code: 'OUTBOUND_MISSING',
            message: 'missing outbound',
            entityType: 'SalesOrder',
            entityId: order.id,
            entityNumber: order.orderNumber,
            createdAt: order.createdAt.toISOString(),
            expected: roundCurrency(expected),
            actual: roundCurrency(actual),
            diff: roundCurrency(actual - expected),
            extra: { pv, orderType: order.orderType, transferMode: order.transferMode },
          });
          continue;
        }

        if (expected > EPS_QTY && !nearlyEqual(expected, actual, 0.05)) {
          anomalies.push({
            domain: 'sales-outbound',
            code: 'OUTBOUND_QTY_MISMATCH',
            message: 'outbound qty mismatch',
            entityType: 'SalesOrder',
            entityId: order.id,
            entityNumber: order.orderNumber,
            createdAt: order.createdAt.toISOString(),
            expected: roundCurrency(expected),
            actual: roundCurrency(actual),
            diff: roundCurrency(actual - expected),
            extra: { pv, orderType: order.orderType, transferMode: order.transferMode },
          });
        }
      }
    }
  }

  return anomalies;
}

async function auditSalesFinancials(options: Options): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];
  const whereCreatedAt = buildCreatedAtWhere(options.startDate, options.endDate);

  let cursorId: string | undefined;
  let scanned = 0;

  while (true) {
    const remainingTake = options.take ? Math.max(0, options.take - scanned) : undefined;
    const pageTake = remainingTake
      ? Math.min(options.batchSize, remainingTake)
      : options.batchSize;
    if (pageTake <= 0) break;

    const orders = await prisma.salesOrder.findMany({
      where: { ...whereCreatedAt, status: { in: ['confirmed', 'shipped', 'completed'] } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: pageTake,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      select: {
        id: true,
        orderNumber: true,
        status: true,
        createdAt: true,
        totalAmount: true,
        roundingAdjustment: true,
      },
    });

    if (orders.length === 0) break;
    scanned += orders.length;
    cursorId = orders[orders.length - 1].id;

    const orderIds = orders.map(o => o.id);

    const paymentGroups = await prisma.paymentRecord.groupBy({
      by: ['salesOrderId'],
      where: {
        salesOrderId: { in: orderIds },
        status: { in: ['confirmed', 'applied'] },
      },
      _sum: { paymentAmount: true },
    });
    const paymentSumMap = new Map<string, number>();
    for (const row of paymentGroups) {
      if (!row.salesOrderId) continue;
      paymentSumMap.set(row.salesOrderId, Number(row._sum.paymentAmount ?? 0));
    }

    const prepaymentGroups = await prisma.prepaymentUsage.groupBy({
      by: ['salesOrderId'],
      where: { salesOrderId: { in: orderIds } },
      _sum: { appliedAmount: true },
    });
    const prepaymentSumMap = new Map<string, number>();
    for (const row of prepaymentGroups) {
      prepaymentSumMap.set(row.salesOrderId, Number(row._sum.appliedAmount ?? 0));
    }

    for (const order of orders) {
      const due =
        Number(order.totalAmount ?? 0) + Number(order.roundingAdjustment ?? 0);
      const paid =
        Number(paymentSumMap.get(order.id) ?? 0) +
        Number(prepaymentSumMap.get(order.id) ?? 0);
      const remaining = roundCurrency(due - paid);

      if (paid - due > EPS_CURRENCY) {
        anomalies.push({
          domain: 'sales-finance',
          code: 'ORDER_OVERPAID',
          message: 'paid > due (confirmed payments + prepaymentUsages)',
          entityType: 'SalesOrder',
          entityId: order.id,
          entityNumber: order.orderNumber,
          createdAt: order.createdAt.toISOString(),
          expected: roundCurrency(due),
          actual: roundCurrency(paid),
          diff: roundCurrency(paid - due),
        });
      }

      if (order.status === 'completed' && remaining > EPS_CURRENCY) {
        anomalies.push({
          domain: 'sales-finance',
          code: 'ORDER_COMPLETED_BUT_UNPAID',
          message: 'status=completed but paid < due',
          entityType: 'SalesOrder',
          entityId: order.id,
          entityNumber: order.orderNumber,
          createdAt: order.createdAt.toISOString(),
          expected: roundCurrency(due),
          actual: roundCurrency(paid),
          diff: roundCurrency(due - paid),
        });
      }

      if (order.status === 'shipped' && remaining <= EPS_CURRENCY) {
        anomalies.push({
          domain: 'sales-finance',
          code: 'ORDER_SHIPPED_FULLY_PAID_NOT_COMPLETED',
          message: 'status=shipped but paid >= due (should auto-complete)',
          entityType: 'SalesOrder',
          entityId: order.id,
          entityNumber: order.orderNumber,
          createdAt: order.createdAt.toISOString(),
          expected: 'completed',
          actual: order.status,
          extra: { due: roundCurrency(due), paid: roundCurrency(paid) },
        });
      }
    }
  }

  return anomalies;
}

async function auditPaymentRecords(options: Options): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];
  const paymentDate = buildDateWhere(options.startDate, options.endDate);

  let cursorId: string | undefined;
  while (true) {
    const payments = await prisma.paymentRecord.findMany({
      where: {
        ...(paymentDate ? { paymentDate } : {}),
      },
      orderBy: [{ paymentDate: 'asc' }, { id: 'asc' }],
      take: options.batchSize,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      select: {
        id: true,
        paymentNumber: true,
        paymentType: true,
        status: true,
        paymentAmount: true,
        actualPaymentAmount: true,
        roundingAmount: true,
        appliedAmount: true,
        paymentDate: true,
      },
    });
    if (payments.length === 0) break;
    cursorId = payments[payments.length - 1].id;

    for (const p of payments) {
      const paymentAmount = Number(p.paymentAmount ?? 0);
      const actual = Number(p.actualPaymentAmount ?? 0);
      const rounding = Number(p.roundingAmount ?? 0);
      const applied = Number(p.appliedAmount ?? 0);
      const expected = roundCurrency(actual + rounding);

      if (['confirmed', 'applied'].includes(p.status) && !nearlyEqual(paymentAmount, expected, 0.01)) {
        anomalies.push({
          domain: 'payments',
          code: 'PAYMENT_AMOUNT_MISMATCH',
          message: 'paymentAmount != actualPaymentAmount + roundingAmount',
          entityType: 'PaymentRecord',
          entityId: p.id,
          entityNumber: p.paymentNumber,
          createdAt: p.paymentDate.toISOString(),
          expected,
          actual: roundCurrency(paymentAmount),
          diff: roundCurrency(paymentAmount - expected),
          extra: { status: p.status, paymentType: p.paymentType },
        });
      }

      if (p.paymentType === 'prepayment' && applied - paymentAmount > EPS_CURRENCY) {
        anomalies.push({
          domain: 'payments',
          code: 'PREPAYMENT_APPLIED_GT_TOTAL',
          message: 'appliedAmount > paymentAmount',
          entityType: 'PaymentRecord',
          entityId: p.id,
          entityNumber: p.paymentNumber,
          createdAt: p.paymentDate.toISOString(),
          expected: roundCurrency(paymentAmount),
          actual: roundCurrency(applied),
          diff: roundCurrency(applied - paymentAmount),
          extra: { status: p.status },
        });
      }

      if (p.paymentType === 'order_payment' && applied > EPS_CURRENCY) {
        anomalies.push({
          domain: 'payments',
          code: 'ORDER_PAYMENT_HAS_APPLIED_AMOUNT',
          message: 'order_payment should not use appliedAmount',
          entityType: 'PaymentRecord',
          entityId: p.id,
          entityNumber: p.paymentNumber,
          createdAt: p.paymentDate.toISOString(),
          actual: roundCurrency(applied),
          extra: { status: p.status },
        });
      }
    }
  }

  return anomalies;
}

async function auditReturnsAndRefunds(options: Options): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];
  const whereCreatedAt = buildCreatedAtWhere(options.startDate, options.endDate);

  let cursorId: string | undefined;
  while (true) {
    const refunds = await prisma.refundRecord.findMany({
      where: { ...whereCreatedAt },
      orderBy: [{ refundDate: 'asc' }, { id: 'asc' }],
      take: options.batchSize,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      select: {
        id: true,
        refundNumber: true,
        refundAmount: true,
        processedAmount: true,
        remainingAmount: true,
        status: true,
        refundDate: true,
      },
    });
    if (refunds.length === 0) break;
    cursorId = refunds[refunds.length - 1].id;

    for (const r of refunds) {
      const refundAmount = Number(r.refundAmount ?? 0);
      const processed = Number(r.processedAmount ?? 0);
      const remaining = Number(r.remainingAmount ?? 0);
      const expectedRemaining = roundCurrency(Math.max(0, refundAmount - processed));

      if (processed - refundAmount > EPS_CURRENCY) {
        anomalies.push({
          domain: 'returns-refunds',
          code: 'REFUND_PROCESSED_GT_TOTAL',
          message: 'processedAmount > refundAmount',
          entityType: 'RefundRecord',
          entityId: r.id,
          entityNumber: r.refundNumber,
          createdAt: r.refundDate.toISOString(),
          expected: roundCurrency(refundAmount),
          actual: roundCurrency(processed),
          diff: roundCurrency(processed - refundAmount),
        });
      }

      if (!nearlyEqual(remaining, expectedRemaining, 0.5)) {
        anomalies.push({
          domain: 'returns-refunds',
          code: 'REFUND_REMAINING_MISMATCH',
          message: 'remainingAmount mismatch',
          entityType: 'RefundRecord',
          entityId: r.id,
          entityNumber: r.refundNumber,
          createdAt: r.refundDate.toISOString(),
          expected: expectedRemaining,
          actual: roundCurrency(remaining),
          diff: roundCurrency(remaining - expectedRemaining),
        });
      }

      if (r.status === 'completed' && remaining > 0.01) {
        anomalies.push({
          domain: 'returns-refunds',
          code: 'REFUND_COMPLETED_BUT_REMAINING',
          message: "completed but remaining>0",
          entityType: 'RefundRecord',
          entityId: r.id,
          entityNumber: r.refundNumber,
          createdAt: r.refundDate.toISOString(),
          actual: roundCurrency(remaining),
        });
      }
    }
  }

  const returnOrders = await prisma.returnOrder.findMany({
    where: { ...whereCreatedAt, status: { not: 'draft' } },
    select: { id: true, returnNumber: true, refundAmount: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  if (returnOrders.length === 0) return anomalies;

  const ids = returnOrders.map(o => o.id);
  const refundCounts = await prisma.refundRecord.groupBy({
    by: ['returnOrderId'],
    where: { returnOrderId: { in: ids } },
    _count: { _all: true },
    _sum: { refundAmount: true },
  });
  const map = new Map<string, { count: number; sum: number }>();
  for (const row of refundCounts) {
    if (!row.returnOrderId) continue;
    map.set(row.returnOrderId, {
      count: Number(row._count._all ?? 0),
      sum: Number(row._sum.refundAmount ?? 0),
    });
  }

  for (const ro of returnOrders) {
    const refundAmount = Number(ro.refundAmount ?? 0);
    if (refundAmount <= 0.01) continue;
    const linked = map.get(ro.id);
    if (!linked || linked.count === 0) {
      anomalies.push({
        domain: 'returns-refunds',
        code: 'RETURN_NO_REFUND_RECORD',
        message: 'return has refundAmount>0 but no RefundRecord',
        entityType: 'ReturnOrder',
        entityId: ro.id,
        entityNumber: ro.returnNumber,
        createdAt: ro.createdAt.toISOString(),
      });
    } else if (!nearlyEqual(linked.sum, refundAmount, 1)) {
      anomalies.push({
        domain: 'returns-refunds',
        code: 'RETURN_REFUND_SUM_MISMATCH',
        message: 'return.refundAmount != sum(refund.refundAmount)',
        entityType: 'ReturnOrder',
        entityId: ro.id,
        entityNumber: ro.returnNumber,
        createdAt: ro.createdAt.toISOString(),
        expected: roundCurrency(refundAmount),
        actual: roundCurrency(linked.sum),
        diff: roundCurrency(linked.sum - refundAmount),
        extra: { refundRecordCount: linked.count },
      });
    }
  }

  return anomalies;
}

async function auditFactoryShipments(options: Options): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];
  const whereCreatedAt = buildCreatedAtWhere(options.startDate, options.endDate);
  let cursorId: string | undefined;

  while (true) {
    const orders = await prisma.factoryShipmentOrder.findMany({
      where: { ...whereCreatedAt },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: options.batchSize,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        depositAmount: true,
        createdAt: true,
        items: {
          select: { supplierId: true, quantity: true, unitCost: true, totalPrice: true },
        },
      },
    });
    if (orders.length === 0) break;
    cursorId = orders[orders.length - 1].id;

    const ids = orders.map(o => o.id);
    const payables = await prisma.payableRecord.findMany({
      where: { sourceType: 'factory_shipment', sourceId: { in: ids } },
      select: { sourceId: true, supplierId: true, payableAmount: true },
    });
    const payableByOrder = new Map<string, typeof payables>();
    for (const p of payables) {
      const oid = p.sourceId ?? '';
      if (!oid) continue;
      if (!payableByOrder.has(oid)) payableByOrder.set(oid, []);
      payableByOrder.get(oid)!.push(p);
    }

    for (const o of orders) {
      const itemsTotal = roundCurrency(
        o.items.reduce((sum, it) => sum + Number(it.totalPrice ?? 0), 0)
      );
      if (!nearlyEqual(itemsTotal, Number(o.totalAmount ?? 0), 1)) {
        anomalies.push({
          domain: 'factory-shipment',
          code: 'FACTORY_TOTAL_AMOUNT_MISMATCH',
          message: 'totalAmount != sum(item.totalPrice)',
          entityType: 'FactoryShipmentOrder',
          entityId: o.id,
          entityNumber: o.orderNumber,
          createdAt: o.createdAt.toISOString(),
          expected: itemsTotal,
          actual: roundCurrency(Number(o.totalAmount ?? 0)),
          diff: roundCurrency(Number(o.totalAmount ?? 0) - itemsTotal),
        });
      }

      if (!(o.status === 'shipped' || o.status === 'arrived')) continue;

      // 对齐 factory-shipment-status 的应付口径：baseCost(按供应商汇总) - deposit
      const supplierCost = new Map<string, number>();
      for (const it of o.items) {
        if (!it.supplierId) continue;
        const qty = Number(it.quantity ?? 0);
        const unitCost =
          typeof it.unitCost === 'number' && !Number.isNaN(it.unitCost)
            ? it.unitCost
            : null;
        const fallback = Number(it.totalPrice ?? 0);
        const computed = unitCost !== null ? qty * unitCost : fallback;
        const rounded = roundCurrency(computed);
        if (rounded <= 0) continue;
        supplierCost.set(
          it.supplierId,
          roundCurrency((supplierCost.get(it.supplierId) ?? 0) + rounded)
        );
      }

      const baseCost = roundCurrency(
        Array.from(supplierCost.values()).reduce((s, v) => s + Math.max(0, v), 0)
      );
      const deposit = roundCurrency(
        Math.min(baseCost, Math.max(0, Number(o.depositAmount ?? 0)))
      );
      const expectedNet = roundCurrency(Math.max(0, baseCost - deposit));
      const linked = payableByOrder.get(o.id) ?? [];
      const sumPayables = roundCurrency(
        linked.reduce((s, p) => s + Number(p.payableAmount ?? 0), 0)
      );

      if (!nearlyEqual(sumPayables, expectedNet, 2)) {
        anomalies.push({
          domain: 'factory-shipment',
          code: 'FACTORY_PAYABLE_SUM_MISMATCH',
          message: 'sum(payableAmount) != baseCost - deposit',
          entityType: 'FactoryShipmentOrder',
          entityId: o.id,
          entityNumber: o.orderNumber,
          createdAt: o.createdAt.toISOString(),
          expected: expectedNet,
          actual: sumPayables,
          diff: roundCurrency(sumPayables - expectedNet),
          extra: {
            baseCost,
            deposit,
            payableCount: linked.length,
            supplierCount: supplierCost.size,
          },
        });
      }

      if (expectedNet > 0.01 && linked.length === 0) {
        anomalies.push({
          domain: 'factory-shipment',
          code: 'FACTORY_PAYABLE_MISSING',
          message: "eligible but no PayableRecord(sourceType='factory_shipment')",
          entityType: 'FactoryShipmentOrder',
          entityId: o.id,
          entityNumber: o.orderNumber,
          createdAt: o.createdAt.toISOString(),
          expected: expectedNet,
          actual: 0,
        });
      }
    }
  }

  return anomalies;
}

async function auditPurchaseOrders(options: Options): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];
  const whereCreatedAt = buildCreatedAtWhere(options.startDate, options.endDate);
  let cursorId: string | undefined;

  while (true) {
    const orders = await prisma.purchaseOrder.findMany({
      where: { ...whereCreatedAt },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: options.batchSize,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        items: { select: { id: true, quantity: true, totalPrice: true } },
        inboundRecords: {
          select: { id: true, purchaseOrderItemId: true, quantity: true },
        },
      },
    });
    if (orders.length === 0) break;
    cursorId = orders[orders.length - 1].id;

    for (const o of orders) {
      const itemsTotal = roundCurrency(
        o.items.reduce((sum, it) => sum + Number(it.totalPrice ?? 0), 0)
      );
      if (!nearlyEqual(itemsTotal, Number(o.totalAmount ?? 0), 1)) {
        anomalies.push({
          domain: 'purchase',
          code: 'PURCHASE_TOTAL_AMOUNT_MISMATCH',
          message: 'totalAmount != sum(item.totalPrice)',
          entityType: 'PurchaseOrder',
          entityId: o.id,
          entityNumber: o.orderNumber,
          createdAt: o.createdAt.toISOString(),
          expected: itemsTotal,
          actual: roundCurrency(Number(o.totalAmount ?? 0)),
          diff: roundCurrency(Number(o.totalAmount ?? 0) - itemsTotal),
        });
      }

      if (o.items.length === 0 && Math.abs(Number(o.totalAmount ?? 0)) > EPS_CURRENCY) {
        anomalies.push({
          domain: 'purchase',
          code: 'PURCHASE_NO_ITEMS_NONZERO_TOTAL',
          message: '采购单无明细但 totalAmount != 0（常见于历史数据断链/删除明细）',
          entityType: 'PurchaseOrder',
          entityId: o.id,
          entityNumber: o.orderNumber,
          createdAt: o.createdAt.toISOString(),
          actual: roundCurrency(Number(o.totalAmount ?? 0)),
          extra: { status: o.status },
        });
      }

      const inboundByItem = new Map<string, number>();
      for (const inb of o.inboundRecords) {
        if (!inb.purchaseOrderItemId) continue;
        inboundByItem.set(
          inb.purchaseOrderItemId,
          (inboundByItem.get(inb.purchaseOrderItemId) ?? 0) + Number(inb.quantity ?? 0)
        );
      }

      for (const inb of o.inboundRecords) {
        if (inb.purchaseOrderItemId) continue;
        anomalies.push({
          domain: 'purchase',
          code: 'PURCHASE_INBOUND_ITEM_LINK_MISSING',
          message: '入库记录已关联采购单但缺少 purchaseOrderItemId（无法按明细对账/追溯）',
          entityType: 'InboundRecord',
          entityId: inb.id,
          entityNumber: o.orderNumber,
          createdAt: o.createdAt.toISOString(),
          extra: { purchaseOrderId: o.id, quantity: inb.quantity },
        });
      }

      for (const it of o.items) {
        const ordered = Number(it.quantity ?? 0);
        const inbound = Number(inboundByItem.get(it.id) ?? 0);
        if (inbound - ordered > 0.01) {
          anomalies.push({
            domain: 'purchase',
            code: 'PURCHASE_INBOUND_GT_ORDERED',
            message: 'sum(inbound.qty) > ordered.qty',
            entityType: 'PurchaseOrderItem',
            entityId: it.id,
            entityNumber: o.orderNumber,
            createdAt: o.createdAt.toISOString(),
            expected: roundCurrency(ordered),
            actual: roundCurrency(inbound),
            diff: roundCurrency(inbound - ordered),
            extra: { purchaseOrderId: o.id },
          });
        }
      }
    }
  }

  return anomalies;
}

async function auditInboundOutboundRecords(options: Options): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];
  const whereCreatedAt = buildCreatedAtWhere(options.startDate, options.endDate);

  // InboundRecord: totalCost ~ unitCost * quantity；采购入库但缺少 purchaseOrderId/itemId 提示
  let inboundCursor: string | undefined;
  while (true) {
    const inbound = await prisma.inboundRecord.findMany({
      where: { ...whereCreatedAt },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: options.batchSize,
      ...(inboundCursor ? { cursor: { id: inboundCursor }, skip: 1 } : {}),
      select: {
        id: true,
        recordNumber: true,
        productId: true,
        batchNumber: true,
        quantity: true,
        unitCost: true,
        totalCost: true,
        reason: true,
        purchaseOrderId: true,
        purchaseOrderItemId: true,
        createdAt: true,
      },
    });
    if (inbound.length === 0) break;
    inboundCursor = inbound[inbound.length - 1].id;

    for (const r of inbound) {
      const qty = Number(r.quantity ?? 0);
      const unitCost = r.unitCost !== null && r.unitCost !== undefined ? Number(r.unitCost) : null;
      const totalCost = r.totalCost !== null && r.totalCost !== undefined ? Number(r.totalCost) : null;

      if (qty < -EPS_QTY) {
        anomalies.push({
          domain: 'inventory-inbound',
          code: 'INBOUND_NEGATIVE_QTY',
          message: '入库数量为负',
          entityType: 'InboundRecord',
          entityId: r.id,
          entityNumber: r.recordNumber,
          createdAt: r.createdAt.toISOString(),
          actual: qty,
        });
      }

      if (unitCost !== null && totalCost !== null) {
        const expected = roundCurrency(unitCost * qty);
        if (!nearlyEqual(totalCost, expected, 1)) {
          anomalies.push({
            domain: 'inventory-inbound',
            code: 'INBOUND_TOTAL_COST_MISMATCH',
            message: 'totalCost != unitCost * quantity（可能存在费用分摊/历史写入差异）',
            entityType: 'InboundRecord',
            entityId: r.id,
            entityNumber: r.recordNumber,
            createdAt: r.createdAt.toISOString(),
            expected,
            actual: roundCurrency(totalCost),
            diff: roundCurrency(totalCost - expected),
            extra: { productId: r.productId, batchNumber: r.batchNumber },
          });
        }
      }

      if (r.reason === 'purchase' && !r.purchaseOrderId) {
        anomalies.push({
          domain: 'inventory-inbound',
          code: 'INBOUND_PURCHASE_ORDER_LINK_MISSING',
          message: "reason='purchase' 但未关联 purchaseOrderId（导致采购-入库链路断）",
          entityType: 'InboundRecord',
          entityId: r.id,
          entityNumber: r.recordNumber,
          createdAt: r.createdAt.toISOString(),
          extra: { productId: r.productId, batchNumber: r.batchNumber },
        });
      }
    }
  }

  // OutboundRecord: totalCost ~ unitCost * quantity
  let outboundCursor: string | undefined;
  while (true) {
    const outbound = await prisma.outboundRecord.findMany({
      where: { ...whereCreatedAt },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: options.batchSize,
      ...(outboundCursor ? { cursor: { id: outboundCursor }, skip: 1 } : {}),
      select: {
        id: true,
        recordNumber: true,
        productId: true,
        batchNumber: true,
        quantity: true,
        unitCost: true,
        totalCost: true,
        reason: true,
        salesOrderId: true,
        createdAt: true,
      },
    });
    if (outbound.length === 0) break;
    outboundCursor = outbound[outbound.length - 1].id;

    for (const r of outbound) {
      const qty = Number(r.quantity ?? 0);
      const unitCost = r.unitCost !== null && r.unitCost !== undefined ? Number(r.unitCost) : null;
      const totalCost = r.totalCost !== null && r.totalCost !== undefined ? Number(r.totalCost) : null;

      if (qty < -EPS_QTY) {
        anomalies.push({
          domain: 'inventory-outbound',
          code: 'OUTBOUND_NEGATIVE_QTY',
          message: '出库数量为负',
          entityType: 'OutboundRecord',
          entityId: r.id,
          entityNumber: r.recordNumber,
          createdAt: r.createdAt.toISOString(),
          actual: qty,
        });
      }

      if (unitCost !== null && totalCost !== null) {
        const expected = roundCurrency(unitCost * qty);
        if (!nearlyEqual(totalCost, expected, 2)) {
          anomalies.push({
            domain: 'inventory-outbound',
            code: 'OUTBOUND_TOTAL_COST_MISMATCH',
            message: 'totalCost != unitCost * quantity（含分摊费用时可能合理，但需一致口径）',
            entityType: 'OutboundRecord',
            entityId: r.id,
            entityNumber: r.recordNumber,
            createdAt: r.createdAt.toISOString(),
            expected,
            actual: roundCurrency(totalCost),
            diff: roundCurrency(totalCost - expected),
            extra: { productId: r.productId, batchNumber: r.batchNumber, reason: r.reason, salesOrderId: r.salesOrderId },
          });
        }
      }
    }
  }

  return anomalies;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { startDate, endDate, outPrefix, format, failOnIssues } = options;

  console.log('🔍 全量业务一致性审计...');
  if (startDate || endDate) {
    console.log(
      `   过滤条件：${startDate ? formatLocalYmd(startDate) : '（最早）'} ~ ${
        endDate ? formatLocalYmd(endDate) : '（最晚）'
      }`
    );
  } else {
    console.log('   过滤条件：未指定日期，审计全量数据');
  }
  console.log(`   输出：${format} -> ${outPrefix}.{json,csv}\n`);

  const anomalies: Anomaly[] = [];

  console.log('1) 往来账/流水...');
  anomalies.push(...(await auditAccountStatements(options.batchSize)));

  console.log('2) 应付款...');
  anomalies.push(...(await auditPayables(options)));

  console.log('3) 库存/FIFO队列...');
  anomalies.push(...(await auditInventory(options)));

  console.log('4) 出入库记录...');
  anomalies.push(...(await auditInboundOutboundRecords(options)));

  console.log('5) 销售出库...');
  anomalies.push(...(await auditSalesOutbound(options)));

  console.log('6) 销售/收款口径...');
  anomalies.push(...(await auditSalesFinancials(options)));

  console.log('7) 收款/预收款记录...');
  anomalies.push(...(await auditPaymentRecords(options)));

  console.log('8) 退货/退款...');
  anomalies.push(...(await auditReturnsAndRefunds(options)));

  console.log('9) 厂家直发...');
  anomalies.push(...(await auditFactoryShipments(options)));

  console.log('10) 采购/入库...');
  anomalies.push(...(await auditPurchaseOrders(options)));

  const issueCounts = new Map<string, number>();
  for (const a of anomalies) {
    const key = `${a.domain}:${a.code}`;
    issueCounts.set(key, (issueCounts.get(key) ?? 0) + 1);
  }

  console.log('\n' + '='.repeat(70));
  console.log(`✅ 审计完成：异常 ${anomalies.length} 条`);
  const top = Array.from(issueCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  if (top.length > 0) {
    console.log('\n📌 异常分布（Top 20）：');
    for (const [k, c] of top) console.log(`   - ${k}: ${c}`);
  } else {
    console.log('\n🎉 未发现异常（或在容差范围内一致）');
  }

  const report = {
    meta: {
      generatedAt: new Date().toISOString(),
      filter: {
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate ? endDate.toISOString() : null,
        startDateLocal: startDate ? formatLocalYmd(startDate) : null,
        endDateLocal: endDate ? formatLocalYmd(endDate) : null,
      },
      anomalyCount: anomalies.length,
      issueCounts: Object.fromEntries(issueCounts),
    },
    anomalies,
  };

  const jsonPath = `${outPrefix}.json`;
  const csvPath = `${outPrefix}.csv`;

  try {
    if (format === 'both' || format === 'json') {
      ensureDirForFile(jsonPath);
      fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');
      console.log(`\n📄 JSON：${jsonPath}`);
    }

    if (format === 'both' || format === 'csv') {
      ensureDirForFile(csvPath);
      const header = [
        'domain',
        'code',
        'message',
        'entityType',
        'entityId',
        'entityNumber',
        'createdAt',
        'expected',
        'actual',
        'diff',
        'extra',
      ].join(',');
      const lines: string[] = [header];
      for (const a of anomalies) {
        lines.push(
          [
            a.domain,
            a.code,
            a.message,
            a.entityType,
            a.entityId,
            a.entityNumber ?? '',
            a.createdAt ?? '',
            a.expected ?? '',
            a.actual ?? '',
            a.diff ?? '',
            a.extra ? JSON.stringify(a.extra) : '',
          ]
            .map(toCsvValue)
            .join(',')
        );
      }
      fs.writeFileSync(csvPath, lines.join('\n'), 'utf-8');
      console.log(`📄 CSV：${csvPath}`);
    }
  } catch (err) {
    console.warn('\n⚠️ 写报告失败：', (err as Error).message);
  }

  if (failOnIssues && anomalies.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch(err => {
    console.error('\n❌ 审计失败：', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
