/**
 * 罗马柱素材搜索 API
 * GET /api/column/materials
 */

import { NextResponse, type NextRequest } from 'next/server';

import {
  searchMaterials,
  type MaterialSearchParams,
  type SlotType,
} from '@/lib/api/column';
import { logger } from '@/lib/logger';

/**
 * 获取素材列表
 * 支持小程序游客访问（不需要登录）
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // 解析查询参数
    const params: MaterialSearchParams = {
      keyword: searchParams.get('keyword') || undefined,
      slot: (searchParams.get('slot') as SlotType | 'ALL') || 'ALL',
      heightRange: searchParams.get('heightRange') || undefined,
      page: parseInt(searchParams.get('page') || '1', 10),
      pageSize: parseInt(searchParams.get('pageSize') || '20', 10),
      sortBy: searchParams.get('sortBy') || 'code',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc',
    };

    // 获取用户ID（可选，用于收藏状态）
    // 小程序游客没有用户ID，收藏状态默认为 false
    const userId = undefined; // TODO: 从 session 获取

    const result = await searchMaterials(params, userId);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('column', '素材搜索失败', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '素材搜索失败',
      },
      { status: 500 }
    );
  }
}
