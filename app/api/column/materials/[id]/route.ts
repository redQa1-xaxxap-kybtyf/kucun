/**
 * 罗马柱素材详情 API
 * GET /api/column/materials/[id]
 */

import { type NextRequest, NextResponse } from 'next/server';

import { getMaterialDetail } from '@/lib/api/column';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 获取素材详情
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // 获取用户ID（可选）
    const userId = undefined; // TODO: 从 session 获取

    const material = await getMaterialDetail(id, userId);

    if (!material) {
      return NextResponse.json(
        { success: false, error: '素材不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: material,
    });
  } catch (error) {
    logger.error('column', '获取素材详情失败', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取素材详情失败',
      },
      { status: 500 }
    );
  }
}
