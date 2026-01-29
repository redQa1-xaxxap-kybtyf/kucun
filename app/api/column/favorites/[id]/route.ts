/**
 * 取消收藏 API
 * DELETE /api/column/favorites/[id]
 */

import { type NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * 取消收藏
 */
export const DELETE = withAuth(
  async (_request: NextRequest, { user, params }) => {
    try {
      const userId = user?.id;
      if (!userId) {
        return NextResponse.json(
          { success: false, error: '用户未登录' },
          { status: 401 }
        );
      }

      const resolvedParams = (await params) ?? {};
      const materialId = resolvedParams.id;
      if (!materialId) {
        return NextResponse.json(
          { success: false, error: '缺少收藏记录ID参数' },
          { status: 400 }
        );
      }

      // 删除收藏记录
      await prisma.productFavorite.deleteMany({
        where: {
          userId,
          productId: materialId,
        },
      });

      return NextResponse.json({
        success: true,
        message: '已取消收藏',
      });
    } catch (error) {
      logger.error('column', '取消收藏失败', error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : '取消收藏失败',
        },
        { status: 500 }
      );
    }
  },
  { permissions: [] }
);
