/**
 * 修复（可选）采购链路历史异常：仅用于开发环境自查/清理
 *
 * 默认 dry-run：只输出将要修复的数量，不写库
 * --apply：执行修复
 *
 * 覆盖项：
 * 1) PurchaseOrderItem.totalPrice 统一回写为 roundToTwoDecimals(quantity * unitPrice)
 * 2) PurchaseOrder.totalAmount 统一回写为 sum(item.totalPrice)
 * 3) 采购单无明细但 totalAmount != 0：回写 totalAmount = 0
 * 4) InboundRecord 已关联 purchaseOrderId 但缺少 purchaseOrderItemId：尝试按 (productId + batchNumber) 唯一匹配补齐；无法唯一匹配则跳过
 */

import { prisma } from '@/lib/db';
import { roundToTwoDecimals } from '@/lib/services/factory-shipment-expense-service';
import {
  calculatePurchaseOrderTotal,
  computePurchaseOrderItemTotalPrice,
} from '@/lib/services/purchase-order-totals';

type Options = {
  apply: boolean;
  batchSize: number;
  orphanPurchaseInboundMode: 'skip' | 'link' | 'convert';
  missingItemInboundMode: 'skip' | 'link' | 'convert';
};

function parseArgs(argv: string[]): Options {
  if (argv.includes('--help') || argv.includes('-h')) {
    // eslint-disable-next-line no-console
    console.log(`
Usage:
  npm run remediate:purchase -- [--apply] [--batchSize 200]
                            [--orphanPurchaseInbound=skip|link|convert]
                            [--missingItemInbound=skip|link|convert]

Notes:
  - default is dry-run (no DB writes)
  - orphanPurchaseInbound: InboundRecord.reason='purchase' but purchaseOrderId is null
    - link: try to link by unique (productId + batchNumber) match to PurchaseOrderItem
    - convert: set reason='other' and clear purchase fields
  - missingItemInbound: InboundRecord has purchaseOrderId but purchaseOrderItemId is null
    - link: try to link within the order by (productId + batchNumber) or productId-only unique
    - convert: set reason='other' and clear purchase fields
`);
    process.exit(0);
  }

  const apply = argv.includes('--apply');
  const batchSizeRaw = (() => {
    const idx = argv.findIndex(a => a === '--batchSize');
    return idx >= 0 ? argv[idx + 1] : undefined;
  })();
  const batchSize = batchSizeRaw
    ? Math.max(10, Number(batchSizeRaw) || 200)
    : 200;

  const readMode = (
    key: string,
    fallback: Options['orphanPurchaseInboundMode']
  ) => {
    const arg = argv.find(a => a.startsWith(`${key}=`));
    if (!arg) return fallback;
    const val = arg.split('=')[1]?.trim();
    if (val === 'skip' || val === 'link' || val === 'convert') return val;
    return fallback;
  };

  return {
    apply,
    batchSize,
    orphanPurchaseInboundMode: readMode('--orphanPurchaseInbound', 'link'),
    missingItemInboundMode: readMode('--missingItemInbound', 'link'),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  console.log(
    `🧹 remediate-purchase-anomalies: mode=${options.apply ? 'apply' : 'dry-run'} batchSize=${options.batchSize} orphanPurchaseInbound=${options.orphanPurchaseInboundMode} missingItemInbound=${options.missingItemInboundMode}`
  );

  let cursorId: string | undefined;

  let scannedOrders = 0;
  let fixedOrders = 0;
  let fixedItems = 0;
  let fixedEmptyOrders = 0;
  let fixedInboundLinks = 0;
  let convertedInboundLinks = 0;
  let skippedInboundLinks = 0;
  let fixedOrphanPurchaseInbounds = 0;
  let convertedOrphanPurchaseInbounds = 0;
  let skippedOrphanPurchaseInbounds = 0;

  while (true) {
    const orders = await prisma.purchaseOrder.findMany({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: options.batchSize,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        items: {
          select: {
            id: true,
            productId: true,
            batchNumber: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
          },
        },
        inboundRecords: {
          select: {
            id: true,
            recordNumber: true,
            productId: true,
            batchNumber: true,
            quantity: true,
            reason: true,
            remarks: true,
            purchaseOrderId: true,
            purchaseOrderItemId: true,
            createdAt: true,
          },
        },
      },
    });

    if (orders.length === 0) break;
    scannedOrders += orders.length;
    cursorId = orders[orders.length - 1].id;

    for (const order of orders) {
      // 1) 采购单无明细但 totalAmount != 0
      if (order.items.length === 0) {
        const current = Number(order.totalAmount ?? 0);
        if (Math.abs(current) > 0.01) {
          if (options.apply) {
            await prisma.purchaseOrder.update({
              where: { id: order.id },
              data: { totalAmount: 0 },
            });
          }
          fixedEmptyOrders += 1;
        }

        // 没有明细但还挂着“采购入库”的入库记录：无法追溯到明细，默认转为 other 并解除采购关联（清理审计脏数据）
        if (order.inboundRecords.length > 0) {
          for (const inbound of order.inboundRecords) {
            if (inbound.reason !== 'purchase') {
              continue;
            }

            if (options.missingItemInboundMode !== 'convert') {
              skippedInboundLinks += 1;
              continue;
            }

            const suffix = `\n[dev-cleanup] 原采购单已无明细，已解除采购关联并将 reason=purchase 转为 other（原采购单：${order.orderNumber}）`;
            const nextRemarks = `${inbound.remarks || ''}${inbound.remarks ? '' : ''}${suffix}`;

            if (options.apply) {
              await prisma.inboundRecord.update({
                where: { id: inbound.id },
                data: {
                  reason: 'other',
                  purchaseOrderId: null,
                  purchaseOrderItemId: null,
                  remarks: nextRemarks,
                },
              });
            }
            convertedInboundLinks += 1;
          }
        }

        continue;
      }

      // 2) 回写明细 totalPrice
      const itemUpdates: Array<Promise<unknown>> = [];
      const computedItemTotals: Array<{ quantity: number; unitPrice: number }> =
        [];

      for (const item of order.items) {
        const quantity = Number(item.quantity ?? 0);
        const unitPrice = Number(item.unitPrice ?? 0);
        const computed = computePurchaseOrderItemTotalPrice(
          quantity,
          unitPrice
        );
        computedItemTotals.push({ quantity, unitPrice });

        const stored = roundToTwoDecimals(Number(item.totalPrice ?? 0));
        if (Math.abs(stored - computed) > 0.01) {
          if (options.apply) {
            itemUpdates.push(
              prisma.purchaseOrderItem.update({
                where: { id: item.id },
                data: { totalPrice: computed },
              })
            );
          }
          fixedItems += 1;
        }
      }

      if (itemUpdates.length > 0 && options.apply) {
        await Promise.all(itemUpdates);
      }

      // 3) 回写订单 totalAmount
      const computedOrderTotal =
        calculatePurchaseOrderTotal(computedItemTotals);
      const storedOrderTotal = roundToTwoDecimals(
        Number(order.totalAmount ?? 0)
      );
      if (Math.abs(storedOrderTotal - computedOrderTotal) > 0.01) {
        if (options.apply) {
          await prisma.purchaseOrder.update({
            where: { id: order.id },
            data: { totalAmount: computedOrderTotal },
          });
        }
        fixedOrders += 1;
      }

      // 4) 补齐 purchaseOrderItemId（仅当可唯一匹配）
      for (const inbound of order.inboundRecords) {
        if (inbound.purchaseOrderItemId) continue;

        // 仅处理采购入库
        if (inbound.reason !== 'purchase') {
          skippedInboundLinks += 1;
          continue;
        }

        const inboundProductId = inbound.productId;
        if (!inboundProductId) {
          if (options.missingItemInboundMode === 'convert') {
            const suffix = `\n[dev-cleanup] 入库记录缺少 productId，无法挂采购明细，已解除采购关联并将 reason=purchase 转为 other（原采购单：${order.orderNumber}）`;
            const nextRemarks = `${inbound.remarks || ''}${inbound.remarks ? '' : ''}${suffix}`;
            if (options.apply) {
              await prisma.inboundRecord.update({
                where: { id: inbound.id },
                data: {
                  reason: 'other',
                  purchaseOrderId: null,
                  purchaseOrderItemId: null,
                  remarks: nextRemarks,
                },
              });
            }
            convertedInboundLinks += 1;
          } else {
            skippedInboundLinks += 1;
          }
          continue;
        }

        const inboundBatch = inbound.batchNumber ?? null;

        let candidates = order.items.filter(it => {
          if (it.productId !== inboundProductId) return false;
          const itemBatch = it.batchNumber ?? null;
          return itemBatch === inboundBatch;
        });

        // 回退：如果批次无法唯一命中，尝试仅按 productId 唯一命中（单产品单明细场景）
        if (candidates.length !== 1) {
          const byProductOnly = order.items.filter(
            it => it.productId === inboundProductId
          );
          if (byProductOnly.length === 1) {
            candidates = byProductOnly;
          }
        }

        if (candidates.length !== 1) {
          if (options.missingItemInboundMode === 'convert') {
            const suffix = `\n[dev-cleanup] 无法唯一匹配采购明细（productId=${inboundProductId} batch=${inboundBatch ?? 'null'}），已解除采购关联并将 reason=purchase 转为 other（原采购单：${order.orderNumber}）`;
            const nextRemarks = `${inbound.remarks || ''}${inbound.remarks ? '' : ''}${suffix}`;
            if (options.apply) {
              await prisma.inboundRecord.update({
                where: { id: inbound.id },
                data: {
                  reason: 'other',
                  purchaseOrderId: null,
                  purchaseOrderItemId: null,
                  remarks: nextRemarks,
                },
              });
            }
            convertedInboundLinks += 1;
          } else {
            skippedInboundLinks += 1;
          }
          continue;
        }

        if (options.apply) {
          await prisma.inboundRecord.update({
            where: { id: inbound.id },
            data: { purchaseOrderItemId: candidates[0].id },
          });
        }
        fixedInboundLinks += 1;
      }
    }
  }

  // 5) 处理“采购入库但未关联采购单”的入库记录（reason=purchase 且 purchaseOrderId=null）
  if (options.orphanPurchaseInboundMode !== 'skip') {
    let inboundCursor: string | undefined;
    while (true) {
      const inbounds = await prisma.inboundRecord.findMany({
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: options.batchSize,
        ...(inboundCursor ? { cursor: { id: inboundCursor }, skip: 1 } : {}),
        where: {
          reason: 'purchase',
          purchaseOrderId: null,
        },
        select: {
          id: true,
          recordNumber: true,
          productId: true,
          batchNumber: true,
          remarks: true,
        },
      });
      if (inbounds.length === 0) break;
      inboundCursor = inbounds[inbounds.length - 1].id;

      for (const inbound of inbounds) {
        if (!inbound.productId) {
          if (options.orphanPurchaseInboundMode === 'convert') {
            const suffix = `\n[dev-cleanup] reason=purchase 但缺少 purchaseOrderId 且无 productId，已转为 other`;
            const nextRemarks = `${inbound.remarks || ''}${inbound.remarks ? '' : ''}${suffix}`;
            if (options.apply) {
              await prisma.inboundRecord.update({
                where: { id: inbound.id },
                data: {
                  reason: 'other',
                  purchaseOrderId: null,
                  purchaseOrderItemId: null,
                  remarks: nextRemarks,
                },
              });
            }
            convertedOrphanPurchaseInbounds += 1;
          } else {
            skippedOrphanPurchaseInbounds += 1;
          }
          continue;
        }

        if (options.orphanPurchaseInboundMode === 'link') {
          const candidates = await prisma.purchaseOrderItem.findMany({
            where: {
              productId: inbound.productId,
              batchNumber: inbound.batchNumber ?? null,
            },
            select: { id: true, purchaseOrderId: true },
          });

          if (candidates.length === 1) {
            if (options.apply) {
              await prisma.inboundRecord.update({
                where: { id: inbound.id },
                data: {
                  purchaseOrderId: candidates[0].purchaseOrderId,
                  purchaseOrderItemId: candidates[0].id,
                },
              });
            }
            fixedOrphanPurchaseInbounds += 1;
            continue;
          }
        }

        if (options.orphanPurchaseInboundMode === 'convert') {
          const suffix = `\n[dev-cleanup] reason=purchase 但缺少 purchaseOrderId（productId=${inbound.productId} batch=${inbound.batchNumber ?? 'null'}），已转为 other`;
          const nextRemarks = `${inbound.remarks || ''}${inbound.remarks ? '' : ''}${suffix}`;
          if (options.apply) {
            await prisma.inboundRecord.update({
              where: { id: inbound.id },
              data: {
                reason: 'other',
                purchaseOrderId: null,
                purchaseOrderItemId: null,
                remarks: nextRemarks,
              },
            });
          }
          convertedOrphanPurchaseInbounds += 1;
        } else {
          skippedOrphanPurchaseInbounds += 1;
        }
      }
    }
  }

  console.log(
    '======================================================================'
  );
  console.log(`✅ 扫描采购单：${scannedOrders}`);
  console.log(
    `📌 结果：fixedItems=${fixedItems} fixedOrders=${fixedOrders} fixedEmptyOrders=${fixedEmptyOrders}`
  );
  console.log(
    `📌 入库明细补链：fixedInboundLinks=${fixedInboundLinks} convertedInboundLinks=${convertedInboundLinks} skippedInboundLinks=${skippedInboundLinks}`
  );
  console.log(
    `📌 孤儿采购入库：fixedOrphanPurchaseInbounds=${fixedOrphanPurchaseInbounds} convertedOrphanPurchaseInbounds=${convertedOrphanPurchaseInbounds} skippedOrphanPurchaseInbounds=${skippedOrphanPurchaseInbounds}`
  );
  console.log(
    `ℹ️ 说明：未能唯一匹配的入库记录（同产品同批次多明细/无批次/手动产品等）会被跳过，需人工处理或清库重置。`
  );
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error('remediate-purchase-anomalies failed:', err);
  process.exit(1);
});
