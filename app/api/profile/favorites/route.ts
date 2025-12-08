import { type NextRequest } from 'next/server';

import {
  errorResponse,
  successResponse,
  withAuth,
} from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';

interface FavoriteProductDto {
  id: string;
  code: string;
  name: string;
  thumbnailUrl?: string | null;
  addedAt: string;
}

// 获取当前用户收藏的产品列表
export const GET = withAuth(async (_request, { user }) => {
  const favorites = await prisma.productFavorite.findMany({
    where: { userId: user.id },
    include: {
      product: {
        select: {
          id: true,
          code: true,
          name: true,
          thumbnailUrl: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 100,
  });

  const data: FavoriteProductDto[] = favorites.map(fav => ({
    id: fav.product.id,
    code: fav.product.code,
    name: fav.product.name,
    thumbnailUrl: fav.product.thumbnailUrl,
    addedAt: fav.createdAt.toISOString(),
  }));

  return successResponse<FavoriteProductDto[]>(data);
});

// 切换收藏状态（收藏 / 取消收藏）
export const POST = withAuth(async (request: NextRequest, { user }) => {
  const body = await request.json().catch(() => null);
  const productId = (body as { productId?: string } | null)?.productId;

  if (!productId) {
    return errorResponse('缺少产品ID', 400);
  }

  // 检查产品是否存在
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });

  if (!product) {
    return errorResponse('产品不存在', 404);
  }

  // 根据当前状态切换收藏
  const existing = await prisma.productFavorite.findUnique({
    where: {
      userId_productId: {
        userId: user.id,
        productId,
      },
    },
    select: { id: true },
  });

  let isFavorite: boolean;

  if (existing) {
    await prisma.productFavorite.delete({
      where: { id: existing.id },
    });
    isFavorite = false;
  } else {
    await prisma.productFavorite.create({
      data: {
        userId: user.id,
        productId,
      },
    });
    isFavorite = true;
  }

  return successResponse<{ isFavorite: boolean }>({ isFavorite });
});

// 清空当前用户的收藏
export const DELETE = withAuth(async (_request, { user }) => {
  await prisma.productFavorite.deleteMany({
    where: { userId: user.id },
  });

  return successResponse<{ cleared: boolean }>({ cleared: true });
});
