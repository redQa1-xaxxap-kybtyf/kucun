import { expect, test, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123456';

type StatementCandidate = {
  id: string;
  keyword: string;
  name: string;
  type: 'customer' | 'supplier' | 'partner';
};

type ExpenseCandidate = {
  id: string;
  expenseNumber: string;
  expenseName: string;
  expenseType: string;
};

type PaymentCandidate = {
  id: string;
  paymentNumber: string;
  status: 'pending' | 'confirmed' | 'applied' | 'cancelled';
};

type PaymentOutCandidate = {
  id: string;
  paymentNumber: string;
  status: 'pending' | 'confirmed' | 'cancelled';
};

type RefundCandidate = {
  id: string;
  refundNumber: string;
  status: 'pending' | 'processing' | 'completed' | 'rejected' | 'cancelled';
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
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

async function resolveCaptchaSrc(page: Page): Promise<string> {
  const captchaImage = page.getByAltText('验证码');

  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (await captchaImage.isVisible().catch(() => false)) {
      const captchaSrc = await captchaImage.getAttribute('src');
      if (captchaSrc) {
        return captchaSrc;
      }
    }

    await page.waitForTimeout(1_000);

    if (attempt === 2 || attempt === 4) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(
        page.getByText('库存管理系统', { exact: true })
      ).toBeVisible();
    }
  }

  throw new Error('登录页验证码图片未加载完成');
}

