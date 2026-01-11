/**
 * 销售/财务口径偏差审计脚本
 *
 * 目标：
 * - 发现历史数据中“订单金额/费用/成本/出库”口径不一致导致的报表偏差
 * - 输出可落地的“异常清单”，便于逐单修复或做数据回填
 *
 * 运行示例：
 *   npm run audit:sales-finance
 *   npm run audit:sales-finance -- 2025-01-01 2025-12-31
 *   npm run audit:sales-finance -- --start 2025-01-01 --end 2025-12-31 --out ./test-results/sales-finance-audit
 *
 * 参数：
 * - 日期：支持位置参数（start end）或 flags（--start/--end），格式 YYYY-MM-DD
 * - 输出：--out <prefix>（默认写入 ./test-results/），会生成 .json + .csv
 * - 分页：--batch <n>（默认 200）
 * - 限制：--take <n>（仅审计前 n 条，便于快速验证）
 * - 退出码：--fail（发现异常时 exitCode=1）
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
  code: string;
  message: string;
  expected?: number;
  actual?: number;
  diff?: number;
  itemId?: string;
  productId?: string | null;
  variantId?: string | null;
};

type OrderIssue = {
  orderId: string;
  orderNumber: string;
  createdAt: string;
  status: string;
  orderType: string;
  transferMode: string;
  issues: Anomaly[];
};

const EPS_CURRENCY = 0.01;
const EPS_QTY = 0.001;

function roundCurrency(value: number): number {
  return Math.round((value ?? 0) * 100) / 100;
}

function nearlyEqual(a: number, b: number, eps = EPS_CURRENCY): boolean {
  return Math.abs((a ?? 0) - (b ?? 0)) <= eps;
}

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
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
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

  const getFlag = (name: string): string | undefined => {
    const idx = args.findIndex(a => a === name);
    if (idx < 0) return undefined;
    return args[idx + 1];
  };

  const hasFlag = (name: string): boolean => args.includes(name);

  const startArg = getFlag('--start') ?? positionalStart;
  const endArg = getFlag('--end') ?? positionalEnd;
  const startDate = parseDate(startArg);
  const endDate = parseDate(endArg);

  const outPrefixRaw = getFlag('--out');
  const format = (getFlag('--format') as OutputFormat | undefined) ?? 'both';
  const batchSize = Number(getFlag('--batch') ?? 200);
  const takeRaw = getFlag('--take');
  const take = takeRaw ? Number(takeRaw) : undefined;
  const failOnIssues = hasFlag('--fail');

  const safeBatchSize = Number.isFinite(batchSize) && batchSize > 0 ? batchSize : 200;
  const safeTake = take !== undefined && Number.isFinite(take) && take > 0 ? take : undefined;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const defaultOutPrefix = path.join(
    'test-results',
    `sales-finance-audit-${timestamp}`
  );

  return {
    startDate,
    endDate,
    outPrefix: outPrefixRaw || defaultOutPrefix,
    format,
    batchSize: safeBatchSize,
    take: safeTake,
    failOnIssues,
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

function makePvKey(productId: string, variantId: string | null): string {
  return `${productId}|${variantId ?? ''}`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { startDate, endDate, outPrefix, format, batchSize, take } = options;

  console.log('🔎 开始审计销售/财务口径偏差...');
  if (startDate || endDate) {
    console.log(
      `   过滤条件：${startDate ? formatLocalYmd(startDate) : '（最早）'} ~ ${
        endDate ? formatLocalYmd(endDate) : '（最晚）'
      }`
    );
  } else {
    console.log('   过滤条件：未指定日期，审计所有销售订单');
  }
  console.log(`   分页：batch=${batchSize}${take ? `, take=${take}` : ''}`);
  console.log(`   输出：${format} -> ${outPrefix}.{json,csv}\n`);

  const whereCreatedAt = buildCreatedAtWhere(startDate, endDate);

  const allIssues: OrderIssue[] = [];
  const issueCounts = new Map<string, number>();

  let cursorId: string | undefined;
  let scanned = 0;

  while (true) {
    const remainingTake = take ? Math.max(0, take - scanned) : undefined;
    const pageTake = remainingTake ? Math.min(batchSize, remainingTake) : batchSize;
    if (pageTake <= 0) break;

    const orders = await prisma.salesOrder.findMany({
      where: {
        ...whereCreatedAt,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: pageTake,
      ...(cursorId
        ? {
            cursor: { id: cursorId },
            skip: 1,
          }
        : {}),
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        status: true,
        orderType: true,
        transferMode: true,
        itemsAmount: true,
        additionalFees: true,
        totalAmount: true,
        roundingAdjustment: true,
        expenseAmount: true,
        costAmount: true,
        profitAmount: true,
        paidAmount: true,
        items: {
          select: {
            id: true,
            productId: true,
            variantId: true,
            quantity: true,
            subtotal: true,
            unitCost: true,
            localQuantity: true,
            transferQuantity: true,
            allocatedExpense: true,
            costSubtotal: true,
            isManualProduct: true,
            manualProductName: true,
          },
        },
        feeItems: {
          select: {
            feeAmount: true,
            paidBy: true,
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
      where: {
        salesOrderId: { in: orderIds },
      },
      _sum: {
        quantity: true,
      },
    });

    const outboundMap = new Map<string, Map<string, number>>();
    for (const row of outboundGroups) {
      const orderId = row.salesOrderId;
      if (!orderId) continue;
      const pvKey = makePvKey(row.productId, row.variantId ?? null);
      const qty = Number(row._sum.quantity ?? 0);
      if (!outboundMap.has(orderId)) outboundMap.set(orderId, new Map());
      outboundMap.get(orderId)!.set(pvKey, qty);
    }

    const ledgerExpenseGroups = await prisma.expenseRecord.groupBy({
      by: ['relatedId'],
      where: {
        relatedType: 'sales_order',
        relatedId: { in: orderIds },
      },
      _sum: {
        expenseAmount: true,
      },
    });
    const ledgerExpenseMap = new Map<string, number>();
    for (const row of ledgerExpenseGroups) {
      const orderId = row.relatedId;
      if (!orderId) continue;
      ledgerExpenseMap.set(orderId, Number(row._sum.expenseAmount ?? 0));
    }

    const paymentGroups = await prisma.paymentRecord.groupBy({
      by: ['salesOrderId', 'status'],
      where: {
        salesOrderId: { in: orderIds },
      },
      _sum: {
        paymentAmount: true,
      },
    });
    const paymentSumByOrder = new Map<
      string,
      { confirmed: number; all: number; cancelled: number }
    >();
    for (const row of paymentGroups) {
      const orderId = row.salesOrderId;
      if (!orderId) continue;
      const amount = Number(row._sum.paymentAmount ?? 0);
      const current = paymentSumByOrder.get(orderId) ?? {
        confirmed: 0,
        all: 0,
        cancelled: 0,
      };
      current.all += amount;
      if (row.status === 'confirmed') current.confirmed += amount;
      if (row.status === 'cancelled') current.cancelled += amount;
      paymentSumByOrder.set(orderId, current);
    }

    for (const order of orders) {
      const issues: Anomaly[] = [];

      const orderItemsAmount = roundCurrency(Number(order.itemsAmount ?? 0));
      const orderAdditionalFees = roundCurrency(Number(order.additionalFees ?? 0));
      const orderTotalAmount = roundCurrency(Number(order.totalAmount ?? 0));
      const orderRounding = roundCurrency(Number(order.roundingAdjustment ?? 0));
      const orderExpenseAmount = roundCurrency(Number(order.expenseAmount ?? 0));
      const orderCostAmount = roundCurrency(Number(order.costAmount ?? 0));
      const orderProfitAmount = roundCurrency(Number(order.profitAmount ?? 0));

      const computedItemsAmount = roundCurrency(
        order.items.reduce((sum, item) => sum + Number(item.subtotal ?? 0), 0)
      );

      const computedCustomerFees = roundCurrency(
        order.feeItems.reduce((sum, fee) => {
          const paidBy = (fee.paidBy as string | null) ?? 'customer';
          if (paidBy === 'company') return sum;
          return sum + Number(fee.feeAmount ?? 0);
        }, 0)
      );

      const computedCompanyFees = roundCurrency(
        order.feeItems.reduce((sum, fee) => {
          const paidBy = (fee.paidBy as string | null) ?? 'customer';
          if (paidBy !== 'company') return sum;
          return sum + Number(fee.feeAmount ?? 0);
        }, 0)
      );

      const computedTotalAmount = roundCurrency(
        computedItemsAmount + computedCustomerFees
      );

      const expectedTotalFromOrderFields = roundCurrency(
        orderItemsAmount + orderAdditionalFees
      );

      if (!nearlyEqual(orderItemsAmount, computedItemsAmount)) {
        issues.push({
          code: 'ITEMS_AMOUNT_MISMATCH',
          message: 'salesOrder.itemsAmount 与明细 subtotal 汇总不一致',
          expected: computedItemsAmount,
          actual: orderItemsAmount,
          diff: roundCurrency(orderItemsAmount - computedItemsAmount),
        });
      }

      if (!nearlyEqual(orderAdditionalFees, computedCustomerFees)) {
        issues.push({
          code: 'ADDITIONAL_FEES_MISMATCH',
          message: 'salesOrder.additionalFees 与 feeItems(客户承担) 汇总不一致',
          expected: computedCustomerFees,
          actual: orderAdditionalFees,
          diff: roundCurrency(orderAdditionalFees - computedCustomerFees),
        });
      }

      if (!nearlyEqual(orderExpenseAmount, computedCompanyFees)) {
        issues.push({
          code: 'EXPENSE_AMOUNT_MISMATCH',
          message: 'salesOrder.expenseAmount 与 feeItems(公司承担) 汇总不一致',
          expected: computedCompanyFees,
          actual: orderExpenseAmount,
          diff: roundCurrency(orderExpenseAmount - computedCompanyFees),
        });
      }

      if (!nearlyEqual(orderTotalAmount, expectedTotalFromOrderFields)) {
        issues.push({
          code: 'TOTAL_AMOUNT_MISMATCH_FIELDS',
          message: 'salesOrder.totalAmount 与 itemsAmount+additionalFees 不一致（口径：total 不含抹零）',
          expected: expectedTotalFromOrderFields,
          actual: orderTotalAmount,
          diff: roundCurrency(orderTotalAmount - expectedTotalFromOrderFields),
        });
      }

      if (!nearlyEqual(orderTotalAmount, computedTotalAmount)) {
        issues.push({
          code: 'TOTAL_AMOUNT_MISMATCH_COMPUTED',
          message: 'salesOrder.totalAmount 与明细口径（subtotal+客户承担费用）不一致',
          expected: computedTotalAmount,
          actual: orderTotalAmount,
          diff: roundCurrency(orderTotalAmount - computedTotalAmount),
        });
      }

      // 抹零口径：实际应收 = totalAmount + roundingAdjustment
      const actualDue = roundCurrency(orderTotalAmount + orderRounding);
      if (Number.isFinite(actualDue) && actualDue < -EPS_CURRENCY) {
        issues.push({
          code: 'NEGATIVE_DUE_AMOUNT',
          message: '实际应收为负（totalAmount + roundingAdjustment < 0）',
          actual: actualDue,
        });
      }

      // 台账费用对齐（如果存在）
      const ledgerExpense = roundCurrency(ledgerExpenseMap.get(order.id) ?? 0);
      if (!nearlyEqual(ledgerExpense, computedCompanyFees)) {
        issues.push({
          code: 'LEDGER_EXPENSE_MISMATCH',
          message:
            "expenseRecord(relatedType='sales_order') 与 feeItems(公司承担) 汇总不一致",
          expected: computedCompanyFees,
          actual: ledgerExpense,
          diff: roundCurrency(ledgerExpense - computedCompanyFees),
        });
      }

      // 付款聚合（对比 salesOrder.paidAmount 的历史一致性）
      const payAgg = paymentSumByOrder.get(order.id) ?? {
        confirmed: 0,
        all: 0,
        cancelled: 0,
      };
      const paidAmountStored = roundCurrency(Number(order.paidAmount ?? 0));
      const paidConfirmed = roundCurrency(payAgg.confirmed);
      if (!nearlyEqual(paidAmountStored, paidConfirmed)) {
        issues.push({
          code: 'PAID_AMOUNT_MISMATCH',
          message:
            'salesOrder.paidAmount 与 paymentRecord(confirmed) 汇总不一致（可能是历史字段未同步）',
          expected: paidConfirmed,
          actual: paidAmountStored,
          diff: roundCurrency(paidAmountStored - paidConfirmed),
        });
      }

      // 调货模式一致性：重点关注 MIXED 的数量拆分与 unitCost
      const isTransfer = order.orderType === 'TRANSFER';
      const isMixedTransfer = isTransfer && order.transferMode === 'MIXED';
      const isSupplierOnlyTransfer =
        isTransfer && order.transferMode === 'SUPPLIER_ONLY';

      for (const item of order.items) {
        const isManual = Boolean(item.isManualProduct);
        if (isManual && !item.manualProductName) {
          issues.push({
            code: 'MANUAL_PRODUCT_NAME_MISSING',
            message: '手动商品缺少 manualProductName（可能影响对账与出库关联）',
            itemId: item.id,
          });
        }

        const quantity = Number(item.quantity ?? 0);
        const localQuantity = Number(item.localQuantity ?? 0);
        const transferQuantity = Number(item.transferQuantity ?? 0);

        if (isMixedTransfer) {
          if (localQuantity < -EPS_QTY || transferQuantity < -EPS_QTY) {
            issues.push({
              code: 'MIXED_NEGATIVE_QTY',
              message: 'MIXED 明细存在负数 localQuantity/transferQuantity',
              itemId: item.id,
              expected: 0,
              actual: Math.min(localQuantity, transferQuantity),
            });
          }

          if (!nearlyEqual(quantity, localQuantity + transferQuantity, EPS_QTY)) {
            issues.push({
              code: 'MIXED_SPLIT_MISMATCH',
              message: 'MIXED 明细 quantity != localQuantity + transferQuantity',
              itemId: item.id,
              expected: roundCurrency(localQuantity + transferQuantity),
              actual: roundCurrency(quantity),
              diff: roundCurrency(quantity - (localQuantity + transferQuantity)),
            });
          }

          if (transferQuantity > EPS_QTY && !(Number(item.unitCost ?? 0) > 0)) {
            issues.push({
              code: 'MIXED_TRANSFER_MISSING_UNIT_COST',
              message: 'MIXED 明细存在 transferQuantity>0 但 unitCost<=0',
              itemId: item.id,
              actual: Number(item.unitCost ?? 0),
            });
          }
        } else if (isSupplierOnlyTransfer) {
          if (localQuantity > EPS_QTY) {
            issues.push({
              code: 'SUPPLIER_ONLY_LOCAL_QTY_NONZERO',
              message: 'SUPPLIER_ONLY 明细 localQuantity 应为 0',
              itemId: item.id,
              expected: 0,
              actual: localQuantity,
              diff: roundCurrency(localQuantity),
            });
          }
          if (!nearlyEqual(transferQuantity, quantity, EPS_QTY)) {
            issues.push({
              code: 'SUPPLIER_ONLY_TRANSFER_QTY_MISMATCH',
              message: 'SUPPLIER_ONLY 明细 transferQuantity 应等于 quantity（建议回填）',
              itemId: item.id,
              expected: roundCurrency(quantity),
              actual: roundCurrency(transferQuantity),
              diff: roundCurrency(transferQuantity - quantity),
            });
          }
          if (!(Number(item.unitCost ?? 0) > 0)) {
            issues.push({
              code: 'TRANSFER_UNIT_COST_MISSING',
              message: '调货明细 unitCost<=0（可能导致成本/利润为 0）',
              itemId: item.id,
              actual: Number(item.unitCost ?? 0),
            });
          }
        } else if (!isTransfer) {
          if (localQuantity > EPS_QTY || transferQuantity > EPS_QTY) {
            issues.push({
              code: 'NORMAL_HAS_TRANSFER_FIELDS',
              message: '普通销售明细存在 localQuantity/transferQuantity（建议清理或统一口径）',
              itemId: item.id,
              actual: roundCurrency(localQuantity + transferQuantity),
            });
          }
        }
      }

      // 成本/利润：只在非草稿/非取消阶段强校验（草稿可能未形成稳定成本）
      const shouldCheckCost =
        order.status !== 'draft' && order.status !== 'cancelled';
      if (shouldCheckCost) {
        const itemCostSubtotals = order.items.map(i => i.costSubtotal);
        const hasMissingCost = itemCostSubtotals.some(v => v === null || v === undefined);
        const sumItemCost = roundCurrency(
          itemCostSubtotals.reduce((sum: number, v) => sum + Number(v ?? 0), 0)
        );

        if (hasMissingCost && orderCostAmount > EPS_CURRENCY) {
          issues.push({
            code: 'ITEM_COST_SUBTOTAL_MISSING',
            message: '订单已进入业务流转，但存在明细 costSubtotal 为空（建议回填/重算成本）',
            actual: orderCostAmount,
          });
        }

        if (!hasMissingCost && !nearlyEqual(orderCostAmount, sumItemCost, 0.05)) {
          issues.push({
            code: 'COST_AMOUNT_MISMATCH',
            message: 'salesOrder.costAmount 与明细 costSubtotal 汇总不一致',
            expected: sumItemCost,
            actual: orderCostAmount,
            diff: roundCurrency(orderCostAmount - sumItemCost),
          });
        }

        const expectedProfit = roundCurrency(orderItemsAmount - orderCostAmount);
        if (!nearlyEqual(orderProfitAmount, expectedProfit, 0.05)) {
          issues.push({
            code: 'PROFIT_AMOUNT_MISMATCH',
            message: 'salesOrder.profitAmount 与 itemsAmount - costAmount 不一致',
            expected: expectedProfit,
            actual: orderProfitAmount,
            diff: roundCurrency(orderProfitAmount - expectedProfit),
          });
        }
      }

      // 出库一致性：已发货/已完成阶段，核对 OutboundRecord 与应出库数量
      const shouldCheckOutbound =
        order.status === 'shipped' || order.status === 'completed';
      if (shouldCheckOutbound) {
        const expectedOutboundByPv = new Map<string, number>();
        for (const item of order.items) {
          if (!item.productId) continue;
          const pvKey = makePvKey(item.productId, item.variantId ?? null);
          const qty = Number(item.quantity ?? 0);
          const localQty = Number(item.localQuantity ?? 0);
          const expected =
            order.orderType === 'TRANSFER'
              ? order.transferMode === 'MIXED'
                ? localQty
                : 0
              : qty;
          expectedOutboundByPv.set(
            pvKey,
            (expectedOutboundByPv.get(pvKey) ?? 0) + expected
          );
        }

        const actualOutboundByPv = outboundMap.get(order.id) ?? new Map<string, number>();
        const allPvKeys = new Set([
          ...Array.from(expectedOutboundByPv.keys()),
          ...Array.from(actualOutboundByPv.keys()),
        ]);

        for (const pvKey of allPvKeys) {
          const expected = roundCurrency(expectedOutboundByPv.get(pvKey) ?? 0);
          const actual = roundCurrency(actualOutboundByPv.get(pvKey) ?? 0);

          if (expected <= EPS_QTY && actual > EPS_QTY) {
            issues.push({
              code: 'OUTBOUND_UNEXPECTED',
              message: '存在出库记录但该模式下不应出库（调货/纯外部调货）',
              expected: 0,
              actual,
              diff: roundCurrency(actual),
            });
            continue;
          }

          if (expected > EPS_QTY && actual <= EPS_QTY) {
            issues.push({
              code: 'OUTBOUND_MISSING',
              message: '应出库但未找到出库记录（可能影响库存与成本）',
              expected,
              actual,
              diff: roundCurrency(actual - expected),
            });
            continue;
          }

          if (expected > EPS_QTY && !nearlyEqual(expected, actual, 0.05)) {
            issues.push({
              code: 'OUTBOUND_QTY_MISMATCH',
              message: '出库数量与应出库数量不一致（按 product+variant 汇总）',
              expected,
              actual,
              diff: roundCurrency(actual - expected),
            });
          }
        }
      }

      if (issues.length > 0) {
        allIssues.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          createdAt: order.createdAt.toISOString(),
          status: order.status,
          orderType: order.orderType,
          transferMode: order.transferMode,
          issues,
        });
        for (const issue of issues) {
          issueCounts.set(issue.code, (issueCounts.get(issue.code) ?? 0) + 1);
        }
      }

      if (!take) {
        // 控制台反馈节奏：每处理 500 单打印一次
        if (scanned % 500 === 0) {
          console.log(`   ...已扫描 ${scanned} 单，累计异常订单 ${allIssues.length} 单`);
        }
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`✅ 扫描完成：共扫描 ${scanned} 单，发现异常订单 ${allIssues.length} 单`);

  const topIssues = Array.from(issueCounts.entries()).sort((a, b) => b[1] - a[1]);
  if (topIssues.length > 0) {
    console.log('\n📌 异常类型分布（按出现次数排序）：');
    for (const [code, count] of topIssues.slice(0, 20)) {
      console.log(`   - ${code}: ${count}`);
    }
    if (topIssues.length > 20) {
      console.log(`   ... 其余 ${topIssues.length - 20} 类已省略`);
    }
  } else {
    console.log('\n🎉 未发现异常（或在容差范围内一致）');
  }

  const jsonPath = `${outPrefix}.json`;
  const csvPath = `${outPrefix}.csv`;

  const report = {
    meta: {
      generatedAt: new Date().toISOString(),
      filter: {
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate ? endDate.toISOString() : null,
        startDateLocal: startDate ? formatLocalYmd(startDate) : null,
        endDateLocal: endDate ? formatLocalYmd(endDate) : null,
      },
      scannedOrders: scanned,
      issueOrders: allIssues.length,
      issueCounts: Object.fromEntries(issueCounts),
    },
    issues: allIssues,
  };

  try {
    if (format === 'both' || format === 'json') {
      ensureDirForFile(jsonPath);
      fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');
      console.log(`\n📄 JSON 报告已写入：${jsonPath}`);
    }

    if (format === 'both' || format === 'csv') {
      ensureDirForFile(csvPath);
      const header = [
        'orderNumber',
        'createdAt',
        'status',
        'orderType',
        'transferMode',
        'code',
        'message',
        'expected',
        'actual',
        'diff',
        'itemId',
      ].join(',');

      const lines: string[] = [header];
      for (const order of allIssues) {
        for (const issue of order.issues) {
          lines.push(
            [
              order.orderNumber,
              order.createdAt,
              order.status,
              order.orderType,
              order.transferMode,
              issue.code,
              issue.message,
              issue.expected ?? '',
              issue.actual ?? '',
              issue.diff ?? '',
              issue.itemId ?? '',
            ]
              .map(toCsvValue)
              .join(',')
          );
        }
      }
      fs.writeFileSync(csvPath, lines.join('\n'), 'utf-8');
      console.log(`📄 CSV 清单已写入：${csvPath}`);
    }
  } catch (writeError) {
    console.warn('\n⚠️  报告写入失败：', (writeError as Error).message);
  }

  if (options.failOnIssues && allIssues.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch(err => {
    console.error('\n❌ 审计过程发生错误：', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
