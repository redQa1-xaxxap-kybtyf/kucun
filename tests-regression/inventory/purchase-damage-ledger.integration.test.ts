import { randomUUID } from 'node:crypto';

import { NextRequest } from 'next/server';

import { POST as createInboundRoute } from '@/app/api/inventory/inbound/route';
import { PATCH as updatePurchaseDamageLedgerRoute } from '@/app/api/inventory/purchase-damage-ledgers/[id]/route';
import { prisma } from '@/lib/db';
import { listPurchaseDamageLedgers } from '@/lib/services/purchase-damage-ledger-service';

jest.setTimeout(30000);

let authUserId = 'test-user-id';

jest.mock('@/lib/auth/api-helpers', () => ({
  ...jest.requireActual('@/lib/auth/api-helpers'),
  requireAuth: jest.fn(() => ({
    id: authUserId,
    role: 'admin',
    permissions: ['inventory:view', 'inventory:inbound'],
  })),
  withAuth:
    (handler: any) =>
    (request: unknown, context?: Record<string, unknown>) =>
      handler(request, {
        ...(context ?? {}),
        user: {
          id: authUserId,
          name: 'Purchase Damage Ledger Tester',
          role: 'admin',
          permissions: ['inventory:view', 'inventory:inbound'],
        },
      }),
}));

jest.mock('@/lib/auth/permissions', () => ({
  requirePermission: jest.fn(() => true),
}));

jest.mock('@/lib/cache/inventory-cache', () => ({
  invalidateInventoryCache: jest.fn(async () => undefined),
}));

jest.mock('@/lib/rate-limit', () => ({
  RateLimitType: {
    READ: 'READ',
    WRITE: 'WRITE',
  },
  withRateLimit:
    () =>
    (handler: any) =>
    (request: unknown, context?: Record<string, unknown>) =>
      handler(request, context),
}));

const created = {
  userIds: new Set<string>(),
  supplierIds: new Set<string>(),
  productIds: new Set<string>(),
  inboundRecordIds: new Set<string>(),
  ledgerIds: new Set<string>(),
  idempotencyKeys: new Set<string>(),
};

function createJsonRequest(url: string, body: unknown, method = 'POST') {
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
      email: `purchase-damage-${randomUUID().slice(0, 8)}@integration.test`,
      username: `purchase_damage_${randomUUID().slice(0, 8)}`,
      name: '采购破损台账测试用户',
      passwordHash: 'test-hash',
      role: 'admin',
      status: 'active',
    },
    select: { id: true },
  });

  created.userIds.add(user.id);
  authUserId = user.id;
  return user.id;
}

