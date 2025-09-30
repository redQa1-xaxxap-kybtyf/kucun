import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/price-history/customer
 * 获取客户的产品历史价格
 *
 * Query参数:
 * - customerId: 客户ID (必填)
 * - productId: 产品ID (可选，不传则返回该客户所有产品的最新价格)
 * - priceType: 价格类型 (可选: SALES | FACTORY，不传则返回所有类型)
 */
export async function GET(request: NextRequest) {
  try {
    // 验证用户登录
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const productId = searchParams.get('productId');
    const priceType = searchParams.get('priceType');

    if (!customerId) {
      return NextResponse.json({ error: '客户ID不能为空' }, { status: 400 });
    }

    // 构建查询条件
    const where: {
      customerId: string;
      productId?: string;
      priceType?: string;
    } = {
      customerId,
    };

    if (productId) {
      where.productId = productId;
    }

    if (priceType && (priceType === 'SALES' || priceType === 'FACTORY')) {
      where.priceType = priceType;
    }

    // 如果指定了产品ID，返回该产品的最新价格（按价格类型分组）
    if (productId) {
      const prices = await prisma.customerProductPrice.findMany({
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

    // 如果没有指定产品ID，返回该客户所有产品的最新价格
    // 使用分组查询获取每个产品+价格类型组合的最新价格
    const latestPrices = await prisma.$queryRaw<
      Array<{
        id: string;
        customerId: string;
        productId: string;
        priceType: string;
        unitPrice: number;
        createdAt: Date;
      }>
    >`
      SELECT cpp.*
      FROM customer_product_prices cpp
      INNER JOIN (
        SELECT product_id, price_type, MAX(created_at) as max_created_at
        FROM customer_product_prices
        WHERE customer_id = ${customerId}
        ${priceType ? `AND price_type = ${priceType}` : ''}
        GROUP BY product_id, price_type
      ) latest
      ON cpp.product_id = latest.product_id
      AND cpp.price_type = latest.price_type
      AND cpp.created_at = latest.max_created_at
      WHERE cpp.customer_id = ${customerId}
      ORDER BY cpp.created_at DESC
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
    });

    // 组合数据
    const result = latestPrices.map(
      (price: {
        productId: string;
        priceType: string;
        unitPrice: number;
        createdAt: Date;
      }) => ({
        ...price,
        product: products.find((p: { id: string }) => p.id === price.productId),
      })
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('获取客户价格历史失败:', error);
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
 * POST /api/price-history/customer
 * 记录客户产品价格历史
 *
 * Body:
 * {
 *   customerId: string;
 *   productId: string;
 *   priceType: 'SALES' | 'FACTORY';
 *   unitPrice: number;
 *   orderId?: string;
 *   orderType?: 'SALES_ORDER' | 'FACTORY_SHIPMENT';
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
    const { customerId, productId, priceType, unitPrice, orderId, orderType } =
      body;

    // 验证必填字段
    if (!customerId || !productId || !priceType || unitPrice === undefined) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
    }

    // 验证价格类型
    if (priceType !== 'SALES' && priceType !== 'FACTORY') {
      return NextResponse.json(
        { error: '价格类型必须是 SALES 或 FACTORY' },
        { status: 400 }
      );
    }

    // 创建价格历史记录
    const priceHistory = await prisma.customerProductPrice.create({
      data: {
        customerId,
        productId,
        priceType,
        unitPrice,
        orderId,
        orderType,
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
        customer: {
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
    console.error('记录客户价格历史失败:', error);
    return NextResponse.json(
      {
        error: '记录价格历史失败',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
