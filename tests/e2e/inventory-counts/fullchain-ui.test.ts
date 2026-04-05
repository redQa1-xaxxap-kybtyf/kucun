/* eslint-disable max-lines-per-function */

import { loadEnvConfig } from '@next/env';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

loadEnvConfig(process.cwd());

const prisma = new PrismaClient();

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123456';

interface CountFixture {
  actualQuantity: number;
  batchNumber: string;
  countLocation: string;
  countName: string;
  initialQuantity: number;
  productCode: string;
  productId: string;
  runId: string;
}

function parseCaptchaText(captchaDataUri: string): string {
  const encodedSvg = captchaDataUri.replace(/^data:image\/svg\+xml;utf8,/, '');
  const svg = decodeURIComponent(encodedSvg);
  const matches = [...svg.matchAll(/>\s*([A-Z0-9])\s*<\/text>/g)];
  const captcha = matches.map(match => match[1]).join('');

  if (!captcha || captcha.length < 4) {
    throw new Error('未能从登录页验证码图片中解析出验证码文本');
  }

  return captcha;
}

async function loginAsAdmin(
  page: Page,
  destinationPath = '/dashboard'
) {
  const captchaResponse = await page.request.get(`${BASE_URL}/api/captcha`);
  expect(captchaResponse.ok()).toBeTruthy();
  const captchaBody = (await captchaResponse.json()) as {
    captchaImage: string;
    sessionId: string;
    success: boolean;
  };

  expect(captchaBody.success).toBeTruthy();

  const csrfResponse = await page.request.get(`${BASE_URL}/api/auth/csrf`);
  expect(csrfResponse.ok()).toBeTruthy();
  const csrfBody = (await csrfResponse.json()) as {
    csrfToken: string;
  };

  const loginResponse = await page.request.post(
    `${BASE_URL}/api/auth/callback/credentials`,
    {
      form: {
        csrfToken: csrfBody.csrfToken,
        username: ADMIN_USERNAME,
        password: ADMIN_PASSWORD,
        captcha: parseCaptchaText(captchaBody.captchaImage),
        captchaSessionId: captchaBody.sessionId,
        rememberMe: 'false',
        callbackUrl: `${BASE_URL}/dashboard`,
        json: 'true',
      },
    }
  );

  expect(loginResponse.ok()).toBeTruthy();

  const destinationUrl = `${BASE_URL}${destinationPath}`;
  await page.goto(destinationUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(destinationUrl, { timeout: 20_000 });
  await expect(page).toHaveURL(new RegExp(`${destinationPath.replace(/\//g, '\\/')}$`));
}

async function waitForRecord<T>(
  loader: () => Promise<T | null>,
  predicate: (value: T) => boolean,
  description: string,
  timeoutMs = 20_000
): Promise<T> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const value = await loader();
    if (value && predicate(value)) {
      return value;
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  throw new Error(`等待 ${description} 超时`);
}

async function ensurePageReady(page: Page, readyLocator: Locator) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (await readyLocator.isVisible().catch(() => false)) {
      return;
    }

    const retryButton = page.getByRole('button', { name: '重试' });
    if (await retryButton.isVisible().catch(() => false)) {
      await retryButton.click();
    } else {
      await page.reload({ waitUntil: 'domcontentloaded' });
    }

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);
  }

  await expect(readyLocator).toBeVisible({ timeout: 20_000 });
}

async function createCountFixture(): Promise<CountFixture> {
  const runId = `COUNT${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`.toUpperCase();
  const productCode = `E2E-COUNT-${runId}`;
  const batchNumber = `E2E-BATCH-${runId}`;
  const countLocation = `E2E-LOC-${runId}`;
  const countName = `E2E盘点-${runId}`;
  const initialQuantity = 30;
  const actualQuantity = 24;

  const product = await prisma.product.create({
    data: {
      code: productCode,
      name: `E2E盘点砖-${runId}`,
      specification: '800x800',
      unit: 'sheet',
      piecesPerUnit: 4,
      status: 'active',
    },
  });

  await prisma.inventory.create({
    data: {
      productId: product.id,
      batchNumber,
      quantity: initialQuantity,
      reservedQuantity: 0,
      unitCost: 18.125,
      location: countLocation,
    },
  });

  return {
    actualQuantity,
    batchNumber,
    countLocation,
    countName,
    initialQuantity,
    productCode,
    productId: product.id,
    runId,
  };
}

async function cleanupCountFixture(fixture: CountFixture, countId?: string) {
  await prisma.inventoryCostQueue.deleteMany({
    where: {
      productId: fixture.productId,
      batchNumber: fixture.batchNumber,
    },
  });
  await prisma.inventoryAdjustment.deleteMany({
    where: {
      productId: fixture.productId,
      batchNumber: fixture.batchNumber,
    },
  });
  await prisma.inboundRecord.deleteMany({
    where: {
      productId: fixture.productId,
      batchNumber: fixture.batchNumber,
    },
  });
  if (countId) {
    await prisma.inventoryCount.deleteMany({
      where: { id: countId },
    });
  }
  await prisma.inventory.deleteMany({
    where: {
      productId: fixture.productId,
      batchNumber: fixture.batchNumber,
    },
  });
  await prisma.product.deleteMany({
    where: {
      id: fixture.productId,
    },
  });
}

