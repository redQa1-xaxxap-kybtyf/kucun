import { randomUUID } from 'node:crypto';

import { POST as createPaymentOut } from '@/app/api/finance/payments-out/route';
import {
  DELETE as voidPaymentOut,
  PUT as updatePaymentOut,
} from '@/app/api/finance/payments-out/[id]/route';
import { prisma } from '@/lib/db';

jest.setTimeout(60000);

const testRunId = `payments-out-idempotency-${Date.now()}`;

let authUserId = 'test-user-id';

jest.mock('@/lib/auth/api-helpers', () => ({
  ...jest.requireActual('@/lib/auth/api-helpers'),
  withAuth:
    (handler: any) =>
    (request: unknown, context?: Record<string, unknown>) =>
      handler(request, {
        ...(context ?? {}),
        user: {
          id: authUserId,
          name: 'PaymentsOut Integration Tester',
          role: 'admin',
          permissions: ['finance:manage', 'finance:view'],
        },
      }),
}));

jest.mock('@/lib/rate-limit', () => ({
  RateLimitType: {
    READ: 'READ',
    WRITE: 'WRITE',
  },
  withRateLimit: () => (handler: any) => handler,
}));

const createdRecords = {
  userId: '' as string | null,
  supplierIds: new Set<string>(),
  payableIds: new Set<string>(),
  paymentIds: new Set<string>(),
  idempotencyKeys: new Set<string>(),
};

const randomDigits = (length: number) =>
  Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');

async function createTestUser() {
  const unique = `payments-out-user-${randomUUID().slice(0, 8)}`;
  const user = await prisma.user.create({
    data: {
      email: `${unique}@integration.test`,
      username: unique,
      name: `PaymentsOut Tester ${testRunId}`,
      passwordHash: 'test-hash',
      role: 'admin',
      status: 'active',
    },
    select: { id: true },
  });

  createdRecords.userId = user.id;
  authUserId = user.id;
  return user.id;
}

async function createTestSupplier(label: string) {
  const supplier = await prisma.supplier.create({
    data: {
      name: `集成测试供应商-${label}-${testRunId}`,
      phone: `139${randomDigits(8)}`,
      address: `Integration Address ${label}`,
      status: 'active',
    },
    select: { id: true },
  });
  createdRecords.supplierIds.add(supplier.id);
  return supplier.id;
}

async function createTestPayableRecord({
  supplierId,
  userId,
  amount,
}: {
  supplierId: string;
  userId: string;
  amount: number;
}) {
  const payableNumber = `AP-${randomUUID().slice(0, 10)}-${testRunId.slice(-4)}`;
  const payable = await prisma.payableRecord.create({
    data: {
      payableNumber,
      supplierId,
      userId,
      sourceType: 'other',
      payableAmount: amount,
      paidAmount: 0,
      remainingAmount: amount,
      status: 'pending',
      description: `integration-${testRunId}`,
      remarks: `integration-${testRunId}`,
    },
    select: { id: true },
  });
  createdRecords.payableIds.add(payable.id);
  return payable.id;
}

async function createPaymentOutFixture({
  supplierId,
  payableRecordId,
  amount,
}: {
  supplierId: string;
  payableRecordId: string;
  amount: number;
}) {
  const idempotencyKey = randomUUID();
  createdRecords.idempotencyKeys.add(idempotencyKey);

  const response = await createPaymentOut({
    json: async () => ({
      idempotencyKey,
      payableRecordId,
      supplierId,
      paymentMethod: 'cash',
      paymentAmount: amount,
      paymentDate: new Date().toISOString(),
      remarks: `create-${testRunId}`,
    }),
  } as any);

  expect(response.status).toBe(201);

  const body = (await (response as any).json()) as {
    success: boolean;
    data: { id: string; paymentNumber: string; paymentAmount: number };
  };
  expect(body.success).toBe(true);

  createdRecords.paymentIds.add(body.data.id);

  return {
    paymentId: body.data.id,
    paymentNumber: body.data.paymentNumber,
  };
}

beforeAll(async () => {
  await prisma.$connect();
  await createTestUser();
});

afterAll(async () => {
  try {
    const supplierIds = Array.from(createdRecords.supplierIds);
    if (supplierIds.length > 0) {
      await prisma.paymentOutRecord.deleteMany({
        where: { supplierId: { in: supplierIds } },
      });
      await prisma.payableRecord.deleteMany({
        where: { supplierId: { in: supplierIds } },
      });
      await prisma.accountStatement.deleteMany({
        where: { entityId: { in: supplierIds } },
      });
      await prisma.supplier.deleteMany({
        where: { id: { in: supplierIds } },
      });
    }

    const idempotencyKeys = Array.from(createdRecords.idempotencyKeys);
    if (idempotencyKeys.length > 0) {
      await prisma.inventoryOperation.deleteMany({
        where: { idempotencyKey: { in: idempotencyKeys } },
      });
    }

    if (createdRecords.userId) {
      await prisma.user.delete({ where: { id: createdRecords.userId } });
    }
  } finally {
    await prisma.$disconnect();
  }
});

