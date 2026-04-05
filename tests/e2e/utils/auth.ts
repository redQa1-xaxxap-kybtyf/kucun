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

export async function loginAsAdminViaApi(
  page: Page,
  baseUrl: string,
  { username, password }: LoginOptions
) {
  const request = page.context().request;

  const csrfResponse = await request.get(`${baseUrl}/api/auth/csrf`);
  expect(csrfResponse.ok()).toBeTruthy();
  const csrfPayload = (await csrfResponse.json()) as {
    csrfToken?: string;
  };

  if (!csrfPayload.csrfToken) {
    throw new Error('未获取到 NextAuth CSRF Token');
  }

  const captchaResponse = await request.get(`${baseUrl}/api/captcha`);
  expect(captchaResponse.ok()).toBeTruthy();
  const captchaPayload = (await captchaResponse.json()) as {
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
