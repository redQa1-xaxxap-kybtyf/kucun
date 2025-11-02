/**
 * Cookie 加密/解密工具
 * SOLID-S: 单一职责 - 只负责 Cookie 的加密和解密
 *
 * 安全特性:
 * - 使用 AES-256-GCM 加密算法
 * - 每次加密使用随机 IV
 * - 使用认证标签防止篡改
 * - 密钥存储在环境变量中
 */

import crypto from 'crypto';

/**
 * 加密配置
 */
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // AES-GCM 使用 16 字节 IV

/**
 * 获取加密密钥
 * 从环境变量读取，如果不存在则抛出错误
 */
function getEncryptionKey(): Buffer {
  const key = process.env.COOKIE_ENCRYPTION_KEY;

  if (!key) {
    throw new Error(
      'COOKIE_ENCRYPTION_KEY 环境变量未设置。请在 .env.local 中添加 32 字节的十六进制密钥。'
    );
  }

  // 验证密钥长度（AES-256 需要 32 字节 = 64 个十六进制字符）
  if (key.length !== 64) {
    throw new Error(
      `COOKIE_ENCRYPTION_KEY 长度错误。期望 64 个十六进制字符（32 字节），实际 ${key.length} 个字符。`
    );
  }

  return Buffer.from(key, 'hex');
}

/**
 * 生成随机加密密钥
 * 用于初始化环境变量
 *
 * @returns 32 字节的十六进制密钥字符串
 *
 * @example
 * const key = generateEncryptionKey();
 * console.log(`COOKIE_ENCRYPTION_KEY=${key}`);
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * 加密 Cookie 数据
 *
 * @param cookies - Cookie 数组的 JSON 字符串
 * @returns 加密后的数据（包含 IV、密文和认证标签）
 *
 * @example
 * const cookies = JSON.stringify([
 *   { name: 'session', value: 'abc123', domain: '.example.com' }
 * ]);
 * const encrypted = encryptCookies(cookies);
 */
export function encryptCookies(cookies: string): string {
  try {
    const key = getEncryptionKey();

    // 生成随机 IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // 创建加密器
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // 加密数据
    let encrypted = cipher.update(cookies, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // 获取认证标签
    const authTag = cipher.getAuthTag();

    // 返回包含 IV、密文和认证标签的 JSON
    return JSON.stringify({
      iv: iv.toString('hex'),
      encrypted,
      authTag: authTag.toString('hex'),
    });
  } catch (error) {
    throw new Error(
      `Cookie 加密失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 解密 Cookie 数据
 *
 * @param encryptedData - 加密后的数据（JSON 字符串）
 * @returns 解密后的 Cookie 数组 JSON 字符串
 *
 * @example
 * const decrypted = decryptCookies(encrypted);
 * const cookies = JSON.parse(decrypted);
 */
export function decryptCookies(encryptedData: string): string {
  try {
    const key = getEncryptionKey();

    // 解析加密数据
    const { iv, encrypted, authTag } = JSON.parse(encryptedData);

    // 验证数据完整性
    if (!iv || !encrypted || !authTag) {
      throw new Error('加密数据格式错误：缺少必要字段');
    }

    // 创建解密器
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(iv, 'hex')
    );

    // 设置认证标签
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    // 解密数据
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    throw new Error(
      `Cookie 解密失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 验证 Cookie 是否过期
 *
 * @param updatedAt - Cookie 更新时间
 * @param expiryDays - 过期天数（默认 30 天）
 * @returns 是否过期
 *
 * @example
 * const isExpired = isCookieExpired(site.cookiesUpdatedAt, 30);
 * if (isExpired) {
 *   throw new Error('Cookie 已过期，请重新登录');
 * }
 */
export function isCookieExpired(
  updatedAt: Date | null | undefined,
  expiryDays: number = 30
): boolean {
  if (!updatedAt) {
    return true;
  }

  const now = Date.now();
  const updatedTime = updatedAt.getTime();
  const expiryMs = expiryDays * 24 * 60 * 60 * 1000;

  return now - updatedTime > expiryMs;
}

/**
 * 格式化 Cookie 为 Puppeteer 可用的格式
 *
 * @param cookiesJson - Cookie 数组的 JSON 字符串
 * @returns Puppeteer Cookie 数组
 *
 * @example
 * const cookies = formatCookiesForPuppeteer(decryptedCookies);
 * await page.setCookie(...cookies);
 */
export function formatCookiesForPuppeteer(cookiesJson: string): Array<{
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}> {
  try {
    const cookies = JSON.parse(cookiesJson);

    if (!Array.isArray(cookies)) {
      throw new Error('Cookie 数据格式错误：应该是数组');
    }

    return cookies.map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path || '/',
      expires: cookie.expires,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
    }));
  } catch (error) {
    throw new Error(
      `Cookie 格式化失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
