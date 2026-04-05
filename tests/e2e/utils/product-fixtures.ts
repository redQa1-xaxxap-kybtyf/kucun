import type { PrismaClient } from '@prisma/client';

interface StableProductFixture {
  batchNumber: string;
  initialQuantity: number;
  initialReservedQuantity: number;
  productCode: string;
  productId: string;
  searchKeyword: string;
}

function buildRunId(prefix: string) {
  return `${prefix}${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`.toUpperCase();
}

export async function createStableProductFixture(
  prisma: PrismaClient,
  prefix = 'E2EPROD'
): Promise<StableProductFixture> {
  const runId = buildRunId(prefix);
  const productCode = `${runId}-P`;
  const batchNumber = `${runId}-BATCH-A`;
  const initialQuantity = 60;
  const unitCost = '25.123';
  const adminUser = await prisma.user.findUnique({
    where: { username: 'admin' },
    select: { id: true },
  });

  if (!adminUser) {
    throw new Error('未找到 admin 用户，无法创建测试产品夹具');
  }

  const product = await prisma.product.create({
    data: {
      code: productCode,
      name: `${runId}瓷砖`,
      piecesPerUnit: 1,
      specification: '800x800mm',
      status: 'active',
      unit: 'sheet',
      weight: '5.391',
    },
    select: {
      id: true,
    },
  });

  await prisma.batchSpecification.create({
    data: {
      batchNumber,
      piecesPerUnit: 1,
      productId: product.id,
      weight: '5.391',
    },
  });

  const inventory = await prisma.inventory.create({
    data: {
      batchNumber,
      location: 'E2E-A1',
      productId: product.id,
      quantity: initialQuantity,
      reservedQuantity: 0,
      unitCost,
    },
    select: {
      quantity: true,
      reservedQuantity: true,
    },
  });

  const inboundRecord = await prisma.inboundRecord.create({
    data: {
      batchNumber,
      location: 'E2E-A1',
      productId: product.id,
      quantity: initialQuantity,
      reason: 'manual_inbound',
      recordNumber: `IN-${runId}`,
      remarks: 'E2E 销售/财务敏感链路测试夹具',
      totalCost: (initialQuantity * Number(unitCost)).toFixed(2),
      unitCost,
      userId: adminUser.id,
    },
    select: { id: true },
  });

  await prisma.inventoryCostQueue.create({
    data: {
      batchNumber,
      inboundDate: new Date(),
      inboundRecordId: inboundRecord.id,
      productId: product.id,
      remainingQty: initialQuantity,
      unitCost,
    },
  });

  return {
    batchNumber,
    initialQuantity: inventory.quantity,
    initialReservedQuantity: inventory.reservedQuantity,
    productCode,
    productId: product.id,
    searchKeyword: productCode.slice(0, 6),
  };
}
