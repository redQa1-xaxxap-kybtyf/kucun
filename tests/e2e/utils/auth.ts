import { expect, type Page } from '@playwright/test';

interface LoginOptions {
  password: string;
  username: string;
}

function parseCaptchaText(captchaDataUri: string): string {
  const encodedSvg = captchaDataUri.replace(/^data:image\/svg\+xml;utf8,/, '');
  const svg = decodeURIComponent(encodedSvg);
  const matches = [...svg.matchAll(/>\s*([A-Z0-9])\s*<\/text>/g)];
  const captcha = matches.map(match => match[1]).join('');

  if (!captcha || captcha.length < 4) {
    throw new Error('未能从验证码图片中解析出文本');
  }

  return captcha;
}

async function fetchJsonWithRetry(
  page: Page,
  url: string,
  {
    attempts = 5,
    delayMs = 800,
  }: {
    attempts?: number;
    delayMs?: number;
  } = {}
) {
  const request = page.context().request;
  let lastStatus: number | null = null;
  let lastBody = '';

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await request.get(url);

    if (response.ok()) {
      return response.json();
    }

    lastStatus = response.status();
    lastBody = await response.text().catch(() => '');

    if (attempt < attempts - 1) {
      await page.waitForTimeout(delayMs);
    }
  }

  throw new Error(
    `请求失败: ${url} -> HTTP ${lastStatus ?? 'UNKNOWN'} ${lastBody}`.trim()
  );
}

export async function loginAsAdminViaApi(
  page: Page,
  baseUrl: string,
  { username, password }: LoginOptions
) {
  const request = page.context().request;

  const csrfPayload = (await fetchJsonWithRetry(
    page,
    `${baseUrl}/api/auth/csrf`
  )) as {
    csrfToken?: string;
  };

  if (!csrfPayload.csrfToken) {
    throw new Error('未获取到 NextAuth CSRF Token');
  }

  const captchaPayload = (await fetchJsonWithRetry(
    page,
    `${baseUrl}/api/captcha`
  )) as {
    captchaImage?: string;
    sessionId?: string;
  };

  if (!captchaPayload.captchaImage || !captchaPayload.sessionId) {
    throw new Error('未获取到验证码会话信息');
  }

  const signInResponse = await request.post(
    `${baseUrl}/api/auth/callback/credentials`,
    {
      form: {
        callbackUrl: `${baseUrl}/dashboard`,
        captcha: parseCaptchaText(captchaPayload.captchaImage),
        captchaSessionId: captchaPayload.sessionId,
        csrfToken: csrfPayload.csrfToken,
        json: 'true',
        password,
        username,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  expect(signInResponse.ok()).toBeTruthy();

  const signInPayload = (await signInResponse.json().catch(() => null)) as
    | {
        error?: string;
        ok?: boolean;
        status?: number;
        url?: string;
      }
    | null;

  if (signInPayload?.error) {
    throw new Error(`API 登录失败: ${signInPayload.error}`);
  }

  await page.goto(`${baseUrl}/dashboard`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page).toHaveURL(/\/dashboard$/);
}
