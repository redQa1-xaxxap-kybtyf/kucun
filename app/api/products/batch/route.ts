import { type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { ApiError } from '@/lib/api/errors';
import { withErrorHandling } from '@/lib/api/middleware';
import { successResponse } from '@/lib/api/response';
import { authOptions } from '@/lib/auth';
import { invalidateProductCache } from '@/lib/cache/product-cache';
import { prisma } from '@/lib/db';
import type { BatchDeleteResult } from '@/lib/types/product';
import { batchDeleteProductsSchema } from '@/lib/validations/product';

/**
 * 批量删除产品
 * DELETE /api/products/batch
 */
export const DELETE = withErrorHandling(async (request: NextRequest) => {
  // 1. 验证用户权限
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw ApiError.unauthorized();
  }

  // 2. 解析请求体
  const body = await request.json();

  // 3. 验证输入数据（Zod 错误会自动处理）
  const { productIds } = batchDeleteProductsSchema.parse(body);

  // 4. 检查产品是否存在
  const existingProducts = await prisma.product.findMany({
    where: {
      id: { in: productIds },
    },
    select: {
      id: true,
      code: true,
      name: true,
      _count: {
        select: {
          inventory: true,
          salesOrderItems: true,
          inboundRecords: true,
        },
      },
    },
  });

  if (existingProducts.length === 0) {
    throw ApiError.notFound('产品');
  }

  // 5. 检查哪些产品不存在
  const existingProductIds = existingProducts.map(p => p.id);
  const notFoundProductIds = productIds.filter(
    id => !existingProductIds.includes(id)
  );

  // 6. 检查哪些产品有关联数据，不能删除
  const productsWithReferences = existingProducts.filter(
    product =>
      product._count.inventory > 0 ||
      product._count.salesOrderItems > 0 ||
      product._count.inboundRecords > 0
  );

  // 7. 可以删除的产品
  const deletableProducts = existingProducts.filter(
    product =>
      product._count.inventory === 0 &&
      product._count.salesOrderItems === 0 &&
      product._count.inboundRecords === 0
  );

  const deletableProductIds = deletableProducts.map(p => p.id);

  // 8. 执行批量删除
  let deletedCount = 0;
  if (deletableProductIds.length > 0) {
    const deleteResult = await prisma.product.deleteMany({
      where: {
        id: { in: deletableProductIds },
      },
    });
    deletedCount = deleteResult.count;
  }

  // 9. 构建失败的产品列表
  const failedProducts = [
    // 不存在的产品
    ...notFoundProductIds.map(id => ({
      id,
      code: '未知',
      name: '未知产品',
      reason: '产品不存在',
    })),
    // 有关联数据的产品
    ...productsWithReferences.map(product => {
      const reasons = [];
      if (product._count.inventory > 0) {
        reasons.push(`库存记录(${product._count.inventory}条)`);
      }
      if (product._count.salesOrderItems > 0) {
        reasons.push(`销售订单(${product._count.salesOrderItems}条)`);
      }
      if (product._count.inboundRecords > 0) {
        reasons.push(`入库记录(${product._count.inboundRecords}条)`);
      }
      return {
        id: product.id,
        code: product.code,
        name: product.name,
        reason: `存在关联数据: ${reasons.join(', ')}`,
      };
    }),
  ];

  const failedCount = failedProducts.length;
  const totalRequested = productIds.length;

  // 10. 构建响应消息
  let message = '';
  if (deletedCount === totalRequested) {
    message = `成功删除 ${deletedCount} 个产品`;
  } else if (deletedCount > 0) {
    message = `成功删除 ${deletedCount} 个产品，${failedCount} 个产品删除失败`;
  } else {
    message = `删除失败，${failedCount} 个产品无法删除`;
  }

  const result: BatchDeleteResult = {
    success: deletedCount > 0,
    deletedCount,
    failedCount,
    failedProducts: failedCount > 0 ? failedProducts : undefined,
    message,
  };

  // 11. 清除缓存
  if (deletedCount > 0) {
    await invalidateProductCache();
  }

  // 12. 返回成功响应
  return successResponse(result);
});
