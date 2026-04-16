import { randomUUID } from 'node:crypto';

import { NextRequest } from 'next/server';

import { executeAdjustmentTransaction } from '@/app/api/inventory/adjust/route';
import { PATCH as updateManualDamageLedgerRoute } from '@/app/api/inventory/manual-damage-ledgers/[id]/route';
import { prisma } from '@/lib/db';
import { listManualDamageLedgers } from '@/lib/services/manual-damage-ledger-service';

jest.setTimeout(30000);

let authUserId = 'manual-damage-test-user';

jest.mock('@/lib/auth/api-helpers', () => ({
  ...jest.requireActual('@/lib/auth/api-helpers'),
  requireAuth: jest.fn(() => ({
    id: authUserId,
    role: 'admin',
    permissions: ['inventory:view', 'inventory:adjust'],
  })),
  withAuth:
    (handler: any) =>
    (request: unknown, context?: Record<string, unknown>) =>
      handler(request, {
        ...(context ?? {}),
        user: {
          id: authUserId,
          name: 'Manual Damage Ledger Tester',
          role: 'admin',
          permissions: ['inventory:view', 'inventory:adjust'],
        },
      }),
}));

jest.mock('@/lib/auth/permissions', () => ({
  requirePermission: jest.fn(() => true),
}));

const created = {
  userIds: new Set<string>(),
  supplierIds: new Set<string>(),
  productIds: new Set<string>(),
  inventoryIds: new Set<string>(),
  inboundRecordIds: new Set<string>(),
  fifoIds: new Set<string>(),
  adjustmentIds: new Set<string>(),
  ledgerIds: new Set<string>(),
};