async function createTestSupplier() {
  const supplier = await prisma.supplier.create({
    data: {
      name: `采购破损供应商-${randomUUID().slice(0, 6)}`,
      supplierCode: `PDS-${randomUUID().slice(0, 6)}`,
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
      code: `PDS-${randomUUID().slice(0, 8)}`,
      name: '采购破损测试产品',
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

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  try {
    const productIds = Array.from(created.productIds);
    const supplierIds = Array.from(created.supplierIds);
    const userIds = Array.from(created.userIds);
    const inboundRecordIds = Array.from(created.inboundRecordIds);
    const ledgerIds = Array.from(created.ledgerIds);
    const idempotencyKeys = Array.from(created.idempotencyKeys);

    if (ledgerIds.length > 0) {
      await prisma.purchaseInboundDamageLedger.deleteMany({
        where: { id: { in: ledgerIds } },
      });
    }

    if (inboundRecordIds.length > 0) {
      await prisma.inventoryCostQueue.deleteMany({
        where: { inboundRecordId: { in: inboundRecordIds } },
      });
      await prisma.inboundRecord.deleteMany({
        where: { id: { in: inboundRecordIds } },
      });
    }

    if (productIds.length > 0) {
      await prisma.inventory.deleteMany({
        where: { productId: { in: productIds } },
      });
      await prisma.batchSpecification.deleteMany({
        where: { productId: { in: productIds } },
      });
      await prisma.product.deleteMany({
        where: { id: { in: productIds } },
      });
    }

    if (idempotencyKeys.length > 0 && userIds.length > 0) {
      await prisma.inventoryOperation.deleteMany({
        where: {
          operatorId: { in: userIds },
          idempotencyKey: { in: idempotencyKeys },
        },
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

describe('采购到货破损台账集成回归', () => {
  it('采购入库登记报工厂赔付时，应自动生成待跟进台账，并支持状态流转', async () => {
    await createTestUser();
    const supplierId = await createTestSupplier();
    const productId = await createTestProduct();
    const idempotencyKey = randomUUID();
    created.idempotencyKeys.add(idempotencyKey);

    const response = await createInboundRoute(
      createJsonRequest('http://localhost/api/inventory/inbound', {
        idempotencyKey,
        productId,
        supplierId,
        inputQuantity: 100,
        inputUnit: 'pieces',
        quantity: 95,
        damagedInputQuantity: 5,
        damagedQuantity: 5,
        damageHandling: 'supplier_claim',
        damageRemarks: '外箱破损，待向工厂登记',
        reason: 'purchase',
        unitCost: 10,
        piecesPerUnit: 12,
        weight: 18,
        batchNumber: `PDS-BATCH-${randomUUID().slice(0, 6)}`,
      })
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      success: boolean;
      data: { id: string };
    };

    expect(body.success).toBe(true);
    created.inboundRecordIds.add(body.data.id);

    const ledger = await prisma.purchaseInboundDamageLedger.findUnique({
      where: { inboundRecordId: body.data.id },
      select: {
        id: true,
        ledgerNumber: true,
        damagedQuantity: true,
        damageHandling: true,
        referenceAmount: true,
        status: true,
        remarks: true,
      },
    });

    expect(ledger).not.toBeNull();
    if (!ledger) {
      return;
    }

    created.ledgerIds.add(ledger.id);

    expect(ledger.ledgerNumber).toMatch(/^PIL/);
    expect(ledger.damagedQuantity).toBe(5);
    expect(ledger.damageHandling).toBe('supplier_claim');
    expect(Number(ledger.referenceAmount ?? 0)).toBe(50);
    expect(ledger.status).toBe('pending_claim');
    expect(ledger.remarks).toContain('待向工厂登记');

    const patchResponse = await updatePurchaseDamageLedgerRoute(
      createJsonRequest(
        `http://localhost/api/inventory/purchase-damage-ledgers/${ledger.id}`,
        {
          status: 'claim_submitted',
          remarks: '今天已经登记给工厂，等待赔付结果',
        },
        'PATCH'
      ),
      { params: Promise.resolve({ id: ledger.id }) }
    );

    expect(patchResponse.status).toBe(200);

    const updatedLedger = await prisma.purchaseInboundDamageLedger.findUnique({
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
  });

  it('采购入库登记内部承担时，应自动生成已结案台账，并能被页面查询服务读到', async () => {
    await createTestUser();
    const supplierId = await createTestSupplier();
    const productId = await createTestProduct();
    const inboundRecord = await prisma.inboundRecord.create({
      data: {
        recordNumber: `IN-BACKFILL-${randomUUID().slice(0, 8)}`,
        productId,
        supplierId,
        batchNumber: `PDS-BATCH-${randomUUID().slice(0, 6)}`,
        quantity: 88,
        damagedQuantity: 12,
        damageHandling: 'internal_loss',
        damageTotalCost: '96.00',
        damageRemarks: '不报工厂，内部承担',
        unitCost: '8.000',
        totalCost: '704.00',
        reason: 'purchase',
        userId: authUserId,
      },
      select: {
        id: true,
      },
    });
    created.inboundRecordIds.add(inboundRecord.id);

    const result = await listPurchaseDamageLedgers({
      search: 'IN-BACKFILL',
    });

    const ledger = result.data.find(
      item => item.inboundRecord?.id === inboundRecord.id
    );

    expect(ledger).toBeDefined();
    expect(ledger?.status).toBe('internal_closed');
    expect(ledger?.damageHandling).toBe('internal_loss');
    expect(ledger?.referenceAmount).toBe(96);
    expect(ledger?.remarks).toContain('内部承担');

    if (ledger) {
      created.ledgerIds.add(ledger.id);
    }
  });

  it('同产品不同批次装箱数不一致时，台账列表应优先返回批次装箱数', async () => {
    await createTestUser();
    const supplierId = await createTestSupplier();
    const productId = await createTestProduct();
    const batchNumber = `PDS-BATCH-${randomUUID().slice(0, 6)}`;

    await prisma.batchSpecification.create({
      data: {
        productId,
        batchNumber,
        piecesPerUnit: 8,
        weight: '18.000',
      },
    });

    const inboundRecord = await prisma.inboundRecord.create({
      data: {
        recordNumber: `IN-BATCHPPU-${randomUUID().slice(0, 8)}`,
        productId,
        supplierId,
        batchNumber,
        quantity: 80,
        damagedQuantity: 8,
        damageHandling: 'supplier_claim',
        damageTotalCost: '64.00',
        damageRemarks: '按批次装箱数回归',
        unitCost: '8.000',
        totalCost: '640.00',
        reason: 'purchase',
        userId: authUserId,
      },
      select: {
        id: true,
      },
    });
    created.inboundRecordIds.add(inboundRecord.id);

    const result = await listPurchaseDamageLedgers({
      search: 'IN-BATCHPPU',
    });

    const ledger = result.data.find(
      item => item.inboundRecord?.id === inboundRecord.id
    );

    expect(ledger).toBeDefined();
    expect(ledger?.batchPiecesPerUnit).toBe(8);
    expect(ledger?.product?.piecesPerUnit).toBe(12);
  });
});
