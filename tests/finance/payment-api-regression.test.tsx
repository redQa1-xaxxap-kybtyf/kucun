import { randomUUID } from 'node:crypto';

import { POST as confirmPayment } from '@/app/api/payments/[id]/confirm/route';
import { PUT as updatePayment } from '@/app/api/payments/[id]/route';
import { POST as createPayment } from '@/app/api/payments/route';
import { prisma } from '@/lib/db';

jest.setTimeout(30000);

const testRunId = `payment-api-${Date.now()}`;

let authUserId = 'test-user-id';

jest.mock('@/lib/auth/api-helpers', () => ({
  withAuth:
    (handler: any) =>
    (request: unknown, context?: Record<string, unknown>) =>
      handler(request, {
        ...(context ?? {}),
        user: {
          id: authUserId,
          name: 'Payment API Regression Tester',
          role: 'admin',
          permissions: ['finance:manage', 'finance:view'],
        },
      }),
}));

const createdRecords = {
  userId: '' as string | null,
  customerIds: new Set<string>(),
  salesOrderIds: new Set<string>(),
  paymentRecordIds: new Set<string>(),
};

const randomDigits = (length: number) =>
  Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');

async function createTestUser() {
  const unique = `payment-api-user-${randomUUID().slice(0, 8)}`;
  const user = await prisma.user.create({
    data: {
      email: `${unique}@integration.test`,
      username: unique,
      name: `Payment API Tester ${testRunId}`,
      passwordHash: 'test-hash',
      role: 'admin',
      status: 'active',
    },
    select: { id: true },
  });

  createdRecords.userId = user.id;
  authUserId = user.id;
}

async function createSalesOrderFixture() {
  if (!createdRecords.userId) {
    await createTestUser();
  }
  const userId = createdRecords.userId;
  if (!userId) {
    throw new Error('测试用户创建失败');
  }

  const customer = await prisma.customer.create({
    data: {
      name: `收款回归客户-${testRunId}-${randomDigits(4)}`,
      phone: `138${randomDigits(8)}`,
      address: 'Payment API Regression',
    },
    select: { id: true },
  });
  createdRecords.customerIds.add(customer.id);

  const order = await prisma.salesOrder.create({
    data: {
      orderNumber: `SO-PAY-REG-${randomUUID().slice(0, 8)}`,
      customerId: customer.id,
      userId,
      status: 'confirmed',
      totalAmount: 100,
      itemsAmount: 100,
      roundingAdjustment: 0,
      paidAmount: 0,
      remarks: `payment-api-${testRunId}`,
    },
    select: { id: true, customerId: true },
  });
  createdRecords.salesOrderIds.add(order.id);

  return order;
}

beforeAll(async () => {
  await prisma.$connect();
  await createTestUser();
});

afterAll(async () => {
  try {
    if (createdRecords.paymentRecordIds.size > 0) {
      await prisma.paymentRecord.deleteMany({
        where: { id: { in: Array.from(createdRecords.paymentRecordIds) } },
      });
    }

    if (createdRecords.salesOrderIds.size > 0) {
      await prisma.salesOrder.deleteMany({
        where: { id: { in: Array.from(createdRecords.salesOrderIds) } },
      });
    }

    if (createdRecords.customerIds.size > 0) {
      const customerIds = Array.from(createdRecords.customerIds);
      await prisma.accountStatement.deleteMany({
        where: { entityId: { in: customerIds } },
      });
      await prisma.customer.deleteMany({
        where: { id: { in: customerIds } },
      });
    }

    if (createdRecords.userId) {
      await prisma.user.delete({ where: { id: createdRecords.userId } });
    }
  } finally {
    await prisma.$disconnect();
  }
});

