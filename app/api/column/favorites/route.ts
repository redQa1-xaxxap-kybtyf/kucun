/**
 * 罗马柱收藏 API
 * GET/POST/DELETE /api/column/favorites
 */

import { type NextRequest, NextResponse } from 'next/server';

import { searchMaterials } from '@/lib/api/column';
import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * 获取用户收藏列表
 */
export const GET = withAuth(
  async (request: NextRequest, context) => {
    try {
      const userId = context.user?.id;
      if (!userId) {
        return NextResponse.json(
          { success: false, error: '用户未登录' },
          { status: 401 }
        );
      }

      // 获取用户收藏的产品ID
      const favorites = await prisma.productFavorite.findMany({
        where: { userId },
        select: { productId: true },
        orderBy: { createdAt: 'desc' },
      });

      if (favorites.length === 0) {
        return NextResponse.json({
          success: true,
          data: [],
        });
      }

      // 获取产品详情（复用搜索接口）
      const result = await searchMaterials({}, userId);

      // 只返回收藏的产品
      const favoriteIds = new Set(favorites.map(f => f.productId));
      const data = result.data.filter(m => favoriteIds.has(m.id));

      return NextResponse.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('column', '获取收藏列表失败', error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : '获取收藏列表失败',
        },
        { status: 500 }
      );
    }
  },
  { permissions: [] } // 登录即可访问
);

/**
 * 添加收藏
 */
export const POST = withAuth(
  async (request: NextRequest, context) => {
    try {
      const userId = context.user?.id;
      if (!userId) {
        return NextResponse.json(
          { success: false, error: '用户未登录' },
          { status: 401 }
        );
      }

      const body = await request.json();
      const { materialId } = body;

      if (!materialId) {
        return NextResponse.json(
          { success: false, error: '请指定素材ID' },
          { status: 400 }
        );
      }

      // 检查产品是否存在
      const product = await prisma.product.findUnique({
        where: { id: materialId },
        select: { id: true },
      });

      if (!product) {
        return NextResponse.json(
          { success: false, error: '素材不存在' },
          { status: 404 }
        );
      }

      // 添加收藏（如果已存在则忽略）
      await prisma.productFavorite.upsert({
        where: {
          userId_productId: { userId, productId: materialId },
        },
        create: {
          userId,
          productId: materialId,
        },
        update: {},
      });

      return NextResponse.json({
        success: true,
        message: '收藏成功',
      });
    } catch (error) {
      logger.error('column', '添加收藏失败', error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : '添加收藏失败',
        },
        { status: 500 }
      );
    }
  },
  { permissions: [] }
);
