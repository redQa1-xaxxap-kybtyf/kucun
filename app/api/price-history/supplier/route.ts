import { type NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { supplierPriceHistoryQuerySchema } from '@/lib/validations/price-history';

/**
 * GET /api/price-history/supplier
 * 获取供应商的产品历史价格
 *
 * Query参数:
 * - supplierId: 供应商ID (必填)
 * - productId: 产品ID (可选，不传则返回该供应商所有产品的最新价格)
 */
export const GET = withAuth(
  async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);

      // 使用 Zod 进行参数验证
      const validationResult = supplierPriceHistoryQuerySchema.safeParse({
        supplierId: searchParams.get('supplierId') || undefined,
        productId: searchParams.get('productId') || undefined,
      });

      if (!validationResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: '查询条件有误，请检查后重试',
            details: validationResult.error.issues,
          },
          { status: 400 }
        );
      }

      const { supplierId, productId } = validationResult.data;

      // 构建查询条件
      const where: {
        supplierId: string;
        productId?: string;
      } = {
        supplierId,
      };

      if (productId) {
        where.productId = productId;
      }

      // 如果指定了产品ID，返回该产品的最新价格
      if (productId) {
        const prices = await prisma.supplierProductPrice.findMany({
          where,
          orderBy: {
            createdAt: 'desc',
          },
          take: 10, // 最多返回10条历史记录
          include: {
            product: {
              select: {
                id: true,
                code: true,
                name: true,
                specification: true,
                unit: true,
              },
            },
          },
        });

        return NextResponse.json({
          success: true,
          data: prices,
        });
      }

      // 如果没有指定产品ID，返回该供应商所有产品的最新价格
      const latestPrices = await prisma.$queryRaw<
        Array<{
          id: string;
          supplierId: string;
          productId: string;
          unitPrice: number;
          createdAt: Date;
        }>
      >`
      SELECT spp.*
      FROM supplier_product_prices spp
      INNER JOIN (
        SELECT product_id, MAX(created_at) as max_created_at
        FROM supplier_product_prices
        WHERE supplier_id = ${supplierId}
        GROUP BY product_id
      ) latest
      ON spp.product_id = latest.product_id
      AND spp.created_at = latest.max_created_at
      WHERE spp.supplier_id = ${supplierId}
      ORDER BY spp.created_at DESC
    `;

      // 获取产品信息
      const productIds = latestPrices.map(
        (p: { productId: string }) => p.productId
      );
      const products = await prisma.product.findMany({
        where: {
          id: {
            in: productIds,
          },
        },
        select: {
          id: true,
          code: true,
          name: true,
          specification: true,
          unit: true,
        },
        take: productIds.length,
      });

      // 组合数据
      const result = latestPrices.map(
        (price: { productId: string; unitPrice: number; createdAt: Date }) => ({
          ...price,
          product: products.find(
            (p: { id: string }) => p.id === price.productId
          ),
        })
      );

      return NextResponse.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('price-history', '获取供应商价格历史失败', error, {
        url: request.url,
      });
      return NextResponse.json(
        {
          success: false,
          error: '获取价格历史失败',
          details: error instanceof Error ? error.message : '未知错误',
        },
        { status: 500 }
      );
    }
  },
  { allPermissions: ['suppliers:view', 'products:view'] }
);

/**
 * POST /api/price-history/supplier
 * 记录供应商产品价格历史
 *
 * Body:
 * {
 *   supplierId: string;
 *   productId: string;
 *   unitPrice: number;
 *   orderId?: string;
 * }
 */
export const POST = withAuth(
  async (request: NextRequest) => {
    try {
      const body = await request.json();
      const { supplierId, productId, unitPrice, orderId } = body;

      // 验证必填字段
      if (!supplierId || !productId || unitPrice === undefined) {
        return NextResponse.json(
          { success: false, error: '缺少必填字段' },
          { status: 400 }
        );
      }

      // 创建价格历史记录
      const priceHistory = await prisma.supplierProductPrice.create({
        data: {
          supplierId,
          productId,
          unitPrice,
          orderId,
        },
        include: {
          product: {
            select: {
              id: true,
              code: true,
              name: true,
              specification: true,
              unit: true,
            },
          },
          supplier: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return NextResponse.json({
        success: true,
        data: priceHistory,
      });
    } catch (error) {
      logger.error('price-history', '记录供应商价格历史失败', error);
      return NextResponse.json(
        {
          success: false,
          error: '记录价格历史失败',
          details: error instanceof Error ? error.message : '未知错误',
        },
        { status: 500 }
      );
    }
  },
  { allPermissions: ['suppliers:view', 'products:manage_price'] }
);
