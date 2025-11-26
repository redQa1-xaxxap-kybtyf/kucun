/**
 * 验证码服务
 * 使用 Redis 存储验证码会话,支持分布式部署
 * 遵循全栈项目统一约定规范
 *
 * 优化说明:
 * - 使用随机TTL防止缓存雪崩
 * - 遵循唯一真理原则的缓存管理
 */

import crypto from 'crypto';

import { getRandomTTL } from '@/lib/cache/cache';
import { logger } from '@/lib/logger';
import { redis } from '@/lib/redis/redis-client';

// 验证码配置
export const CAPTCHA_CONFIG = {
  width: 120,
  height: 40,
  length: 4,
  fontSize: 24,
  expireMinutes: 5, // 5分钟过期
  maxAttempts: 5, // 最大尝试次数
  redisKeyPrefix: 'captcha:', // Redis 键前缀
} as const;

// 验证码会话接口
export interface CaptchaSession {
  sessionId: string;
  captchaText: string;
  clientIp: string;
  expiresAt: string; // ISO 8601 格式
  attempts: number;
  createdAt: string; // ISO 8601 格式
}

/**
 * 生成随机验证码字符串
 */
export function generateCaptchaText(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < CAPTCHA_CONFIG.length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 生成验证码会话ID (UUID v4)
 */
export function generateSessionId(): string {
  return crypto.randomUUID();
}

/**
 * 生成验证码SVG图片
 */
export function generateCaptchaSVG(text: string): string {
  const { width, height, fontSize } = CAPTCHA_CONFIG;

  // 生成随机颜色
  const colors = [
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#96CEB4',
    '#FFEAA7',
    '#DDA0DD',
    '#98D8C8',
    '#F7DC6F',
  ];

  // 生成干扰线
  let interferenceLines = '';
  for (let i = 0; i < 3; i++) {
    const x1 = Math.random() * width;
    const y1 = Math.random() * height;
    const x2 = Math.random() * width;
    const y2 = Math.random() * height;
    const color = colors[Math.floor(Math.random() * colors.length)];
    interferenceLines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1" opacity="0.3"/>`;
  }

  // 生成字符
  let textElements = '';
  const charWidth = width / text.length;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const x = charWidth * i + charWidth / 2;
    const y = height / 2 + fontSize / 3;
    const rotation = (Math.random() - 0.5) * 30; // 随机旋转 -15 到 15 度
    const color = colors[Math.floor(Math.random() * colors.length)];

    textElements += `
      <text
        x="${x}"
        y="${y}"
        font-family="Arial, sans-serif"
        font-size="${fontSize}"
        font-weight="bold"
        fill="${color}"
        text-anchor="middle"
        transform="rotate(${rotation} ${x} ${y})"
      >${char}</text>
    `;
  }

  // 生成干扰点
  let interferencePoints = '';
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const color = colors[Math.floor(Math.random() * colors.length)];
    interferencePoints += `<circle cx="${x}" cy="${y}" r="1" fill="${color}" opacity="0.5"/>`;
  }

  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f8f9fa"/>
      ${interferenceLines}
      ${interferencePoints}
      ${textElements}
    </svg>
  `;
}

/**
 * 创建验证码会话
 */
export async function createCaptchaSession(
  clientIp: string
): Promise<{ sessionId: string; captchaImage: string }> {
  const captchaText = generateCaptchaText();
  const sessionId = generateSessionId();

  logger.debug('captcha-service', 'Captcha session generated', {
    sessionId,
    isUuid:
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        sessionId
      ),
  });

  const expiresAt = new Date(
    Date.now() + CAPTCHA_CONFIG.expireMinutes * 60 * 1000
  );

  const session: CaptchaSession = {
    sessionId,
    captchaText: captchaText.toUpperCase(), // 统一转为大写存储
    clientIp,
    expiresAt: expiresAt.toISOString(),
    attempts: 0,
    createdAt: new Date().toISOString(),
  };

  // 存储到 Redis,使用随机TTL防止缓存雪崩
  const redisKey = `${CAPTCHA_CONFIG.redisKeyPrefix}${sessionId}`;
  const baseTTL = CAPTCHA_CONFIG.expireMinutes * 60;
  const randomTTL = getRandomTTL(baseTTL, 20); // 添加±20%随机抖动
  await redis.setJson(redisKey, session, randomTTL);

  // 生成验证码SVG图片
  const captchaImage = generateCaptchaSVG(captchaText);

  return { sessionId, captchaImage };
}

/**
 * 获取验证码会话
 */
export async function getCaptchaSession(
  sessionId: string
): Promise<CaptchaSession | null> {
  const redisKey = `${CAPTCHA_CONFIG.redisKeyPrefix}${sessionId}`;
  return await redis.getJson<CaptchaSession>(redisKey);
}

/**
 * 更新验证码会话
 */
export async function updateCaptchaSession(
  session: CaptchaSession
): Promise<void> {
  const redisKey = `${CAPTCHA_CONFIG.redisKeyPrefix}${session.sessionId}`;

  // 计算剩余过期时间，使用随机TTL
  const expiresAt = new Date(session.expiresAt);
  const now = new Date();
  const remainingSeconds = Math.max(
    0,
    Math.floor((expiresAt.getTime() - now.getTime()) / 1000)
  );

  if (remainingSeconds > 0) {
    // 添加随机性，防止大量验证码同时过期
    const randomTTL = getRandomTTL(remainingSeconds, 10); // 小幅抖动10%
    await redis.setJson(redisKey, session, randomTTL);
  }
}

/**
 * 删除验证码会话
 */
export async function deleteCaptchaSession(sessionId: string): Promise<void> {
  const redisKey = `${CAPTCHA_CONFIG.redisKeyPrefix}${sessionId}`;
  await redis.del(redisKey);
}

/**
 * 验证验证码
 */
export async function verifyCaptcha(
  sessionId: string,
  captcha: string,
  clientIp: string,
  deleteAfterVerify = false
): Promise<{
  success: boolean;
  error?: string;
}> {
  logger.debug('captcha-service', '开始验证验证码', undefined, {
    sessionId,
    input: captcha,
    clientIp,
  });

  // 获取会话
  const session = await getCaptchaSession(sessionId);

  if (!session) {
    logger.warn('captcha-service', '验证码会话不存在或已过期', undefined, {
      sessionId,
    });
    return {
      success: false,
      error: '验证码会话不存在或已过期',
    };
  }

  logger.debug('captcha-service', '验证码会话信息', undefined, {
    sessionId,
    expected: session.captchaText,
    attempts: session.attempts,
    expiresAt: session.expiresAt,
  });

  // 检查是否过期
  const expiresAt = new Date(session.expiresAt);
  if (new Date() > expiresAt) {
    await deleteCaptchaSession(sessionId);
    logger.warn('captcha-service', '验证码已过期', undefined, { sessionId });
    return {
      success: false,
      error: '验证码已过期',
    };
  }

  // 检查尝试次数
  if (session.attempts >= CAPTCHA_CONFIG.maxAttempts) {
    await deleteCaptchaSession(sessionId);
    logger.warn('captcha-service', '验证码尝试次数过多', undefined, {
      sessionId,
      attempts: session.attempts,
    });
    return {
      success: false,
      error: '验证码尝试次数过多',
    };
  }

  // 记录 IP 变化(不阻止登录)
  if (session.clientIp !== clientIp) {
    logger.warn('captcha-service', '验证码请求 IP 变化', undefined, {
      sessionId,
      sessionIp: session.clientIp,
      requestIp: clientIp,
    });
  }

  // 🔒 安全加固：测试绕过仅在测试环境且显式启用时生效
  // 生产和开发环境不允许绕过验证码验证
  const isTestBypass =
    process.env.NODE_ENV === 'test' &&
    process.env.TEST_CAPTCHA_BYPASS === 'true' &&
    captcha.toUpperCase() === (process.env.TEST_CAPTCHA_CODE || 'TEST1234');

  // 验证验证码
  const isValid = isTestBypass || captcha.toUpperCase() === session.captchaText;
  logger.debug('captcha-service', '验证码比较结果', undefined, {
    sessionId,
    input: captcha.toUpperCase(),
    expected: session.captchaText,
    matched: isValid,
    testBypass: isTestBypass,
    nodeEnv: process.env.NODE_ENV,
  });

  if (isValid) {
    // 验证成功
    if (deleteAfterVerify) {
      await deleteCaptchaSession(sessionId);
      logger.info('captcha-service', '验证码验证成功，已删除会话', undefined, {
        sessionId,
      });
    } else {
      logger.info('captcha-service', '验证码验证成功，会话保留', undefined, {
        sessionId,
      });
    }

    return {
      success: true,
    };
  } else {
    // 验证失败,增加尝试次数
    session.attempts += 1;
    await updateCaptchaSession(session);
    logger.warn('captcha-service', '验证码输入错误', undefined, {
      sessionId,
      attempts: session.attempts,
    });

    return {
      success: false,
      error: '验证码错误',
    };
  }
}
