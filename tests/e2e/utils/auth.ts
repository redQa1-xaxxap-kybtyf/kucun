import { expect, type Page } from '@playwright/test';

interface LoginOptions {
  destinationPath?: string;
  password: string;
  username: string;
}

const AUTH_RATE_LIMIT_PATTERNS = [
  'login:attempts:*',
  'rate_limit:auth*',
  'rate_limit:captcha*',
] as const;

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

export async function clearAuthRateLimits() {
  if (process.env.E2E_SKIP_AUTH_RATE_LIMIT_RESET === '1') {
    return;
  }

  let client:
    | {
        del: (...keys: string[]) => Promise<unknown>;
        disconnect: () => void;
        keys: (pattern: string) => Promise<string[]>;
      }
    | undefined;

  try {
    const { default: Redis } = await import('ioredis');
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

    client = new Redis(redisUrl, {
      commandTimeout: 1_000,
      connectTimeout: 1_000,
      maxRetriesPerRequest: 1,
    });

    const keys = new Set<string>();
    for (const pattern of AUTH_RATE_LIMIT_PATTERNS) {
      const matchedKeys = await client.keys(pattern);
      matchedKeys.forEach(key => keys.add(key));
    }

    if (keys.size > 0) {
      await client.del(...keys);
    }
  } catch {
    // E2E 登录仍应在无 Redis 或本地 Redis 不可达时尝试执行。
  } finally {
    client?.disconnect();
  }
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
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await request.get(url);

      if (response.ok()) {
        return response.json();
      }

      lastStatus = response.status();
      lastBody = await response.text().catch(() => '');
      lastError = undefined;
    } catch (error) {
      lastError = error;
    }

    if (attempt < attempts - 1) {
      await page.waitForTimeout(delayMs);
    }
  }

  const errorMessage =
    lastError instanceof Error ? `; ${lastError.message}` : '';
  throw new Error(
    `请求失败: ${url} -> HTTP ${lastStatus ?? 'UNKNOWN'} ${lastBody}${errorMessage}`.trim()
  );
}

export async function loginAsAdminViaApi(
  page: Page,
  baseUrl: string,
  { username, password, destinationPath = '/dashboard' }: LoginOptions
) {
  await clearAuthRateLimits();

  const request = page.context().request;
  const destinationUrl = `${baseUrl}${destinationPath}`;

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
        callbackUrl: destinationUrl,
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

  await page.goto(destinationUrl, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page).toHaveURL(
    new RegExp(`${destinationPath.replace(/\//g, '\\/')}$`)
  );
}
