/* eslint-disable max-lines-per-function */

import { loadEnvConfig } from '@next/env';
import { expect, test, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { loginAsAdminViaApi } from './utils/auth';

loadEnvConfig(process.cwd());

const prisma = new PrismaClient();
const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000').replace(
  '127.0.0.1',
  'localhost'
);
const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME ?? 'admin';

type OrderFixture = {
  id: string;
  orderNumber: string;
  totalAmount: number;
};

type Fixture = {
  customerId: string;
  directOrder: OrderFixture;
  pendingOrder: OrderFixture;
  runId: string;
};

const fixture: Partial<Fixture> = {
  runId: `e2e-receivable-pay-${Date.now().toString(36)}`,
};

function buildName(prefix: string) {
  return `${prefix}-${fixture.runId}`.toUpperCase();
}

async function getAdminUser() {
  const admin = await prisma.user.findUnique({
    where: { username: ADMIN_USERNAME },
    select: {
      id: true,
      username: true,
      passwordHash: true,
    },
  });

  if (!admin) {
    throw new Error(`未找到用户名为 ${ADMIN_USERNAME} 的管理员账号`);
  }

  return admin;
}

async function resolveAdminPassword() {
  const admin = await getAdminUser();
  const candidates = [
    process.env.E2E_ADMIN_PASSWORD,
    'admin123456',
    'admin123',
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (await bcrypt.compare(candidate, admin.passwordHash)) {
      return candidate;
    }
  }

  throw new Error(
    `无法匹配管理员 ${admin.username} 的测试密码，请设置 E2E_ADMIN_PASSWORD`
  );
}

async function loginAsAdmin(page: Page) {
  const password = await resolveAdminPassword();
  await loginAsAdminViaApi(page, BASE_URL, {
    username: ADMIN_USERNAME,
    password,
  });
}

async function recoverFromChunkLoadError(page: Page) {
  const hasChunkLoadError = await page
    .getByText('Runtime ChunkLoadError')
    .isVisible()
    .catch(() => false);

  if (hasChunkLoadError) {
    await page.reload({ waitUntil: 'domcontentloaded' });
  }
}

async function gotoRoute(page: Page, path: string) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
  await recoverFromChunkLoadError(page);
}

