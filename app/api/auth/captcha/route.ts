/**
 * 验证码生成API
 * 严格遵循全栈项目统一约定规范
 * 实现服务器端验证码生成和验证机制
 */

import crypto from 'crypto';

import { NextResponse, type NextRequest } from 'next/server';

import { prisma } from '@/lib/db';

// 验证码配置
const CAPTCHA_CONFIG = {
  width: 120,
  height: 40,
  length: 4,
  fontSize: 24,
  expireMinutes: 5, // 5分钟过期
  maxAttempts: 5, // 最大尝试次数
};

/**
 * 生成随机验证码字符串
 */
function generateCaptchaText(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < CAPTCHA_CONFIG.length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 生成验证码SVG图片
 */
function generateCaptchaSVG(text: string): string {
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
 * 生成验证码会话ID
 */
function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * 清理过期的验证码记录
 */
async function cleanExpiredCaptchas(): Promise<void> {
  const expireTime = new Date(
    Date.now() - CAPTCHA_CONFIG.expireMinutes * 60 * 1000
  );

  try {
    await prisma.captchaSession.deleteMany({
      where: {
        createdAt: {
          lt: expireTime,
        },
      },
    });
  } catch (error) {
    console.error('清理过期验证码失败:', error);
  }
}

/**
 * GET - 生成新的验证码
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 清理过期的验证码记录
    await cleanExpiredCaptchas();

    // 生成验证码文本和会话ID
    const captchaText = generateCaptchaText();
    const sessionId = generateSessionId();
    const expiresAt = new Date(
      Date.now() + CAPTCHA_CONFIG.expireMinutes * 60 * 1000
    );

    // 获取客户端IP地址
    const clientIp =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      request.ip ||
      '127.0.0.1';

    // 存储验证码会话到数据库
    await prisma.captchaSession.create({
      data: {
        sessionId,
        captchaText: captchaText.toUpperCase(), // 统一转为大写存储
        clientIp,
        expiresAt,
        attempts: 0,
      },
    });

    // 生成验证码SVG图片
    const svgContent = generateCaptchaSVG(captchaText);

    // 返回SVG图片和会话ID
    const response = new NextResponse(svgContent, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
        'X-Captcha-Session': sessionId,
      },
    });

    return response;
  } catch (error) {
    console.error('生成验证码失败:', error);

    return NextResponse.json(
      { success: false, error: '生成验证码失败' },
      { status: 500 }
    );
  }
}

/**
 * POST - 验证验证码（用于预验证，可选）
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { sessionId, captcha } = body;

    if (!sessionId || !captcha) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 查找验证码会话
    const session = await prisma.captchaSession.findUnique({
      where: { sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: '验证码会话不存在或已过期' },
        { status: 400 }
      );
    }

    // 检查是否过期
    if (new Date() > session.expiresAt) {
      // 删除过期的会话
      await prisma.captchaSession.delete({
        where: { sessionId },
      });

      return NextResponse.json(
        { success: false, error: '验证码已过期' },
        { status: 400 }
      );
    }

    // 检查尝试次数
    if (session.attempts >= CAPTCHA_CONFIG.maxAttempts) {
      // 删除超过尝试次数的会话
      await prisma.captchaSession.delete({
        where: { sessionId },
      });

      return NextResponse.json(
        { success: false, error: '验证码尝试次数过多' },
        { status: 400 }
      );
    }

    // 验证验证码
    const isValid = captcha.toUpperCase() === session.captchaText;

    if (isValid) {
      return NextResponse.json({
        success: true,
        message: '验证码验证成功',
      });
    } else {
      // 增加尝试次数
      await prisma.captchaSession.update({
        where: { sessionId },
        data: {
          attempts: session.attempts + 1,
        },
      });

      return NextResponse.json(
        { success: false, error: '验证码错误' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('验证验证码失败:', error);

    return NextResponse.json(
      { success: false, error: '验证验证码失败' },
      { status: 500 }
    );
  }
}
