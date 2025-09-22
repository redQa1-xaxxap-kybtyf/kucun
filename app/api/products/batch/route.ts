import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type { BatchDeleteResult } from '@/lib/types/product';

// 批量删除产品的验证Schema
const BatchDeleteProductsSchema = z.object({
  productIds: z
    .array(z.string().min(1, '产品ID不能为空'))
    .min(1, '至少需要选择一个产品')
    .max(100, '一次最多只能删除100个产品'),
});

/**
 * 批量删除产品
 * DELETE /api/products/batch
 */
export async function DELETE(request: NextRequest) {
  try {
    // 验证用户权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // 验证输入数据
    const validationResult = BatchDeleteProductsSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '输入数据格式不正确',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { productIds } = validationResult.data;

    // 检查产品是否存在
    const existingProducts = await prisma.product.findMany({
      where: {
        id: { in: productIds },
      },
      select: {
        id: true,
        name: true,
        code: true,
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
      return NextResponse.json(
        { success: false, error: '未找到要删除的产品' },
        { status: 404 }
      );
    }

    // 检查哪些产品不存在
    const existingProductIds = existingProducts.map(p => p.id);
    const notFoundProductIds = productIds.filter(
      id => !existingProductIds.includes(id)
    );

    // 检查哪些产品有关联数据，不能删除
    const productsWithReferences = existingProducts.filter(
      product =>
        product._count.inventory > 0 ||
        product._count.salesOrderItems > 0 ||
        product._count.inboundRecords > 0
    );

    // 可以删除的产品
    const deletableProducts = existingProducts.filter(
      product =>
        product._count.inventory === 0 &&
        product._count.salesOrderItems === 0 &&
        product._count.inboundRecords === 0
    );

    const deletableProductIds = deletableProducts.map(p => p.id);

    // 执行批量删除
    let deletedCount = 0;
    if (deletableProductIds.length > 0) {
      const deleteResult = await prisma.product.deleteMany({
        where: {
          id: { in: deletableProductIds },
        },
      });
      deletedCount = deleteResult.count;
    }

    // 构建失败的产品列表
    const failedProducts = [
      // 不存在的产品
      ...notFoundProductIds.map(id => ({
        id,
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
          name: product.name,
          reason: `存在关联数据: ${reasons.join(', ')}`,
        };
      }),
    ];

    const failedCount = failedProducts.length;
    const totalRequested = productIds.length;

    // 构建响应消息
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

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('批量删除产品错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '批量删除产品失败',
        details:
          process.env.NODE_ENV === 'development'
            ? {
                message: error instanceof Error ? error.message : '未知错误',
                stack: error instanceof Error ? error.stack : undefined,
              }
            : undefined,
      },
      { status: 500 }
    );
  }
}
