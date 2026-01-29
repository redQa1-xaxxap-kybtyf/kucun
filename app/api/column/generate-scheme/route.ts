/**
 * 生成用砖方案 API
 * POST /api/column/generate-scheme
 */

import { type NextRequest, NextResponse } from 'next/server';

import { generateScheme, type GenerateSchemeRequest } from '@/lib/api/column';
import { logger } from '@/lib/logger';

/**
 * 生成用砖方案
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateSchemeRequest;

    // 验证必填参数
    if (!body.targetHeight || body.targetHeight <= 0) {
      return NextResponse.json(
        { success: false, error: '目标高度无效' },
        { status: 400 }
      );
    }

    if (!body.faceTypes || body.faceTypes.length === 0) {
      return NextResponse.json(
        { success: false, error: '请至少配置一个面型' },
        { status: 400 }
      );
    }

    const result = await generateScheme(body);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('column', '生成用砖方案失败', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '生成用砖方案失败',
      },
      { status: 500 }
    );
  }
}
