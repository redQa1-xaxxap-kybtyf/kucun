/**
 * 销售/财务口径偏差回填（安全版）
 *
 * 目标：
 * - 对“可确定”的偏差做自动回填（默认 dry-run，不会写库）
 * - 对“不可确定”的偏差只输出清单，交由人工核对
 *
 * 回填范围（仅做确定性修复）：
 * - 订单头：itemsAmount / additionalFees / expenseAmount / totalAmount / profitAmount
 *   - itemsAmount = Σ item.subtotal
 *   - additionalFees = Σ feeItems(paidBy=customer) feeAmount
 *   - expenseAmount = Σ feeItems(paidBy=company) feeAmount
 *   - totalAmount = itemsAmount + additionalFees（不含 roundingAdjustment）
 *   - profitAmount = itemsAmount - costAmount（利润统一口径）
 * - 明细（确定性）：
 *   - TRANSFER + SUPPLIER_ONLY：localQuantity=0，transferQuantity=quantity
 *   - NORMAL：localQuantity=0，transferQuantity=0
 *
 * 运行示例：
 *   npm run remediate:sales-finance
 *   npm run remediate:sales-finance -- 2025-01-01 2025-12-31
 *   npm run remediate:sales-finance -- --apply --out test-results/sales-finance-remediate
 */

import fs from 'fs';
import path from 'path';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

type Options = {
  startDate?: Date;
  endDate?: Date;
  outPrefix: string;
  apply: boolean;
  batchSize: number;
};

