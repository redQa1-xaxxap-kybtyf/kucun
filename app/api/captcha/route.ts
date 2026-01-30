/**
 * 验证码生成API
 * 严格遵循全栈项目统一约定规范
 * 实现服务器端验证码生成和验证机制
 * 使用 Redis 存储验证码会话,支持分布式部署
 */

import { NextResponse, type NextRequest } from 'next/server';

import { logger } from '@/lib/logger';
import { RateLimitType, withRateLimit } from '@/lib/rate-limit';
import {
  createCaptchaSession,
  verifyCaptcha,
} from '@/lib/services/captcha-service';
import { verifyCaptchaSchema } from '@/lib/validations/captcha';

async function handleCaptchaGeneration(
  request: NextRequest
): Promise<NextResponse> {
  try {
    // 获取客户端IP地址
    const clientIp =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    // 使用服务创建验证码会话
    const { sessionId, captchaImage } = await createCaptchaSession(clientIp);

    // 将 SVG 转为 data URL，避免前端使用 dangerouslySetInnerHTML 注入 SVG
    // data:image/svg+xml 使用 URI 编码，兼容 edge/node 环境（不依赖 Buffer）
    const captchaDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(
      captchaImage
    )}`;

    // 返回JSON格式响应，包含SVG内容和会话ID
    return NextResponse.json(
      {
        success: true,
        captchaImage: captchaDataUrl,
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
    logger.error('captcha', '生成验证码失败', error);

    return NextResponse.json(
      { success: false, error: '生成验证码失败' },
      { status: 500 }
    );
  }
}

async function handleCaptchaValidation(
  request: NextRequest
): Promise<NextResponse> {
  try {
    const body = await request.json();
    logger.info('captcha', '收到验证请求');

    // 使用 Zod schema 验证输入
    const validationResult = verifyCaptchaSchema.safeParse(body);

    if (!validationResult.success) {
      logger.warn('captcha', '参数验证失败');
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
    logger.debug('captcha', '开始验证会话', undefined, { sessionId });

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
      logger.info('captcha', '验证成功', undefined, { sessionId });
      return NextResponse.json({
        success: true,
        message: '验证码验证成功',
      });
    } else {
      logger.warn('captcha', '验证失败', undefined, {
        sessionId,
        reason: result.error,
      });
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
  } catch (error) {
    logger.error('captcha', '验证验证码异常', error);

    return NextResponse.json(
      { success: false, error: '验证验证码失败' },
      { status: 500 }
    );
  }
}

export const GET = withRateLimit(RateLimitType.CAPTCHA)(
  handleCaptchaGeneration
);
export const POST = withRateLimit(RateLimitType.CAPTCHA)(
  handleCaptchaValidation
);
