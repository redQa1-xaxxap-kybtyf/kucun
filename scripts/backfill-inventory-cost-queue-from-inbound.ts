/**
 * 从入库记录回填 FIFO 成本队列（InventoryCostQueue）
 *
 * 背景：
 * - 历史数据/旧链路可能只写了 Inventory 与 InboundRecord，但未写 InventoryCostQueue
 * - 这会导致 FIFO 出库成本无法使用队列，只能回退到 Inventory.unitCost（口径风险）
 *
 * 策略（尽量安全）：
 * - 默认 dry-run：只输出将要创建的条目数量
 * - --apply 才会写库
 * - 以 inboundRecord 为粒度：若不存在 costQueue(inboundRecordId=inbound.id)，则创建一条
 * - remainingQty = inbound.quantity（不尝试推断已消耗数量；如需精确，请先确保历史出库已通过队列扣减）
 *
 * 运行：
 * - npm run backfill:cost-queue
 * - npm run backfill:cost-queue -- 2025-01-01 2025-12-31
 * - npm run backfill:cost-queue -- --apply
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Options = {
  startDate?: Date;
  endDate?: Date;
  apply: boolean;
  batchSize: number;
};

const EPS_QTY = 0.001;

function parseDate(input?: string | null): Date | undefined {
  if (!input) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    throw new Error(`无效日期格式（期望 YYYY-MM-DD）：${input}`);
  }
  const [year, month, day] = input.split('-').map(Number);
  return new Date(year, month - 1, day);
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
  const batchSizeRaw = Number(getFlag('--batch') ?? 200);

  return {
    startDate,
    endDate,
    apply: hasFlag('--apply'),
    batchSize: Number.isFinite(batchSizeRaw) && batchSizeRaw > 0 ? batchSizeRaw : 200,
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const whereCreatedAt = buildCreatedAtWhere(options.startDate, options.endDate);

  console.log('🧱 回填 FIFO 成本队列（InventoryCostQueue）...');
  console.log(`   模式：${options.apply ? 'APPLY（写库）' : 'DRY-RUN（不写库）'}`);

  let cursorId: string | undefined;
  let scanned = 0;
  let missing = 0;
  let created = 0;

  while (true) {
    const inbound = await prisma.inboundRecord.findMany({
      where: { ...whereCreatedAt },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: options.batchSize,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      select: {
        id: true,
        productId: true,
        variantId: true,
        batchNumber: true,
        quantity: true,
        unitCost: true,
        createdAt: true,
      },
    });
    if (inbound.length === 0) break;
    cursorId = inbound[inbound.length - 1].id;
    scanned += inbound.length;

    const inboundIds = inbound.map(r => r.id);
    const existing = await prisma.inventoryCostQueue.findMany({
      where: { inboundRecordId: { in: inboundIds } },
      select: { inboundRecordId: true },
    });
    const existingSet = new Set(existing.map(e => e.inboundRecordId));

    for (const r of inbound) {
      if (existingSet.has(r.id)) continue;

      const qty = Number(r.quantity ?? 0);
      const unitCost =
        r.unitCost !== null && r.unitCost !== undefined ? Number(r.unitCost) : 0;

      if (!(qty > EPS_QTY) || !(unitCost > 0)) {
        continue;
      }

      missing += 1;

      if (!options.apply) {
        continue;
      }

      await prisma.inventoryCostQueue.create({
        data: {
          productId: r.productId,
          variantId: r.variantId ?? null,
          batchNumber: r.batchNumber ?? null,
          inboundRecordId: r.id,
          remainingQty: qty,
          unitCost,
          inboundDate: r.createdAt,
        },
      });
      created += 1;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`✅ 扫描 InboundRecord：${scanned}`);
  console.log(`   - 缺失队列条目（可回填）：${missing}`);
  if (options.apply) {
    console.log(`   - 已创建队列条目：${created}`);
  } else {
    console.log('   - 未写库（dry-run）');
  }
}

main()
  .catch(err => {
    console.error('\n❌ 回填失败：', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

