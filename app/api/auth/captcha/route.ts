/**
 * 验证码生成API
 * 严格遵循全栈项目统一约定规范
 * 实现服务器端验证码生成和验证机制
 * 使用 Redis 存储验证码会话,支持分布式部署
 */

import { NextResponse, type NextRequest } from 'next/server';

import {
  createCaptchaSession,
  verifyCaptcha,
} from '@/lib/services/captcha-service';

/**
 * GET - 生成新的验证码
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 获取客户端IP地址
    const clientIp =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    // 使用服务创建验证码会话
    const { sessionId, captchaImage } = await createCaptchaSession(clientIp);

    // 返回JSON格式响应，包含SVG内容和会话ID
    return NextResponse.json(
      {
        success: true,
        captchaImage,
        sessionId,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
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
    const { sessionId, captcha, deleteAfterVerify } = body;

    if (!sessionId || !captcha) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 获取客户端IP地址
    const clientIp =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    // 使用服务验证验证码
    const result = await verifyCaptcha(
      sessionId,
      captcha,
      clientIp,
      deleteAfterVerify
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: '验证码验证成功',
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
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