function createJsonRequest(url: string, body: unknown, method = 'PATCH') {
  return new NextRequest(new URL(url), {
    method,
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

async function createTestUser() {
  const user = await prisma.user.create({
    data: {
      email: `manual-damage-${randomUUID().slice(0, 8)}@integration.test`,
      username: `manual_damage_${randomUUID().slice(0, 8)}`,
      name: '手工报损台账测试用户',
      passwordHash: 'test-hash',
      role: 'admin',
      status: 'active',
    },
    select: { id: true },
  });

  authUserId = user.id;
  created.userIds.add(user.id);
  return user.id;
}

async function createTestSupplier() {
  const supplier = await prisma.supplier.create({
    data: {
      name: `手工报损供应商-${randomUUID().slice(0, 6)}`,
      supplierCode: `MDS-${randomUUID().slice(0, 6)}`,
      phone: '02100000000',
      address: 'integration-test',
      status: 'active',
    },
    select: { id: true },
  });

  created.supplierIds.add(supplier.id);
  return supplier.id;
}

async function createTestProduct() {
  const product = await prisma.product.create({
    data: {
      code: `MDS-${randomUUID().slice(0, 8)}`,
      name: '手工报损测试产品',
      unit: 'piece',
      piecesPerUnit: 12,
      status: 'active',
      weight: '18.000',
    },
    select: { id: true },
  });

  created.productIds.add(product.id);
  return product.id;
}

async function createInventoryCostFixture(params: {
  productId: string;
  userId: string;
  batchNumber: string;
  unitCost: string;
  supplierId?: string | null;
  quantity?: number;
  remarks?: string;
}) {
  const quantity = params.quantity ?? 10;

  const inventory = await prisma.inventory.create({
    data: {
      productId: params.productId,
      batchNumber: params.batchNumber,
      quantity,
      reservedQuantity: 0,
      unitCost: params.unitCost,
    },
    select: { id: true },
  });
  created.inventoryIds.add(inventory.id);

  const inboundRecord = await prisma.inboundRecord.create({
    data: {
      recordNumber: `IN-MDL-${randomUUID().slice(0, 8)}`,
      productId: params.productId,
      supplierId: params.supplierId ?? null,
      batchNumber: params.batchNumber,
      quantity,
      unitCost: params.unitCost,
      totalCost: (quantity * Number(params.unitCost)).toFixed(2),
      reason: 'purchase',
      remarks: params.remarks ?? '手工报损台账测试库存',
      userId: params.userId,
    },
    select: { id: true },
  });
  created.inboundRecordIds.add(inboundRecord.id);

  const fifo = await prisma.inventoryCostQueue.create({
    data: {
      productId: params.productId,
      batchNumber: params.batchNumber,
      inboundRecordId: inboundRecord.id,
      remainingQty: quantity,
      unitCost: params.unitCost,
      inboundDate: new Date(),
    },
    select: { id: true },
  });
  created.fifoIds.add(fifo.id);

  return { inventoryId: inventory.id, inboundRecordId: inboundRecord.id, fifoId: fifo.id };
}

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  try {
    const ledgerIds = Array.from(created.ledgerIds);
    const adjustmentIds = Array.from(created.adjustmentIds);
    const fifoIds = Array.from(created.fifoIds);
    const inboundRecordIds = Array.from(created.inboundRecordIds);
    const inventoryIds = Array.from(created.inventoryIds);
    const productIds = Array.from(created.productIds);
    const supplierIds = Array.from(created.supplierIds);
    const userIds = Array.from(created.userIds);

    if (ledgerIds.length > 0) {
      await prisma.manualDamageLedger.deleteMany({
        where: { id: { in: ledgerIds } },
      });
    }

    if (adjustmentIds.length > 0) {
      await prisma.inventoryAdjustment.deleteMany({
        where: { id: { in: adjustmentIds } },
      });
    }

    if (fifoIds.length > 0) {
      await prisma.inventoryCostQueue.deleteMany({
        where: { id: { in: fifoIds } },
      });
    }

    if (inventoryIds.length > 0) {
      await prisma.inventory.deleteMany({
        where: { id: { in: inventoryIds } },
      });
    }

    if (inboundRecordIds.length > 0) {
      await prisma.inboundRecord.deleteMany({
        where: { id: { in: inboundRecordIds } },
      });
    }

    if (productIds.length > 0) {
      await prisma.batchSpecification.deleteMany({
        where: { productId: { in: productIds } },
      });
      await prisma.product.deleteMany({
        where: { id: { in: productIds } },
      });
    }

    if (supplierIds.length > 0) {
      await prisma.supplier.deleteMany({
        where: { id: { in: supplierIds } },
      });
    }

    if (userIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
});

describe('手工报损台账集成回归', () => {
  it('报损扣库存后，应自动生成台账、优先关联同批次供应商，并支持状态流转', async () => {
    const userId = await createTestUser();
    const supplierId = await createTestSupplier();
    const productId = await createTestProduct();
    const batchNumber = `MDL-BATCH-${randomUUID().slice(0, 6)}`;

    await createInventoryCostFixture({
      productId,
      userId,
      supplierId,
      batchNumber,
      unitCost: '7.000',
      remarks: '为手工报损台账测试准备库存',
    });

    const result = await executeAdjustmentTransaction(
      {
        productId,
        batchNumber,
        adjustQuantity: -3,
        reason: 'damage_loss',
        damageCategory: 'scrap',
        damageHandling: 'supplier_claim',
        notes: '发现三片边角破损，待向工厂登记',
      },
      userId
    );

    created.adjustmentIds.add(result.adjustment.id);

    const ledger = await prisma.manualDamageLedger.findUnique({
      where: { adjustmentId: result.adjustment.id },
      select: {
        id: true,
        ledgerNumber: true,
        damagedQuantity: true,
        damageCategory: true,
        damageHandling: true,
        referenceAmount: true,
        status: true,
        supplierId: true,
        remarks: true,
      },
    });

    expect(ledger).not.toBeNull();
    if (!ledger) {
      return;
    }

    created.ledgerIds.add(ledger.id);

    expect(ledger.ledgerNumber).toMatch(/^MDL/);
    expect(ledger.damagedQuantity).toBe(3);
    expect(ledger.damageCategory).toBe('scrap');
    expect(ledger.damageHandling).toBe('supplier_claim');
    expect(Number(ledger.referenceAmount ?? 0)).toBe(21);
    expect(ledger.status).toBe('pending_claim');
    expect(ledger.supplierId).toBe(supplierId);
    expect(ledger.remarks).toContain('待向工厂登记');

    const patchResponse = await updateManualDamageLedgerRoute(
      createJsonRequest(
        `http://localhost/api/inventory/manual-damage-ledgers/${ledger.id}`,
        {
          status: 'claim_submitted',
          damageCategory: 'scrap',
          damageHandling: 'supplier_claim',
          remarks: '今天已经向工厂登记，等待赔付结果',
        }
      ),
      { params: Promise.resolve({ id: ledger.id }) }
    );

    expect(patchResponse.status).toBe(200);

    const updatedLedger = await prisma.manualDamageLedger.findUnique({
      where: { id: ledger.id },
      select: {
        status: true,
        remarks: true,
        claimedAt: true,
        lastHandledById: true,
      },
    });

    expect(updatedLedger?.status).toBe('claim_submitted');
    expect(updatedLedger?.remarks).toContain('等待赔付结果');
    expect(updatedLedger?.claimedAt).not.toBeNull();
    expect(updatedLedger?.lastHandledById).toBe(authUserId);

    const listResult = await listManualDamageLedgers({
      search: result.adjustment.adjustmentNumber,
    });

    const listedLedger = listResult.data.find(item => item.id === ledger.id);
    expect(listedLedger).toBeDefined();
    expect(listedLedger?.batchNumber).toBe(batchNumber);
    expect(listedLedger?.supplier?.id).toBe(supplierId);
    expect(listedLedger?.status).toBe('claim_submitted');
  });

  it('老 damage_loss 调整应自动回填台账，且不能串入其他批次供应商', async () => {
    const userId = await createTestUser();
    const supplierA = await createTestSupplier();
    const supplierB = await createTestSupplier();
    const productId = await createTestProduct();
    const batchA = `MDL-A-${randomUUID().slice(0, 5)}`;
    const batchB = `MDL-B-${randomUUID().slice(0, 5)}`;
    const batchC = `MDL-C-${randomUUID().slice(0, 5)}`;

    await prisma.inboundRecord.create({
      data: {
        recordNumber: `IN-A-${randomUUID().slice(0, 8)}`,
        productId,
        supplierId: supplierA,
        batchNumber: batchA,
        quantity: 10,
        unitCost: '9.000',
        totalCost: '90.00',
        reason: 'purchase',
        remarks: '批次 A 供应商',
        userId,
      },
    }).then(record => created.inboundRecordIds.add(record.id));

    await prisma.inboundRecord.create({
      data: {
        recordNumber: `IN-B-${randomUUID().slice(0, 8)}`,
        productId,
        supplierId: supplierB,
        batchNumber: batchB,
        quantity: 10,
        unitCost: '12.000',
        totalCost: '120.00',
        reason: 'purchase',
        remarks: '批次 B 供应商',
        userId,
      },
    }).then(record => created.inboundRecordIds.add(record.id));

    const adjustment = await prisma.inventoryAdjustment.create({
      data: {
        adjustmentNumber: `ADJ-MDL-${randomUUID().slice(0, 8)}`,
        productId,
        batchNumber: batchC,
        beforeQuantity: 8,
        adjustQuantity: -2,
        afterQuantity: 6,
        unitCost: '9.000',
        totalCost: '-18.00',
        reason: 'damage_loss',
        notes: '历史手工报损，待自动回填',
        status: 'approved',
        operatorId: userId,
        approverId: userId,
        approvedAt: new Date(),
      },
      select: {
        id: true,
        adjustmentNumber: true,
      },
    });
    created.adjustmentIds.add(adjustment.id);

    const result = await listManualDamageLedgers({
      search: adjustment.adjustmentNumber,
    });

    const ledger = result.data.find(item => item.adjustmentId === adjustment.id);
    expect(ledger).toBeDefined();
    expect(ledger?.batchNumber).toBe(batchC);
    expect(ledger?.status).toBe('pending_review');
    expect(ledger?.damageHandling).toBe('pending_confirm');
    expect(ledger?.referenceAmount).toBe(18);
    expect(ledger?.supplierId).toBeUndefined();
    expect(ledger?.remarks).toContain('历史手工报损');

    if (ledger) {
      created.ledgerIds.add(ledger.id);
    }
  });

  it('处理方式未确认时，不允许直接保存为向工厂登记状态', async () => {
    const userId = await createTestUser();
    const productId = await createTestProduct();
    const batchNumber = `MDL-PENDING-${randomUUID().slice(0, 6)}`;

    await createInventoryCostFixture({
      productId,
      userId,
      batchNumber,
      unitCost: '8.000',
      remarks: '待补充处理状态测试',
    });

    const result = await executeAdjustmentTransaction(
      {
        productId,
        batchNumber,
        adjustQuantity: -1,
        reason: 'damage_loss',
        damageCategory: 'damage',
        damageHandling: 'pending_confirm',
        notes: '先登记报损，后续再确认处理方式',
      },
      userId
    );

    created.adjustmentIds.add(result.adjustment.id);

    const ledger = await prisma.manualDamageLedger.findUnique({
      where: { adjustmentId: result.adjustment.id },
      select: {
        id: true,
        status: true,
        damageHandling: true,
        claimedAt: true,
      },
    });

    expect(ledger?.status).toBe('pending_review');
    expect(ledger?.damageHandling).toBe('pending_confirm');

    if (!ledger) {
      return;
    }

    created.ledgerIds.add(ledger.id);

    const patchResponse = await updateManualDamageLedgerRoute(
      createJsonRequest(
        `http://localhost/api/inventory/manual-damage-ledgers/${ledger.id}`,
        {
          status: 'claim_submitted',
          damageCategory: 'damage',
          damageHandling: 'pending_confirm',
          remarks: '错误流转测试',
        }
      ),
      { params: Promise.resolve({ id: ledger.id }) }
    );

    expect(patchResponse.status).toBe(400);
    const patchBody = (await patchResponse.json()) as { error?: string };
    expect(patchBody.error).toContain('处理方式还未确认时');

    const unchangedLedger = await prisma.manualDamageLedger.findUnique({
      where: { id: ledger.id },
      select: {
        status: true,
        claimedAt: true,
      },
    });

    expect(unchangedLedger?.status).toBe('pending_review');
    expect(unchangedLedger?.claimedAt).toBeNull();
  });

  it('已结案的内部承担台账，不允许再反向流转为向工厂登记', async () => {
    const userId = await createTestUser();
    const productId = await createTestProduct();
    const batchNumber = `MDL-CLOSED-${randomUUID().slice(0, 6)}`;

    await createInventoryCostFixture({
      productId,
      userId,
      batchNumber,
      unitCost: '6.000',
      remarks: '内部承担结案测试',
    });

    const result = await executeAdjustmentTransaction(
      {
        productId,
        batchNumber,
        adjustQuantity: -2,
        reason: 'damage_loss',
        damageCategory: 'loss',
        damageHandling: 'internal_loss',
        notes: '内部承担，默认结案',
      },
      userId
    );

    created.adjustmentIds.add(result.adjustment.id);

    const ledger = await prisma.manualDamageLedger.findUnique({
      where: { adjustmentId: result.adjustment.id },
      select: {
        id: true,
        status: true,
        resolvedAt: true,
      },
    });

    expect(ledger?.status).toBe('internal_closed');
    expect(ledger?.resolvedAt).not.toBeNull();

    if (!ledger) {
      return;
    }

    created.ledgerIds.add(ledger.id);

    const patchResponse = await updateManualDamageLedgerRoute(
      createJsonRequest(
        `http://localhost/api/inventory/manual-damage-ledgers/${ledger.id}`,
        {
          status: 'claim_submitted',
          damageCategory: 'loss',
          damageHandling: 'supplier_claim',
          remarks: '尝试反向流转',
        }
      ),
      { params: Promise.resolve({ id: ledger.id }) }
    );

    expect(patchResponse.status).toBe(400);
    const patchBody = (await patchResponse.json()) as { error?: string };
    expect(patchBody.error).toContain('当前状态不允许这样流转');

    const unchangedLedger = await prisma.manualDamageLedger.findUnique({
      where: { id: ledger.id },
      select: {
        status: true,
        damageHandling: true,
      },
    });

    expect(unchangedLedger?.status).toBe('internal_closed');
    expect(unchangedLedger?.damageHandling).toBe('internal_loss');
  });
});