async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE_URL}/auth/signin`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('库存管理系统', { exact: true })).toBeVisible();

  const captchaSrc = await resolveCaptchaSrc(page);

  await page.getByLabel('用户名').fill(ADMIN_USERNAME);
  await page.getByLabel('密码').fill(ADMIN_PASSWORD);
  await page.getByLabel('验证码').fill(parseCaptchaText(captchaSrc));
  await page.getByRole('button', { name: '登录' }).click();

  await page.waitForURL(`${BASE_URL}/dashboard`, {
    timeout: 20_000,
  });
}

async function fetchAuthedJson(page: Page, path: string) {
  const response = await page.context().request.get(`${BASE_URL}${path}`);
  expect(
    response.ok(),
    `请求失败: ${path} -> ${response.status()} ${response.statusText()}`
  ).toBeTruthy();
  return response.json();
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

async function expectQueryParam(
  page: Page,
  key: string,
  value: string | null,
  message: string
) {
  await expect
    .poll(() => new URL(page.url()).searchParams.get(key), {
      timeout: 10_000,
      message,
    })
    .toBe(value);
}

async function getStatementsCandidate(
  page: Page
): Promise<StatementCandidate | null> {
  const payload = await fetchAuthedJson(page, '/api/finance/statements?limit=50');
  const statements = asRecordArray(
    isRecord(payload) && isRecord(payload.data) ? payload.data.statements : null
  );

  for (const item of statements) {
    const id = typeof item.id === 'string' ? item.id : '';
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    const type = item.type;

    if (
      id &&
      name &&
      (type === 'customer' || type === 'supplier' || type === 'partner')
    ) {
      return {
        id,
        keyword: name,
        name,
        type,
      };
    }
  }

  return null;
}

async function getExpenseCandidate(page: Page): Promise<ExpenseCandidate | null> {
  const payload = await fetchAuthedJson(
    page,
    '/api/finance/expenses?page=1&pageSize=20'
  );
  const records = asRecordArray(
    isRecord(payload) && isRecord(payload.data) ? payload.data.records : null
  );

  for (const item of records) {
    const id = typeof item.id === 'string' ? item.id : '';
    const expenseNumber =
      typeof item.expenseNumber === 'string' ? item.expenseNumber.trim() : '';
    const expenseName =
      typeof item.expenseName === 'string' ? item.expenseName.trim() : '';
    const expenseType =
      typeof item.expenseType === 'string' ? item.expenseType.trim() : '';

    if (id && expenseNumber && expenseName && expenseType) {
      return {
        id,
        expenseNumber,
        expenseName,
        expenseType,
      };
    }
  }

  return null;
}

async function getPaymentCandidate(page: Page): Promise<PaymentCandidate | null> {
  const payload = await fetchAuthedJson(page, '/api/payments?limit=50');
  const payments = asRecordArray(
    isRecord(payload) && isRecord(payload.data) ? payload.data.payments : null
  );

  for (const item of payments) {
    const id = typeof item.id === 'string' ? item.id : '';
    const paymentNumber =
      typeof item.paymentNumber === 'string' ? item.paymentNumber.trim() : '';
    const status = item.status;
    const actualPaymentAmount =
      typeof item.actualPaymentAmount === 'number'
        ? item.actualPaymentAmount
        : Number(item.actualPaymentAmount ?? 0);
    const salesOrderVisible =
      isRecord(item.salesOrder) && typeof item.salesOrder.id === 'string';

    if (
      id &&
      paymentNumber &&
      actualPaymentAmount > 0 &&
      salesOrderVisible &&
      (status === 'pending' ||
        status === 'confirmed' ||
        status === 'applied' ||
        status === 'cancelled')
    ) {
      return {
        id,
        paymentNumber,
        status,
      };
    }
  }

  return null;
}

async function getPaymentOutCandidate(
  page: Page
): Promise<PaymentOutCandidate | null> {
  const payload = await fetchAuthedJson(page, '/api/finance/payments-out?limit=50');
  const payments = asRecordArray(
    isRecord(payload) && isRecord(payload.data) ? payload.data.data : null
  );

  for (const item of payments) {
    const id = typeof item.id === 'string' ? item.id : '';
    const paymentNumber =
      typeof item.paymentNumber === 'string' ? item.paymentNumber.trim() : '';
    const status = item.status;

    if (
      id &&
      paymentNumber &&
      (status === 'pending' || status === 'confirmed' || status === 'cancelled')
    ) {
      return {
        id,
        paymentNumber,
        status,
      };
    }
  }

  return null;
}

async function getRefundCandidate(page: Page): Promise<RefundCandidate | null> {
  const payload = await fetchAuthedJson(page, '/api/finance/refunds?limit=50');
  const refunds = asRecordArray(
    isRecord(payload) && isRecord(payload.data) ? payload.data.refunds : null
  );

  for (const item of refunds) {
    const id = typeof item.id === 'string' ? item.id : '';
    const refundNumber =
      typeof item.refundNumber === 'string' ? item.refundNumber.trim() : '';
    const status = item.status;

    if (
      id &&
      refundNumber &&
      (status === 'pending' ||
        status === 'processing' ||
        status === 'completed' ||
        status === 'rejected' ||
        status === 'cancelled')
    ) {
      return {
        id,
        refundNumber,
        status,
      };
    }
  }

  return null;
}

test.describe('财务页面实际操作级回归', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('财务首页入口应能直达对账与费用页面', async ({ page }) => {
    await gotoRoute(page, '/finance');

    await expect(
      page.getByRole('heading', { name: '财务中心' })
    ).toBeVisible();
    await expect(page.getByText('今日优先处理')).toBeVisible();
    await expect(page.getByText('常用记录')).toBeVisible();
    await expect(page.getByText('对账与报表')).toBeVisible();

    await page.getByRole('link', { name: /往来对账/ }).click();
    await expect(page).toHaveURL(/\/finance\/statements/);
    await expect(
      page.getByRole('heading', { name: '往来对账' })
    ).toBeVisible();

    await gotoRoute(page, '/finance');
    await page.getByRole('link', { name: /费用管理/ }).click();
    await expect(page).toHaveURL(/\/finance\/expenses/);
    await expect(
      page.getByRole('heading', { name: '费用管理' })
    ).toBeVisible();
  });

  test('往来对账应支持搜索、对象筛选和进入详情', async ({ page }) => {
    const candidate = await getStatementsCandidate(page);

    await gotoRoute(page, '/finance/statements');
    await expect(
      page.getByRole('heading', { name: '往来对账' })
    ).toBeVisible();

    const searchInput = page.getByRole('searchbox', {
      name: '搜索客户、供应商、联系人或编号',
    });
    await expect(searchInput).toBeVisible();
    await expect(page.getByLabel('对象')).toBeVisible();

    if (!candidate) {
      await page.getByLabel('对象').selectOption('customer');
      await expectQueryParam(
        page,
        'type',
        'customer',
        '往来对账对象筛选未同步到 URL'
      );
      await expect(page.getByText('暂无往来对账记录')).toBeVisible();
      return;
    }

    await searchInput.fill(candidate.keyword);
    await expectQueryParam(
      page,
      'search',
      candidate.keyword,
      '往来对账搜索词未同步到 URL'
    );
    await expect(page.getByText(candidate.name).first()).toBeVisible();

    await page.getByLabel('对象').selectOption(candidate.type);
    await expectQueryParam(
      page,
      'type',
      candidate.type,
      '往来对账对象筛选未同步到 URL'
    );

    await page.locator(`a[href="/finance/statements/${candidate.id}"]`).click();
    await expect(page).toHaveURL(
      new RegExp(`/finance/statements/${candidate.id}(\\?|$)`)
    );
    await expect(page.getByText(candidate.name).first()).toBeVisible();
  });

  test('费用页应支持筛选并能进入新建和详情', async ({ page }) => {
    const candidate = await getExpenseCandidate(page);

    await gotoRoute(page, '/finance/expenses');
    await expect(
      page.getByRole('heading', { name: '费用管理' })
    ).toBeVisible();
    await expect(page.getByLabel('费用类型')).toBeVisible();
    await expect(
      page.getByText('只有“已审核入账”的费用会进入月报、年报和利润分析。')
    ).toBeVisible();

    if (candidate) {
      await page.getByLabel('费用类型').selectOption(candidate.expenseType);
      await expectQueryParam(
        page,
        'expenseType',
        candidate.expenseType,
        '费用类型筛选未同步到 URL'
      );
      await expect(page.getByText(candidate.expenseNumber).first()).toBeVisible();

      const row = page
        .locator('table tbody tr')
        .filter({ hasText: candidate.expenseNumber })
        .first();
      await expect(row).toBeVisible();
      await row.hover();
      await row.locator(`a[href="/finance/expenses/${candidate.id}"]`).click();
      await expect(page).toHaveURL(
        new RegExp(`/finance/expenses/${candidate.id}(\\?|$)`)
      );
      await expect(page.getByText(candidate.expenseNumber).first()).toBeVisible();
      await gotoRoute(page, '/finance/expenses');
    } else {
      await expect(page.getByText('暂无费用记录')).toBeVisible();
    }

    await page.getByRole('link', { name: '登记费用' }).click();
    await expect(page).toHaveURL(/\/finance\/expenses\/create/);
    await expect(
      page.getByRole('heading', { name: '登记费用' })
    ).toBeVisible();
  });

  test('月报页应支持切换月份并刷新报表', async ({ page }) => {
    await gotoRoute(page, '/finance/reports/monthly');
    await expect(
      page.getByRole('heading', { name: '月度报表' })
    ).toBeVisible({ timeout: 20_000 });

    const yearSelect = page.getByLabel('年份');
    const monthSelect = page.getByLabel('月份');
    const refreshButton = page.getByRole('button', { name: '刷新报表' });

    await expect(yearSelect).toBeVisible();
    await expect(monthSelect).toBeVisible();
    await expect(refreshButton).toBeVisible();
    await expect(page.getByText('本月净利润')).toBeVisible({ timeout: 20_000 });

    await monthSelect.selectOption({ label: '1月' });
    await refreshButton.click();

    await expect(page.getByText('报表已刷新', { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('本月净利润')).toBeVisible();
  });

  test('已收款记录应支持搜索、状态筛选、清空和进入新建页', async ({ page }) => {
    const candidate = await getPaymentCandidate(page);

    await gotoRoute(page, '/finance/payments');
    await expect(
      page.getByRole('heading', { name: '已收款记录' })
    ).toBeVisible();

    const searchInput = page.getByPlaceholder('搜索收款单号、客户名称或销售单号');
    await expect(searchInput).toBeVisible();
    await expect(page.getByLabel('状态')).toBeVisible();

    if (!candidate) {
      await expect(page.getByText('暂无收款记录')).toBeVisible();
      await page.getByRole('link', { name: '新建收款' }).click();
      await expect(page).toHaveURL(/\/finance\/payments\/create/);
      return;
    }

    await searchInput.fill(candidate.paymentNumber);
    await expectQueryParam(
      page,
      'search',
      candidate.paymentNumber,
      '收款搜索词未同步到 URL'
    );
    await expect(page.getByText(candidate.paymentNumber).first()).toBeVisible();

    await page.getByLabel('状态').selectOption(candidate.status);
    await expectQueryParam(
      page,
      'status',
      candidate.status,
      '收款状态筛选未同步到 URL'
    );
    await page.getByRole('button', { name: '清空搜索' }).click();
    await expectQueryParam(
      page,
      'search',
      null,
      '收款清空搜索后 URL 仍保留搜索词'
    );

    await page.getByRole('link', { name: '新建收款' }).click();
    await expect(page).toHaveURL(/\/finance\/payments\/create/);
  });

  test('已付款记录应支持搜索、状态筛选、清空和进入新建页', async ({ page }) => {
    const candidate = await getPaymentOutCandidate(page);

    await gotoRoute(page, '/finance/payments-out');
    await expect(
      page.getByRole('heading', { name: '已付款记录' })
    ).toBeVisible();

    const searchInput = page.getByPlaceholder('搜索付款单号、供应商名称或联系人');
    await expect(searchInput).toBeVisible();
    await expect(page.getByLabel('状态')).toBeVisible();

    if (!candidate) {
      await expect(page.getByText('暂无付款记录')).toBeVisible();
      await page.getByRole('link', { name: '新建付款' }).click();
      await expect(page).toHaveURL(/\/finance\/payments-out\/create/);
      return;
    }

    await searchInput.fill(candidate.paymentNumber);
    await expectQueryParam(
      page,
      'search',
      candidate.paymentNumber,
      '付款搜索词未同步到 URL'
    );
    await expect(page.getByText(candidate.paymentNumber).first()).toBeVisible();

    await page.getByLabel('状态').selectOption(candidate.status);
    await expectQueryParam(
      page,
      'status',
      candidate.status,
      '付款状态筛选未同步到 URL'
    );
    await page.getByRole('button', { name: '清空搜索' }).click();
    await expectQueryParam(
      page,
      'search',
      null,
      '付款清空搜索后 URL 仍保留搜索词'
    );

    await page.getByRole('link', { name: '新建付款' }).click();
    await expect(page).toHaveURL(/\/finance\/payments-out\/create/);
  });

  test('退款处理应支持搜索、状态筛选、清空和进入退货页', async ({ page }) => {
    const candidate = await getRefundCandidate(page);

    await gotoRoute(page, '/finance/refunds');
    await expect(
      page.getByRole('heading', { name: '退款处理' })
    ).toBeVisible();

    const searchInput = page.getByPlaceholder('搜索退款单号、退货单号或客户名称');
    await expect(searchInput).toBeVisible();
    await expect(page.getByLabel('状态')).toBeVisible();

    if (!candidate) {
      await expect(page.getByText('暂无退款记录')).toBeVisible();
      await page.getByRole('link', { name: '新建退货订单' }).click();
      await expect(page).toHaveURL(/\/return-orders\/create/);
      return;
    }

    await searchInput.fill(candidate.refundNumber);
    await expectQueryParam(
      page,
      'search',
      candidate.refundNumber,
      '退款搜索词未同步到 URL'
    );
    await expect(page.getByText(candidate.refundNumber).first()).toBeVisible();

    await page.getByLabel('状态').selectOption(candidate.status);
    await expectQueryParam(
      page,
      'status',
      candidate.status,
      '退款状态筛选未同步到 URL'
    );
    await page.getByRole('button', { name: '清空搜索' }).click();
    await expectQueryParam(
      page,
      'search',
      null,
      '退款清空搜索后 URL 仍保留搜索词'
    );

    await page.getByRole('link', { name: '新建退货订单' }).click();
    await expect(page).toHaveURL(/\/return-orders\/create/);
  });
});