describe('收款 API 防回归', () => {
  test('已有待确认收款时，阻止第二笔待确认重复登记', async () => {
    const order = await createSalesOrderFixture();

    const firstResponse = await createPayment({
      url: 'http://localhost/api/payments',
      json: async () => ({
        paymentType: 'order_payment',
        salesOrderId: order.id,
        customerId: order.customerId,
        paymentMethod: 'cash',
        paymentAmount: 60,
        actualPaymentAmount: 60,
        roundingAmount: 0,
        paymentDate: new Date().toISOString(),
      }),
    } as any);

    expect(firstResponse.status).toBe(200);
    const firstBody = (await (firstResponse as any).json()) as {
      success: boolean;
      data: { id: string };
    };
    expect(firstBody.success).toBe(true);
    createdRecords.paymentRecordIds.add(firstBody.data.id);

    const secondResponse = await createPayment({
      url: 'http://localhost/api/payments',
      json: async () => ({
        paymentType: 'order_payment',
        salesOrderId: order.id,
        customerId: order.customerId,
        paymentMethod: 'cash',
        paymentAmount: 40,
        actualPaymentAmount: 40,
        roundingAmount: 0,
        paymentDate: new Date().toISOString(),
      }),
    } as any);

    expect(secondResponse.status).toBe(400);
    const secondBody = (await (secondResponse as any).json()) as {
      success: boolean;
      error?: string;
    };
    expect(secondBody.success).toBe(false);
    expect(secondBody.error).toContain('已有待确认到账的收款');
  });

  test('确认到账时，抹零不会重复计入并导致订单提前完结', async () => {
    const order = await createSalesOrderFixture();

    await prisma.salesOrder.update({
      where: { id: order.id },
      data: { status: 'shipped' },
    });

    const paymentResponse = await createPayment({
      url: 'http://localhost/api/payments',
      json: async () => ({
        paymentType: 'order_payment',
        salesOrderId: order.id,
        customerId: order.customerId,
        paymentMethod: 'cash',
        paymentAmount: 99.8,
        actualPaymentAmount: 99.6,
        roundingAmount: 0.2,
        paymentDate: new Date().toISOString(),
      }),
    } as any);

    expect(paymentResponse.status).toBe(200);
    const paymentBody = (await (paymentResponse as any).json()) as {
      success: boolean;
      data: { id: string };
    };
    expect(paymentBody.success).toBe(true);
    createdRecords.paymentRecordIds.add(paymentBody.data.id);

    const confirmResponse = await confirmPayment(
      {
        bodyUsed: false,
        json: async () => ({ notes: `confirm-${testRunId}` }),
      } as any,
      { params: { id: paymentBody.data.id } } as any
    );

    expect(confirmResponse.status).toBe(200);

    const orderAfterConfirm = await prisma.salesOrder.findUnique({
      where: { id: order.id },
      select: { status: true },
    });
    expect(orderAfterConfirm?.status).toBe('shipped');
  });

  test('待确认收款不能直接改状态，已到账收款不允许再次修改', async () => {
    const order = await createSalesOrderFixture();

    const paymentResponse = await createPayment({
      url: 'http://localhost/api/payments',
      json: async () => ({
        paymentType: 'order_payment',
        salesOrderId: order.id,
        customerId: order.customerId,
        paymentMethod: 'cash',
        paymentAmount: 40,
        actualPaymentAmount: 40,
        roundingAmount: 0,
        paymentDate: new Date().toISOString(),
      }),
    } as any);

    expect(paymentResponse.status).toBe(200);
    const paymentBody = (await (paymentResponse as any).json()) as {
      success: boolean;
      data: { id: string };
    };
    expect(paymentBody.success).toBe(true);
    createdRecords.paymentRecordIds.add(paymentBody.data.id);

    const rejectStatusUpdateResponse = await updatePayment(
      {
        json: async () => ({
          status: 'confirmed',
          paymentAmount: 40,
          actualPaymentAmount: 40,
          roundingAmount: 0,
        }),
      } as any,
      { params: { id: paymentBody.data.id } } as any
    );

    expect(rejectStatusUpdateResponse.status).toBe(400);

    const confirmResponse = await confirmPayment(
      {
        bodyUsed: false,
        json: async () => ({ notes: `confirm-update-${testRunId}` }),
      } as any,
      { params: { id: paymentBody.data.id } } as any
    );
    expect(confirmResponse.status).toBe(200);

    const rejectConfirmedUpdateResponse = await updatePayment(
      {
        json: async () => ({
          paymentAmount: 41,
          actualPaymentAmount: 41,
          roundingAmount: 0,
        }),
      } as any,
      { params: { id: paymentBody.data.id } } as any
    );

    expect(rejectConfirmedUpdateResponse.status).toBe(400);
    const rejectConfirmedUpdateBody =
      (await (rejectConfirmedUpdateResponse as any).json()) as {
        success: boolean;
        error?: string;
      };
    expect(rejectConfirmedUpdateBody.success).toBe(false);
    expect(rejectConfirmedUpdateBody.error).toContain(
      '只有待确认到账的收款记录才允许修改'
    );
  });
});
