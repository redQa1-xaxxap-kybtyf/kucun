/**
 * 修复“采购入库带破损时把到货总量误记成合格入库量”的历史单据。
 *
 * 默认 dry-run，只输出修复前后差异，不写库。
 * 加 --apply 后会同时修复：
 * 1. inbound_records.quantity / damaged_quantity / total_cost / damage_total_cost
 * 2. inventory.quantity
 * 3. inventory_cost_queue.remaining_qty
 * 4. 若关联采购单，则刷新采购执行状态
 *
 * 仅支持“把数量往下修正”的场景：
 * - targetAccepted = arrivalQuantity - damagedQuantity
 * - currentQuantity 必须 >= targetAccepted
 * - FIFO 剩余量必须足够扣减差额，否则说明多出来的数量已经被出库/占用，脚本会拒绝执行
 *
 * 用法：
 *   npx tsx scripts/repair-purchase-damage-inbound.ts --recordNumber=IN202604090001 --arrival=7377 --damaged=12
 *   npx tsx scripts/repair-purchase-damage-inbound.ts --recordNumber=IN202604090001 --arrival=7377 --damaged=12 --apply
 *   npx tsx scripts/repair-purchase-damage-inbound.ts --recordId=<uuid> --arrival=7377 --damaged=12
 */

import { refreshPurchaseOrderFulfillment } from '@/lib/api/purchase-orders/fulfillment';
import { prisma } from '@/lib/db';
import { calculateTotalCost } from '@/lib/utils/cost-calculation';
import { toNumber } from '@/lib/utils/number';

type Options = {
  apply: boolean;
  recordId?: string;
  recordNumber?: string;
  arrivalQuantity?: number;
  damagedQuantity?: number;
};

type QueueEntry = {
  id: string;
  remainingQty: number;
};

function printHelp(): never {
  // eslint-disable-next-line no-console
  console.log(`
Usage:
  npx tsx scripts/repair-purchase-damage-inbound.ts --recordNumber=<number> --arrival=<qty> --damaged=<qty>
  npx tsx scripts/repair-purchase-damage-inbound.ts --recordId=<uuid> --arrival=<qty> --damaged=<qty>
  npx tsx scripts/repair-purchase-damage-inbound.ts ... --apply

Notes:
  - 默认 dry-run，不写库
  - 仅支持把“当前 quantity”往下修正
  - 如果这批多出来的数量已经被 FIFO 消耗，脚本会拒绝执行
`);
  process.exit(0);
}

function readFlag(argv: string[], name: string): string | undefined {
  const prefix = `${name}=`;
  return argv.find(arg => arg.startsWith(prefix))?.slice(prefix.length);
}

