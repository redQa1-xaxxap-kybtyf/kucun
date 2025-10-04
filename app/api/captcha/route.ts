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
import { verifyCaptchaSchema } from '@/lib/validations/captcha';

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
 * 使用 Zod schema 进行参数验证，遵循"唯一真理源"规范
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    console.log('[验证码API] 收到验证请求:', JSON.stringify(body));

    // 使用 Zod schema 验证输入
    const validationResult = verifyCaptchaSchema.safeParse(body);

    if (!validationResult.success) {
      console.log(
        '[验证码API] Zod验证失败:',
        JSON.stringify(validationResult.error.issues)
      );
      return NextResponse.json(
        {
          success: false,
          error: '参数验证失败',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { sessionId, captcha, deleteAfterVerify } = validationResult.data;
    console.log(
      '[验证码API] Zod验证通过 - SessionID:',
      sessionId,
      'Captcha:',
      captcha
    );

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
      console.log('[验证码API] 验证成功');
      return NextResponse.json({
        success: true,
        message: '验证码验证成功',
      });
    } else {
      console.log('[验证码API] 验证失败:', result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[验证码API] 异常:', error);

    return NextResponse.json(
      { success: false, error: '验证验证码失败' },
      { status: 500 }
    );
  }
}
