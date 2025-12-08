import { type NextRequest } from 'next/server';

import {
  errorResponse,
  successResponse,
  withAuth,
} from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';

interface HistoryProductDto {
  id: string;
  code: string;
  name: string;
  thumbnailUrl?: string | null;
  viewedAt: string;
}

// 获取当前用户的产品浏览历史
export const GET = withAuth(async (_request, { user }) => {
  const history = await prisma.productViewHistory.findMany({
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
      viewedAt: 'desc',
    },
    take: 100,
  });

  const data: HistoryProductDto[] = history.map(item => ({
    id: item.product.id,
    code: item.product.code,
    name: item.product.name,
    thumbnailUrl: item.product.thumbnailUrl,
    viewedAt: item.viewedAt.toISOString(),
  }));

  return successResponse<HistoryProductDto[]>(data);
});

// 记录浏览历史（查看产品详情时调用）
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

  const now = new Date();

  // upsert：不存在则创建，存在则更新时间
  await prisma.productViewHistory.upsert({
    where: {
      userId_productId: {
        userId: user.id,
        productId,
      },
    },
    update: {
      viewedAt: now,
    },
    create: {
      userId: user.id,
      productId,
      viewedAt: now,
    },
  });

  return successResponse<{ updated: boolean }>({ updated: true });
});

// 清空浏览历史
export const DELETE = withAuth(async (_request, { user }) => {
  await prisma.productViewHistory.deleteMany({
    where: { userId: user.id },
  });

  return successResponse<{ cleared: boolean }>({ cleared: true });
});