async function waitForPaymentRecord(
  salesOrderId: string,
  status: 'pending' | 'confirmed',
  timeoutMs = 20_000
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const payment = await prisma.paymentRecord.findFirst({
      where: {
        salesOrderId,
        status,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        paymentNumber: true,
        status: true,
      },
    });

    if (payment) {
      return payment;
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  throw new Error(`等待销售订单 ${salesOrderId} 生成 ${status} 收款记录超时`);
}

async function createFixtureData() {
  const admin = await getAdminUser();
  const customer = await prisma.customer.create({
    data: {
      name: buildName('E2E收款客户'),
      role: 'customer',
      phone: '13900000001',
      address: 'E2E 财务真实点击地址',
    },
    select: { id: true },
  });

  const pendingOrder = await prisma.salesOrder.create({
    data: {
      orderNumber: buildName('SO-PENDING'),
      customerId: customer.id,
      userId: admin.id,
      status: 'confirmed',
      orderType: 'NORMAL',
      transferMode: 'SUPPLIER_ONLY',
      orderDate: new Date(),
      itemsAmount: 320,
      additionalFees: 0,
      totalAmount: 320,
      paidAmount: 0,
      roundingAdjustment: 0,
      remarks: 'E2E 客户待收款待确认到账真实点击',
    },
    select: {
      id: true,
      orderNumber: true,
      totalAmount: true,
    },
  });

  const directOrder = await prisma.salesOrder.create({
    data: {
      orderNumber: buildName('SO-DIRECT'),
      customerId: customer.id,
      userId: admin.id,
      status: 'confirmed',
      orderType: 'NORMAL',
      transferMode: 'SUPPLIER_ONLY',
      orderDate: new Date(),
      itemsAmount: 480,
      additionalFees: 0,
      totalAmount: 480,
      paidAmount: 0,
      roundingAdjustment: 0,
      remarks: 'E2E 客户待收款直接到账真实点击',
    },
    select: {
      id: true,
      orderNumber: true,
      totalAmount: true,
    },
  });

  fixture.customerId = customer.id;
  fixture.pendingOrder = {
    id: pendingOrder.id,
    orderNumber: pendingOrder.orderNumber,
    totalAmount: Number(pendingOrder.totalAmount),
  };
  fixture.directOrder = {
    id: directOrder.id,
    orderNumber: directOrder.orderNumber,
    totalAmount: Number(directOrder.totalAmount),
  };
}

async function cleanupFixtureData() {
  const orderIds = [fixture.pendingOrder?.id, fixture.directOrder?.id].filter(
    (value): value is string => Boolean(value)
  );

  if (fixture.customerId) {
    await prisma.accountStatement
      .deleteMany({
        where: { entityId: fixture.customerId },
      })
      .catch(() => undefined);
  }

  if (orderIds.length > 0) {
    const payments = await prisma.paymentRecord.findMany({
      where: {
        salesOrderId: { in: orderIds },
      },
      select: { id: true },
    });
    const paymentIds = payments.map(item => item.id);

    if (paymentIds.length > 0) {
      await prisma.statementTransaction
        .deleteMany({
          where: { referenceId: { in: paymentIds } },
        })
        .catch(() => undefined);
    }

    await prisma.paymentRecord
      .deleteMany({
        where: {
          salesOrderId: { in: orderIds },
        },
      })
      .catch(() => undefined);

    await prisma.salesOrder
      .deleteMany({
        where: { id: { in: orderIds } },
      })
      .catch(() => undefined);
  }

  if (fixture.customerId) {
    await prisma.customer
      .delete({
        where: { id: fixture.customerId },
      })
      .catch(() => undefined);
  }
}

test.describe.serial('客户待收款收款链真实点击回归', () => {
  test.beforeAll(async () => {
    await createFixtureData();
  });

  test.afterAll(async () => {
    await cleanupFixtureData();
    await prisma.$disconnect();
  });

  test('列表页应支持登记待确认收款，再到收款管理确认到账', async ({
    page,
  }) => {
    if (!fixture.pendingOrder) {
      throw new Error('待确认收款测试夹具未准备完成');
    }

    await loginAsAdmin(page);

    await gotoRoute(
      page,
      `/finance/receivables?search=${encodeURIComponent(
        fixture.pendingOrder.orderNumber
      )}`
    );
    await expect(
      page.getByRole('heading', { name: '客户待收款' })
    ).toBeVisible();

    await expect(
      page.getByText(fixture.pendingOrder.orderNumber).last()
    ).toBeVisible();

    const dialogOpenButton = page
      .locator('button:has-text("登记收款"):visible')
      .first();
    await dialogOpenButton.click();

    const dialog = page.getByRole('dialog', { name: '登记收款' });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: '登记待确认收款' })
    ).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: '登记并确认到账' })
    ).toBeVisible();

    const createResponsePromise = page.waitForResponse(
      response =>
        response.url().endsWith('/api/payments') &&
        response.request().method() === 'POST'
    );

    const pendingSubmitButton = dialog.getByRole('button', {
      name: '登记待确认收款',
    });
    await pendingSubmitButton.scrollIntoViewIfNeeded();
    await pendingSubmitButton.evaluate((button: HTMLButtonElement) => {
      button.click();
    });
    const createResponse = await createResponsePromise;
    expect(createResponse.ok()).toBeTruthy();

    await expect(dialog).toBeHidden();
    await expect(page.getByText('已登记待确认收款').first()).toBeVisible();

    const pendingPayment = await waitForPaymentRecord(
      fixture.pendingOrder.id,
      'pending'
    );
    expect(pendingPayment.status).toBe('pending');

    await expect(
      page.locator('button:has-text("已有待确认"):visible').first()
    ).toBeVisible({ timeout: 15_000 });

    await gotoRoute(
      page,
      `/finance/payments?status=pending&search=${encodeURIComponent(
        fixture.pendingOrder.orderNumber
      )}`
    );
    await expect(
      page.getByRole('heading', { name: '收款管理' })
    ).toBeVisible();
    await expect(page.getByText(pendingPayment.paymentNumber).last()).toBeVisible();

    const confirmRequestPromise = page.waitForResponse(
      response =>
        response.url().includes(
          `/api/payments/${encodeURIComponent(pendingPayment.id)}/confirm`
        ) &&
        response.request().method() === 'POST'
    );

    await page.locator('button:has-text("确认到账"):visible').first().click();
    await expect(
      page.getByRole('heading', { name: '确认这笔收款已经到账？' })
    ).toBeVisible();
    await page.getByRole('button', { name: '确认收款到账' }).click();

    const confirmResponse = await confirmRequestPromise;
    expect(confirmResponse.ok()).toBeTruthy();

    const confirmedPayment = await waitForPaymentRecord(
      fixture.pendingOrder.id,
      'confirmed'
    );
    expect(confirmedPayment.id).toBe(pendingPayment.id);

    await expect(page.getByText('暂无收款').first()).toBeVisible({
      timeout: 15_000,
    });

    await gotoRoute(page, `/finance/receivables/${fixture.pendingOrder.id}`);
    await expect(page.getByText('已收款').first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('详情页应支持直接登记并确认到账，并立即刷新应收状态', async ({
    page,
  }) => {
    if (!fixture.directOrder) {
      throw new Error('直接到账测试夹具未准备完成');
    }

    await loginAsAdmin(page);

    await gotoRoute(page, `/finance/receivables/${fixture.directOrder.id}`);
    await expect(page.getByText(fixture.directOrder.orderNumber).first()).toBeVisible();

    await page.locator('button:has-text("登记收款"):visible').first().click();

    const dialog = page.getByRole('dialog', { name: '登记收款' });
    await expect(dialog).toBeVisible();

    const createResponsePromise = page.waitForResponse(
      response =>
        response.url().endsWith('/api/payments') &&
        response.request().method() === 'POST'
    );

    const confirmSubmitButton = dialog.getByRole('button', {
      name: '登记并确认到账',
    });
    await confirmSubmitButton.scrollIntoViewIfNeeded();
    await confirmSubmitButton.evaluate((button: HTMLButtonElement) => {
      button.click();
    });
    const createResponse = await createResponsePromise;
    expect(createResponse.ok()).toBeTruthy();

    const confirmedPayment = await waitForPaymentRecord(
      fixture.directOrder.id,
      'confirmed'
    );
    expect(confirmedPayment.status).toBe('confirmed');

    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await expect(page.getByText('收款已确认到账').first()).toBeVisible();
    await expect(page.getByText('已收款').first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole('button', { name: '登记收款' })
    ).toHaveCount(0, { timeout: 15_000 });
  });
});