function parseIntegerFlag(
  argv: string[],
  name: string
): number | undefined {
  const raw = readFlag(argv, name);
  if (raw === undefined) {
    return undefined;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} 必须是整数，当前收到: ${raw}`);
  }

  return parsed;
}

function parseArgs(argv: string[]): Options {
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
  }

  return {
    apply: argv.includes('--apply'),
    recordId: readFlag(argv, '--recordId'),
    recordNumber: readFlag(argv, '--recordNumber'),
    arrivalQuantity: parseIntegerFlag(argv, '--arrival'),
    damagedQuantity: parseIntegerFlag(argv, '--damaged'),
  };
}

function assertOptions(options: Options): asserts options is Options & {
  arrivalQuantity: number;
  damagedQuantity: number;
} {
  if (!options.recordId && !options.recordNumber) {
    throw new Error('必须传入 --recordId 或 --recordNumber');
  }

  if (options.arrivalQuantity === undefined) {
    throw new Error('必须传入 --arrival=<到货总量>');
  }

  if (options.damagedQuantity === undefined) {
    throw new Error('必须传入 --damaged=<破损数量>');
  }

  if (options.arrivalQuantity <= 0) {
    throw new Error('--arrival 必须大于 0');
  }

  if (options.damagedQuantity < 0) {
    throw new Error('--damaged 不能小于 0');
  }

  if (options.damagedQuantity > options.arrivalQuantity) {
    throw new Error('破损数量不能大于到货总量');
  }
}

function sumQueueRemaining(entries: QueueEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.remainingQty, 0);
}

async function reduceQueueRemaining(
  tx: typeof prisma,
  entries: QueueEntry[],
  delta: number
): Promise<void> {
  let remainingDelta = delta;

  for (const entry of entries) {
    if (remainingDelta <= 0) {
      break;
    }

    const deductQty = Math.min(remainingDelta, entry.remainingQty);
    if (deductQty <= 0) {
      continue;
    }

    await tx.inventoryCostQueue.update({
      where: { id: entry.id },
      data: {
        remainingQty: entry.remainingQty - deductQty,
      },
    });

    remainingDelta -= deductQty;
  }

  if (remainingDelta > 0) {
    throw new Error(`FIFO 剩余数量不足，仍有 ${remainingDelta} 片未能扣减`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  assertOptions(options);

  const record = await prisma.inboundRecord.findFirst({
    where: options.recordId
      ? { id: options.recordId }
      : { recordNumber: options.recordNumber },
    select: {
      id: true,
      recordNumber: true,
      reason: true,
      quantity: true,
      damagedQuantity: true,
      unitCost: true,
      totalCost: true,
      damageTotalCost: true,
      batchNumber: true,
      variantId: true,
      productId: true,
      purchaseOrderId: true,
      product: {
        select: {
          code: true,
          name: true,
        },
      },
      costQueueEntries: {
        where: {
          remainingQty: { gt: 0 },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          remainingQty: true,
        },
      },
    },
  });

  if (!record) {
    throw new Error('未找到指定入库记录');
  }

  if (record.reason !== 'purchase') {
    throw new Error(`仅支持修复采购入库，当前 reason=${record.reason}`);
  }

  const unitCost = toNumber(record.unitCost);
  if (!(unitCost > 0)) {
    throw new Error('当前入库记录缺少有效 unitCost，无法安全修复');
  }

  const targetAcceptedQuantity =
    options.arrivalQuantity - options.damagedQuantity;
  if (targetAcceptedQuantity <= 0) {
    throw new Error('修复后的合格入库数量必须大于 0');
  }

  const currentQuantity = Number(record.quantity ?? 0);
  const delta = currentQuantity - targetAcceptedQuantity;
  if (delta < 0) {
    throw new Error(
      `当前 quantity=${currentQuantity} 小于目标 quantity=${targetAcceptedQuantity}，该脚本不支持自动补增`
    );
  }

  const queueEntries = record.costQueueEntries.map(entry => ({
    id: entry.id,
    remainingQty: Number(entry.remainingQty ?? 0),
  }));
  const queueRemaining = sumQueueRemaining(queueEntries);
  const consumedQty = currentQuantity - queueRemaining;

  if (consumedQty > targetAcceptedQuantity) {
    throw new Error(
      `这条入库已有 ${consumedQty} 片被 FIFO 消耗，超过目标合格入库 ${targetAcceptedQuantity} 片，不能自动修复`
    );
  }

  if (queueRemaining < delta) {
    throw new Error(
      `FIFO 剩余仅 ${queueRemaining} 片，但需要扣减 ${delta} 片，不能自动修复`
    );
  }

  const inventory = await prisma.inventory.findFirst({
    where: {
      productId: record.productId,
      variantId: record.variantId ?? null,
      batchNumber: record.batchNumber ?? null,
    },
    select: {
      id: true,
      quantity: true,
    },
  });

  if (!inventory) {
    throw new Error('未找到对应库存记录，不能自动修复');
  }

  if (Number(inventory.quantity ?? 0) < delta) {
    throw new Error(
      `库存当前仅 ${inventory.quantity} 片，但需要扣减 ${delta} 片，不能自动修复`
    );
  }

  const targetTotalCost = calculateTotalCost(targetAcceptedQuantity, unitCost);
  const targetDamageCost = calculateTotalCost(options.damagedQuantity, unitCost);

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({
    mode: options.apply ? 'apply' : 'dry-run',
    record: {
      id: record.id,
      recordNumber: record.recordNumber,
      productCode: record.product.code,
      productName: record.product.name,
      batchNumber: record.batchNumber,
    },
    current: {
      quantity: currentQuantity,
      damagedQuantity: record.damagedQuantity,
      arrivalQuantity: currentQuantity + Number(record.damagedQuantity ?? 0),
      totalCost: toNumber(record.totalCost),
      damageTotalCost: toNumber(record.damageTotalCost),
      queueRemaining,
      consumedQty,
      inventoryQty: Number(inventory.quantity ?? 0),
    },
    target: {
      arrivalQuantity: options.arrivalQuantity,
      quantity: targetAcceptedQuantity,
      damagedQuantity: options.damagedQuantity,
      totalCost: targetTotalCost,
      damageTotalCost: targetDamageCost,
      inventoryQty: Number(inventory.quantity ?? 0) - delta,
      queueRemaining: queueRemaining - delta,
    },
    delta: {
      quantity: delta,
    },
  }, null, 2));

  if (!options.apply) {
    // eslint-disable-next-line no-console
    console.log('\n未写库。确认无误后请加 --apply 执行修复。');
    return;
  }

  await prisma.$transaction(async tx => {
    await tx.inboundRecord.update({
      where: { id: record.id },
      data: {
        quantity: targetAcceptedQuantity,
        damagedQuantity: options.damagedQuantity,
        totalCost: targetTotalCost,
        damageTotalCost: targetDamageCost,
      },
    });

    if (delta > 0) {
      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          quantity: {
            decrement: delta,
          },
        },
      });

      await reduceQueueRemaining(tx, queueEntries, delta);
    }

    if (record.purchaseOrderId) {
      await refreshPurchaseOrderFulfillment(tx, record.purchaseOrderId);
    }
  });

  // eslint-disable-next-line no-console
  console.log('\n修复完成。');
}

main()
  .catch(error => {
    // eslint-disable-next-line no-console
    console.error(
      '\nrepair-purchase-damage-inbound failed:',
      error instanceof Error ? error.message : error
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
