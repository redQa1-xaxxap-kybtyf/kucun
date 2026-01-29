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
  it('更新付款金额校验：超出应付金额应返回 400，且不应改变应付款/不应写差额流水', async () => {
    const userId = createdRecords.userId as string;
    const supplierId = await createTestSupplier('overpay');
    const payableRecordId = await createTestPayableRecord({
      supplierId,
      userId,
      amount: 200,
    });

    const { paymentId } = await createPaymentOutFixture({
      supplierId,
      payableRecordId,
      amount: 80,
    });

    const payableBefore = await prisma.payableRecord.findUnique({
      where: { id: payableRecordId },
      select: { paidAmount: true, remainingAmount: true, status: true },
    });
    const paymentBefore = await prisma.paymentOutRecord.findUnique({
      where: { id: paymentId },
      select: { paymentAmount: true, status: true, voidedAt: true },
    });

    const updateKey = randomUUID();
    createdRecords.idempotencyKeys.add(updateKey);

    const response = await updatePaymentOut(
      { json: async () => ({ paymentAmount: 250, idempotencyKey: updateKey }) } as any,
      { params: { id: paymentId } } as any
    );

    expect(response.status).toBe(400);

    const body = (await (response as any).json()) as {
      success: boolean;
      error?: string;
    };
    expect(body.success).toBe(false);
    expect(body.error ?? '').toContain('不能超过应付金额');

    const payableAfter = await prisma.payableRecord.findUnique({
      where: { id: payableRecordId },
      select: { paidAmount: true, remainingAmount: true, status: true },
    });
    const paymentAfter = await prisma.paymentOutRecord.findUnique({
      where: { id: paymentId },
      select: { paymentAmount: true, status: true, voidedAt: true },
    });

    expect(Number(payableAfter?.paidAmount ?? 0)).toBeCloseTo(
      Number(payableBefore?.paidAmount ?? 0),
      2
    );
    expect(Number(payableAfter?.remainingAmount ?? 0)).toBeCloseTo(
      Number(payableBefore?.remainingAmount ?? 0),
      2
    );
    expect(payableAfter?.status).toBe(payableBefore?.status);

    expect(Number(paymentAfter?.paymentAmount ?? 0)).toBeCloseTo(
      Number(paymentBefore?.paymentAmount ?? 0),
      2
    );
    expect(paymentAfter?.status).toBe(paymentBefore?.status);
    expect(Boolean(paymentAfter?.voidedAt)).toBe(Boolean(paymentBefore?.voidedAt));

    const deltaTransactionCount = await prisma.statementTransaction.count({
      where: { referenceId: updateKey, transactionType: 'payment_out' },
    });
    const reversalTransactionCount = await prisma.statementTransaction.count({
      where: { referenceId: updateKey, transactionType: 'payment_out_reversal' },
    });
    expect(deltaTransactionCount).toBe(0);
    expect(reversalTransactionCount).toBe(0);

    const op = await prisma.inventoryOperation.findUnique({
      where: { idempotencyKey: updateKey },
      select: { status: true, operationType: true, errorMessage: true },
    });
    expect(op?.operationType).toBe('payment_out_update');
    expect(op?.status).toBe('failed');
    expect(op?.errorMessage ?? '').toContain('不能超过应付金额');
  });

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

  it('更新付款金额下调幂等：并发两次相同 idempotencyKey，应写 payment_out_reversal 差额流水且应付款只回滚一次', async () => {
    const userId = createdRecords.userId as string;
    const supplierId = await createTestSupplier('decrease');
    const payableRecordId = await createTestPayableRecord({
      supplierId,
      userId,
      amount: 500,
    });

    const { paymentId } = await createPaymentOutFixture({
      supplierId,
      payableRecordId,
      amount: 120,
    });

    const updateKey = randomUUID();
    createdRecords.idempotencyKeys.add(updateKey);

    const requestBody = { paymentAmount: 80, idempotencyKey: updateKey };

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

    expect(Number(payableAfter?.paidAmount ?? 0)).toBeCloseTo(80, 2);
    expect(Number(payableAfter?.remainingAmount ?? 0)).toBeCloseTo(420, 2);
    expect(payableAfter?.status).toBe('partial');

    const reversalTransactionCount = await prisma.statementTransaction.count({
      where: {
        referenceId: updateKey,
        transactionType: 'payment_out_reversal',
      },
    });
    expect(reversalTransactionCount).toBe(1);

    const op = await prisma.inventoryOperation.findUnique({
      where: { idempotencyKey: updateKey },
      select: { status: true, operationType: true },
    });
    expect(op?.status).toBe('completed');
    expect(op?.operationType).toBe('payment_out_update');
  });

  it('作废无需幂等键：不传 body 也可作废，重复请求返回已作废且不重复写反向流水', async () => {
    const userId = createdRecords.userId as string;
    const supplierId = await createTestSupplier('void-no-key');
    const payableRecordId = await createTestPayableRecord({
      supplierId,
      userId,
      amount: 300,
    });

    const { paymentId } = await createPaymentOutFixture({
      supplierId,
      payableRecordId,
      amount: 50,
    });

    const first = await voidPaymentOut(
      {} as any,
      { params: { id: paymentId } } as any
    );

    expect(first.status).toBe(200);

    const firstBody = (await (first as any).json()) as {
      success?: boolean;
      message?: string;
    };
    expect(firstBody.success).toBe(true);

    const paymentAfterFirst = await prisma.paymentOutRecord.findUnique({
      where: { id: paymentId },
      select: { status: true, voidedAt: true },
    });
    expect(paymentAfterFirst?.status).toBe('cancelled');
    expect(paymentAfterFirst?.voidedAt).toBeTruthy();

    const payableAfterFirst = await prisma.payableRecord.findUnique({
      where: { id: payableRecordId },
      select: { paidAmount: true, remainingAmount: true, status: true },
    });

    expect(Number(payableAfterFirst?.paidAmount ?? 0)).toBeCloseTo(0, 2);
    expect(Number(payableAfterFirst?.remainingAmount ?? 0)).toBeCloseTo(300, 2);
    expect(payableAfterFirst?.status).toBe('pending');

    const reversalCountFirst = await prisma.statementTransaction.count({
      where: {
        referenceId: paymentId,
        transactionType: 'payment_out_reversal',
      },
    });
    expect(reversalCountFirst).toBe(1);

    const voidOps = await prisma.inventoryOperation.count({
      where: { operationType: 'payment_out_void', entityId: paymentId },
    });
    expect(voidOps).toBe(0);

    const second = await voidPaymentOut(
      {} as any,
      { params: { id: paymentId } } as any
    );

    expect(second.status).toBe(200);

    const secondBody = (await (second as any).json()) as {
      success?: boolean;
      message?: string;
    };
    expect(secondBody.success).toBe(true);
    expect(secondBody.message ?? '').toContain('已作废');

    const reversalCountSecond = await prisma.statementTransaction.count({
      where: {
        referenceId: paymentId,
        transactionType: 'payment_out_reversal',
      },
    });
    expect(reversalCountSecond).toBe(1);
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

  it('作废后更新应拒绝：返回 400 且不应写差额流水/不应写幂等记录', async () => {
    const userId = createdRecords.userId as string;
    const supplierId = await createTestSupplier('void-then-update');
    const payableRecordId = await createTestPayableRecord({
      supplierId,
      userId,
      amount: 400,
    });

    const { paymentId } = await createPaymentOutFixture({
      supplierId,
      payableRecordId,
      amount: 90,
    });

    const voidKey = randomUUID();
    createdRecords.idempotencyKeys.add(voidKey);

    const voidResponse = await voidPaymentOut(
      { json: async () => ({ voidReason: `integration-${testRunId}`, idempotencyKey: voidKey }) } as any,
      { params: { id: paymentId } } as any
    );

    expect(voidResponse.status).toBe(200);

    const updateKey = randomUUID();
    createdRecords.idempotencyKeys.add(updateKey);

    const updateResponse = await updatePaymentOut(
      { json: async () => ({ paymentAmount: 60, idempotencyKey: updateKey }) } as any,
      { params: { id: paymentId } } as any
    );

    expect(updateResponse.status).toBe(400);

    const body = (await (updateResponse as any).json()) as {
      success: boolean;
      error?: string;
    };
    expect(body.success).toBe(false);
    expect(body.error ?? '').toContain('已作废');

    const paymentAfter = await prisma.paymentOutRecord.findUnique({
      where: { id: paymentId },
      select: { status: true, paymentAmount: true, voidedAt: true },
    });
    expect(paymentAfter?.status).toBe('cancelled');
    expect(paymentAfter?.voidedAt).toBeTruthy();
    expect(Number(paymentAfter?.paymentAmount ?? 0)).toBeCloseTo(90, 2);

    const payableAfter = await prisma.payableRecord.findUnique({
      where: { id: payableRecordId },
      select: { paidAmount: true, remainingAmount: true, status: true },
    });
    expect(Number(payableAfter?.paidAmount ?? 0)).toBeCloseTo(0, 2);
    expect(Number(payableAfter?.remainingAmount ?? 0)).toBeCloseTo(400, 2);
    expect(payableAfter?.status).toBe('pending');

    const deltaTransactionCount = await prisma.statementTransaction.count({
      where: { referenceId: updateKey, transactionType: 'payment_out' },
    });
    const reversalTransactionCount = await prisma.statementTransaction.count({
      where: { referenceId: updateKey, transactionType: 'payment_out_reversal' },
    });
    expect(deltaTransactionCount).toBe(0);
    expect(reversalTransactionCount).toBe(0);

    const updateOp = await prisma.inventoryOperation.findUnique({
      where: { idempotencyKey: updateKey },
      select: { id: true },
    });
    expect(updateOp).toBeNull();
  });
});