test.describe('库存盘点页面级全链路回归', () => {
  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('应通过 UI 跑通创建盘点、生成明细、录入差异并完成盘点', async ({
    page,
  }) => {
    test.setTimeout(240_000);

    const fixture = await createCountFixture();
    let countId = '';

    try {
      await loginAsAdmin(page, '/inventory/counts/new');

      await test.step('创建盘点计划并仅锁定本次测试库位', async () => {
        await page.goto(`${BASE_URL}/inventory/counts/new`, {
          waitUntil: 'domcontentloaded',
        });
        await ensurePageReady(
          page,
          page.getByRole('heading', { name: '创建盘点计划' })
        );

        await page.getByLabel('盘点名称 *').fill(fixture.countName);
        await page.getByLabel('盘点位置').fill(fixture.countLocation);
        await page.getByRole('button', { name: '提交' }).click();

        await page.waitForURL(
          url => {
            const pathname = new URL(url).pathname;
            return (
              /^\/inventory\/counts\/[^/]+$/.test(pathname) &&
              !pathname.endsWith('/new')
            );
          },
          {
            timeout: 20_000,
          }
        );

        countId = new URL(page.url()).pathname.split('/').pop() || '';
        expect(countId).not.toBe('');
      });

      await test.step('整仓生成明细并开始盘点', async () => {
        await ensurePageReady(
          page,
          page.getByRole('button', { name: '整仓生成明细' })
        );

        await page.getByRole('button', { name: '整仓生成明细' }).click();
        await expect(
          page.getByText(fixture.productCode, { exact: false }).first()
        ).toBeVisible({
          timeout: 20_000,
        });

        await page.getByRole('button', { name: '开始盘点' }).click();
        await page.waitForURL(
          url =>
            new URL(url).pathname === `/inventory/counts/${countId}/execute`,
          {
            timeout: 20_000,
          }
        );
      });

      await test.step('录入实际数量、保存并完成盘点', async () => {
        const itemRow = page
          .locator('tbody tr')
          .filter({ hasText: fixture.productCode })
          .first();
        await expect(itemRow).toBeVisible({ timeout: 20_000 });

        const actualQuantityInput = itemRow.locator('input[type="number"]');
        await actualQuantityInput.fill(String(fixture.actualQuantity));
        await actualQuantityInput.blur();

        await page.getByRole('button', { name: '保存数据' }).click();

        await waitForRecord(
          () =>
            prisma.inventoryCountItem.findFirst({
              where: {
                countId,
                productId: fixture.productId,
                batchNumber: fixture.batchNumber,
              },
              select: {
                actualQuantity: true,
                difference: true,
                status: true,
              },
            }),
          value =>
            value.actualQuantity === fixture.actualQuantity &&
            value.difference === fixture.actualQuantity - fixture.initialQuantity &&
            value.status === 'counted',
          '盘点明细已保存'
        );

        await page.getByRole('button', { name: '完成盘点' }).click();
        await page.waitForURL(
          url => new URL(url).pathname === `/inventory/counts/${countId}`,
          {
            timeout: 20_000,
          }
        );
      });

      await test.step('校验库存、盘点单、调整单与 FIFO 队列已同步', async () => {
        const countRecord = await waitForRecord(
          () =>
            prisma.inventoryCount.findUnique({
              where: { id: countId },
              select: {
                status: true,
                completedItems: true,
                differenceItems: true,
                totalDifference: true,
              },
            }),
          value =>
            value.status === 'completed' &&
            value.completedItems === 1 &&
            value.differenceItems === 1 &&
            value.totalDifference === 6,
          '盘点计划完成'
        );

        expect(countRecord.status).toBe('completed');

        const inventoryRecord = await waitForRecord(
          () =>
            prisma.inventory.findFirst({
              where: {
                productId: fixture.productId,
                batchNumber: fixture.batchNumber,
              },
              select: {
                quantity: true,
              },
            }),
          value => value.quantity === fixture.actualQuantity,
          '盘点后库存数量更新'
        );

        expect(inventoryRecord.quantity).toBe(fixture.actualQuantity);

        const adjustmentRecord = await waitForRecord(
          () =>
            prisma.inventoryAdjustment.findFirst({
              where: {
                productId: fixture.productId,
                batchNumber: fixture.batchNumber,
              },
              orderBy: {
                createdAt: 'desc',
              },
              select: {
                reason: true,
                beforeQuantity: true,
                adjustQuantity: true,
                afterQuantity: true,
                status: true,
              },
            }),
          value =>
            value.reason === 'deficit' &&
            value.beforeQuantity === fixture.initialQuantity &&
            value.adjustQuantity === fixture.actualQuantity - fixture.initialQuantity &&
            value.afterQuantity === fixture.actualQuantity &&
            value.status === 'approved',
          '盘点调整单生成'
        );

        expect(adjustmentRecord.adjustQuantity).toBe(-6);

        const fifoQueueRecord = await waitForRecord(
          () =>
            prisma.inventoryCostQueue.findFirst({
              where: {
                productId: fixture.productId,
                batchNumber: fixture.batchNumber,
              },
              select: {
                remainingQty: true,
              },
            }),
          value => value.remainingQty === fixture.actualQuantity,
          'FIFO 队列剩余数量同步'
        );

        expect(fifoQueueRecord.remainingQty).toBe(fixture.actualQuantity);
      });
    } finally {
      await cleanupCountFixture(fixture, countId || undefined);
    }
  });
});
