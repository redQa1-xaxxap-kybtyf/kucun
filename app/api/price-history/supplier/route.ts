import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';

import { prisma } from '@/lib/prisma';

/**
 * GET /api/price-history/supplier
 * 获取供应商的产品历史价格
 *
 * Query参数:
 * - supplierId: 供应商ID (必填)
 * - productId: 产品ID (可选，不传则返回该供应商所有产品的最新价格)
 */
export async function GET(request: NextRequest) {
  try {
    // 验证用户登录
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplierId');
    const productId = searchParams.get('productId');

    if (!supplierId) {
      return NextResponse.json({ error: '供应商ID不能为空' }, { status: 400 });
    }

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
    const productIds = latestPrices.map(p => p.productId);
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
    });

    // 组合数据
    const result = latestPrices.map(price => ({
      ...price,
      product: products.find(p => p.id === price.productId),
    }));

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('获取供应商价格历史失败:', error);
    return NextResponse.json(
      {
        error: '获取价格历史失败',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

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
export async function POST(request: NextRequest) {
  try {
    // 验证用户登录
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const { supplierId, productId, unitPrice, orderId } = body;

    // 验证必填字段
    if (!supplierId || !productId || unitPrice === undefined) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
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
    console.error('记录供应商价格历史失败:', error);
    return NextResponse.json(
      {
        error: '记录价格历史失败',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