describe('付款记录：更新/作废 并发幂等（真实数据库集成）', () => {
  it('更新付款金额幂等：并发两次相同 idempotencyKey，只应写一条差额流水且应付款只调整一次', async () => {
    const userId = createdRecords.userId as string;
    const supplierId = await createTestSupplier('update');
    const payableRecordId = await createTestPayableRecord({
      supplierId,
      userId,
      amount: 1000,
    });

    const { paymentId } = await createPaymentOutFixture({
      supplierId,
      payableRecordId,
      amount: 100,
    });

    const updateKey = randomUUID();
    createdRecords.idempotencyKeys.add(updateKey);

    const requestBody = { paymentAmount: 150, idempotencyKey: updateKey };

    const [r1, r2] = await Promise.all([
      updatePaymentOut(
        { json: async () => requestBody } as any,
        { params: { id: paymentId } } as any
      ),
      updatePaymentOut(
        { json: async () => requestBody } as any,
        { params: { id: paymentId } } as any
      ),
    ]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    const payableAfter = await prisma.payableRecord.findUnique({
      where: { id: payableRecordId },
      select: { paidAmount: true, remainingAmount: true, status: true },
    });

    expect(Number(payableAfter?.paidAmount ?? 0)).toBeCloseTo(150, 2);
    expect(Number(payableAfter?.remainingAmount ?? 0)).toBeCloseTo(850, 2);
    expect(payableAfter?.status).toBe('partial');

    const deltaTransactionCount = await prisma.statementTransaction.count({
      where: {
        referenceId: updateKey,
        transactionType: 'payment_out',
      },
    });
    expect(deltaTransactionCount).toBe(1);

    const op = await prisma.inventoryOperation.findUnique({
      where: { idempotencyKey: updateKey },
      select: { status: true, operationType: true },
    });
    expect(op?.status).toBe('completed');
    expect(op?.operationType).toBe('payment_out_update');
  });

  it('作废幂等：并发两次相同 idempotencyKey，只应回滚一次应付款且反向流水只落一条', async () => {
    const userId = createdRecords.userId as string;
    const supplierId = await createTestSupplier('void');
    const payableRecordId = await createTestPayableRecord({
      supplierId,
      userId,
      amount: 500,
    });

    const { paymentId } = await createPaymentOutFixture({
      supplierId,
      payableRecordId,
      amount: 80,
    });

    const voidKey = randomUUID();
    createdRecords.idempotencyKeys.add(voidKey);

    const requestBody = {
      voidReason: `integration-${testRunId}`,
      idempotencyKey: voidKey,
    };

    const [d1, d2] = await Promise.all([
      voidPaymentOut(
        { json: async () => requestBody } as any,
        { params: { id: paymentId } } as any
      ),
      voidPaymentOut(
        { json: async () => requestBody } as any,
        { params: { id: paymentId } } as any
      ),
    ]);

    expect(d1.status).toBe(200);
    expect(d2.status).toBe(200);

    const paymentAfter = await prisma.paymentOutRecord.findUnique({
      where: { id: paymentId },
      select: { status: true, voidedAt: true },
    });
    expect(paymentAfter?.status).toBe('cancelled');
    expect(paymentAfter?.voidedAt).toBeTruthy();

    const payableAfter = await prisma.payableRecord.findUnique({
      where: { id: payableRecordId },
      select: { paidAmount: true, remainingAmount: true, status: true },
    });

    expect(Number(payableAfter?.paidAmount ?? 0)).toBeCloseTo(0, 2);
    expect(Number(payableAfter?.remainingAmount ?? 0)).toBeCloseTo(500, 2);
    expect(payableAfter?.status).toBe('pending');

    const reversalCount = await prisma.statementTransaction.count({
      where: {
        referenceId: paymentId,
        transactionType: 'payment_out_reversal',
      },
    });
    expect(reversalCount).toBe(1);

    const op = await prisma.inventoryOperation.findUnique({
      where: { idempotencyKey: voidKey },
      select: { status: true, operationType: true },
    });
    expect(op?.status).toBe('completed');
    expect(op?.operationType).toBe('payment_out_void');
  });
});
