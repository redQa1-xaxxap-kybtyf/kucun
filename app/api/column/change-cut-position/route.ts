/**
 * 修改切割位置 API
 * POST /api/column/change-cut-position
 */

import { type NextRequest, NextResponse } from 'next/server';

import {
  changeCutPosition,
  type GenerateSchemeRequest,
  type SlotType,
} from '@/lib/api/column';
import { logger } from '@/lib/logger';

/**
 * 修改切割位置
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateSchemeRequest & {
      cutPosition: SlotType;
    };

    // 验证必填参数
    if (!body.cutPosition) {
      return NextResponse.json(
        { success: false, error: '请指定切割位置' },
        { status: 400 }
      );
    }

    if (!['BODY', 'BASE', 'CAP'].includes(body.cutPosition)) {
      return NextResponse.json(
        { success: false, error: '无效的切割位置' },
        { status: 400 }
      );
    }

    const result = await changeCutPosition(body);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('column', '修改切割位置失败', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '修改切割位置失败',
      },
      { status: 500 }
    );
  }
}