function parseArgs(argv: string[]): Options {
  const args = [...argv];

  const getFlag = (name: string): string | undefined => {
    const idx = args.findIndex(a => a === name);
    if (idx < 0) return undefined;
    return args[idx + 1];
  };
  const hasFlag = (name: string): boolean => args.includes(name);

  const first = args[0];
  const second = args[1];
  const positionalStart = first && !first.startsWith('--') ? first : undefined;
  const positionalEnd =
    positionalStart && second && !second.startsWith('--') ? second : undefined;

  const startArg = getFlag('--start') ?? positionalStart;
  const endArg = getFlag('--end') ?? positionalEnd;
  const startDate = parseDate(startArg);
  const endDate = parseDate(endArg);

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outPrefix =
    getFlag('--out') ??
    path.join('test-results', `sales-finance-remediate-${ts}`);
  const batchSize = Number(getFlag('--batch') ?? 200);

  return {
    startDate,
    endDate,
    outPrefix,
    apply: hasFlag('--apply'),
    batchSize: Number.isFinite(batchSize) && batchSize > 0 ? batchSize : 200,
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

type ProposedOrderUpdate = {
  orderId: string;
  orderNumber: string;
  status: string;
  updates: Partial<{
    itemsAmount: number;
    additionalFees: number;
    expenseAmount: number;
    totalAmount: number;
    profitAmount: number;
  }>;
};

type ProposedItemUpdate = {
  itemId: string;
  orderId: string;
  orderNumber: string;
  orderType: string;
  transferMode: string;
  status: string;
  from: { localQuantity: number; transferQuantity: number };
  to: { localQuantity: number; transferQuantity: number };
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { startDate, endDate, outPrefix, apply, batchSize } = options;

  console.log('🧹 开始回填销售/财务口径偏差（安全版）...');
  console.log(`   模式：${apply ? 'APPLY（写库）' : 'DRY-RUN（不写库）'}`);
  if (startDate || endDate) {
    console.log(
      `   过滤条件：${startDate ? startDate.toISOString().slice(0, 10) : '（最早）'} ~ ${
        endDate ? endDate.toISOString().slice(0, 10) : '（最晚）'
      }`
    );
  } else {
    console.log('   过滤条件：未指定日期，处理所有销售订单');
  }
  console.log(`   分页：batch=${batchSize}`);
  console.log(`   输出：${outPrefix}.{json,csv}\n`);

  const whereCreatedAt = buildCreatedAtWhere(startDate, endDate);

  const proposedOrderUpdates: ProposedOrderUpdate[] = [];
  const proposedItemUpdates: ProposedItemUpdate[] = [];
  const manualIssues: Array<{
    orderNumber: string;
    message: string;
    itemId?: string;
  }> = [];

  let cursorId: string | undefined;
  let scanned = 0;
  let appliedOrderUpdates = 0;
  let appliedItemUpdates = 0;

  while (true) {
    const orders = await prisma.salesOrder.findMany({
      where: {
        ...whereCreatedAt,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: batchSize,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        status: true,
        orderType: true,
        transferMode: true,
        itemsAmount: true,
        additionalFees: true,
        expenseAmount: true,
        totalAmount: true,
        roundingAdjustment: true,
        costAmount: true,
        profitAmount: true,
        items: {
          select: {
            id: true,
            quantity: true,
            subtotal: true,
            localQuantity: true,
            transferQuantity: true,
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

    for (const order of orders) {
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

      const orderItemsAmount = roundCurrency(Number(order.itemsAmount ?? 0));
      const orderAdditionalFees = roundCurrency(
        Number(order.additionalFees ?? 0)
      );
      const orderExpenseAmount = roundCurrency(
        Number(order.expenseAmount ?? 0)
      );
      const orderTotalAmount = roundCurrency(Number(order.totalAmount ?? 0));
      const orderCostAmount = roundCurrency(Number(order.costAmount ?? 0));
      const orderProfitAmount = roundCurrency(Number(order.profitAmount ?? 0));

      const orderUpdate: ProposedOrderUpdate['updates'] = {};

      if (!nearlyEqual(orderItemsAmount, computedItemsAmount)) {
        orderUpdate.itemsAmount = computedItemsAmount;
      }
      if (!nearlyEqual(orderAdditionalFees, computedCustomerFees)) {
        orderUpdate.additionalFees = computedCustomerFees;
      }
      if (!nearlyEqual(orderExpenseAmount, computedCompanyFees)) {
        orderUpdate.expenseAmount = computedCompanyFees;
      }
      if (!nearlyEqual(orderTotalAmount, computedTotalAmount)) {
        orderUpdate.totalAmount = computedTotalAmount;
      }

      // 利润统一口径（不改成本，只改利润字段）
      const computedProfit = roundCurrency(
        computedItemsAmount - orderCostAmount
      );
      if (!nearlyEqual(orderProfitAmount, computedProfit, 0.05)) {
        orderUpdate.profitAmount = computedProfit;
      }

      if (Object.keys(orderUpdate).length > 0) {
        proposedOrderUpdates.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          updates: orderUpdate,
        });

        if (apply) {
          await prisma.salesOrder.update({
            where: { id: order.id },
            data: orderUpdate,
          });
          appliedOrderUpdates += 1;
        }
      }

      // 明细确定性修复（不在 shipped/completed 上做自动更改）
      const allowItemFix =
        order.status === 'draft' || order.status === 'confirmed';

      if (!allowItemFix) {
        continue;
      }

      for (const item of order.items) {
        const quantity = Number(item.quantity ?? 0);
        const currentLocal = Number(item.localQuantity ?? 0);
        const currentTransfer = Number(item.transferQuantity ?? 0);

        if (
          order.orderType === 'TRANSFER' &&
          order.transferMode === 'SUPPLIER_ONLY'
        ) {
          const nextLocal = 0;
          const nextTransfer = quantity;
          if (
            !nearlyEqual(currentLocal, nextLocal, EPS_QTY) ||
            !nearlyEqual(currentTransfer, nextTransfer, EPS_QTY)
          ) {
            proposedItemUpdates.push({
              itemId: item.id,
              orderId: order.id,
              orderNumber: order.orderNumber,
              orderType: order.orderType,
              transferMode: order.transferMode,
              status: order.status,
              from: {
                localQuantity: currentLocal,
                transferQuantity: currentTransfer,
              },
              to: { localQuantity: nextLocal, transferQuantity: nextTransfer },
            });

            if (apply) {
              await prisma.salesOrderItem.update({
                where: { id: item.id },
                data: {
                  localQuantity: nextLocal,
                  transferQuantity: nextTransfer,
                },
              });
              appliedItemUpdates += 1;
            }
          }
          continue;
        }

        if (order.orderType !== 'TRANSFER') {
          const nextLocal = 0;
          const nextTransfer = 0;
          if (
            !nearlyEqual(currentLocal, nextLocal, EPS_QTY) ||
            !nearlyEqual(currentTransfer, nextTransfer, EPS_QTY)
          ) {
            proposedItemUpdates.push({
              itemId: item.id,
              orderId: order.id,
              orderNumber: order.orderNumber,
              orderType: order.orderType,
              transferMode: order.transferMode,
              status: order.status,
              from: {
                localQuantity: currentLocal,
                transferQuantity: currentTransfer,
              },
              to: { localQuantity: nextLocal, transferQuantity: nextTransfer },
            });

            if (apply) {
              await prisma.salesOrderItem.update({
                where: { id: item.id },
                data: {
                  localQuantity: nextLocal,
                  transferQuantity: nextTransfer,
                },
              });
              appliedItemUpdates += 1;
            }
          }
          continue;
        }

        if (order.orderType === 'TRANSFER' && order.transferMode === 'MIXED') {
          // MIXED 拆分不可确定：只输出人工清单
          if (!nearlyEqual(quantity, currentLocal + currentTransfer, EPS_QTY)) {
            manualIssues.push({
              orderNumber: order.orderNumber,
              itemId: item.id,
              message:
                'MIXED 明细 quantity != localQuantity + transferQuantity（建议人工核对后回填）',
            });
          }
        }
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`✅ 扫描完成：共扫描 ${scanned} 单`);
  console.log(`   - 订单头拟回填：${proposedOrderUpdates.length} 单`);
  console.log(`   - 明细拟回填：${proposedItemUpdates.length} 条`);
  console.log(`   - 人工核对：${manualIssues.length} 条`);
  if (apply) {
    console.log('\n🧾 写库结果：');
    console.log(`   - 已回填订单头：${appliedOrderUpdates} 单`);
    console.log(`   - 已回填明细：${appliedItemUpdates} 条`);
  }

  const reportPath = `${outPrefix}.json`;
  const csvPath = `${outPrefix}.csv`;

  const report = {
    meta: {
      generatedAt: new Date().toISOString(),
      apply,
      scannedOrders: scanned,
      proposedOrderUpdates: proposedOrderUpdates.length,
      proposedItemUpdates: proposedItemUpdates.length,
      manualIssues: manualIssues.length,
    },
    orderUpdates: proposedOrderUpdates,
    itemUpdates: proposedItemUpdates,
    manualIssues,
  };

  try {
    ensureDirForFile(reportPath);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`\n📄 JSON 报告已写入：${reportPath}`);

    ensureDirForFile(csvPath);
    const header = [
      'kind',
      'orderNumber',
      'status',
      'orderType',
      'transferMode',
      'id',
      'field',
      'from',
      'to',
      'message',
    ].join(',');

    const lines: string[] = [header];

    for (const row of proposedOrderUpdates) {
      for (const [field, to] of Object.entries(row.updates)) {
        lines.push(
          [
            'order',
            row.orderNumber,
            row.status,
            '',
            '',
            row.orderId,
            field,
            '',
            to,
            '',
          ]
            .map(toCsvValue)
            .join(',')
        );
      }
    }

    for (const row of proposedItemUpdates) {
      lines.push(
        [
          'item',
          row.orderNumber,
          row.status,
          row.orderType,
          row.transferMode,
          row.itemId,
          'localQuantity/transferQuantity',
          JSON.stringify(row.from),
          JSON.stringify(row.to),
          '',
        ]
          .map(toCsvValue)
          .join(',')
      );
    }

    for (const row of manualIssues) {
      lines.push(
        [
          'manual',
          row.orderNumber,
          '',
          '',
          '',
          row.itemId ?? '',
          '',
          '',
          '',
          row.message,
        ]
          .map(toCsvValue)
          .join(',')
      );
    }

    fs.writeFileSync(csvPath, lines.join('\n'), 'utf-8');
    console.log(`📄 CSV 清单已写入：${csvPath}`);
  } catch (err) {
    console.warn('\n⚠️  报告写入失败：', (err as Error).message);
  }
}

main()
  .catch(err => {
    console.error('\n❌ 回填过程发生错误：', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
