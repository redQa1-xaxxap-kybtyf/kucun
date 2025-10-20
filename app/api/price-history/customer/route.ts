import { type NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { customerPriceHistoryQuerySchema } from '@/lib/validations/price-history';

/**
 * GET /api/price-history/customer
 * 获取客户的产品历史价格
 *
 * Query参数:
 * - customerId: 客户ID (必填)
 * - productId: 产品ID (可选，不传则返回该客户所有产品的最新价格)
 * - priceType: 价格类型 (可选: SALES | FACTORY，不传则返回所有类型)
 */
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);

    // 使用 Zod 进行参数验证
    const validationResult = customerPriceHistoryQuerySchema.safeParse({
      customerId: searchParams.get('customerId') || undefined,
      productId: searchParams.get('productId') || undefined,
      priceType: searchParams.get('priceType') || undefined,
    });

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '查询参数验证失败',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { customerId, productId, priceType } = validationResult.data;

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

    if (priceType) {
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
    // 使用 Prisma 查询替代原始 SQL（兼容 SQLite 和 MySQL）
    const allPrices = await prisma.customerProductPrice.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
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
      },
    });

    // 在内存中进行分组，获取每个产品+价格类型组合的最新价格
    const latestPricesMap = new Map<string, (typeof allPrices)[0]>();
    for (const price of allPrices) {
      const key = `${price.productId}-${price.priceType}`;
      const existing = latestPricesMap.get(key);
      if (
        !existing ||
        new Date(price.createdAt) > new Date(existing.createdAt)
      ) {
        latestPricesMap.set(key, price);
      }
    }

    const latestPrices = Array.from(latestPricesMap.values());

    return NextResponse.json({
      success: true,
      data: latestPrices,
    });
  } catch (error) {
    logger.error('price-history', '获取客户价格历史失败', error, {
      url: request.url,
    });
    return NextResponse.json(
      {
        error: '获取价格历史失败',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
});

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
export const POST = withAuth(async (request: NextRequest) => {
  try {
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
    logger.error('price-history', '记录客户价格历史失败', error);
    return NextResponse.json(
      {
        error: '记录价格历史失败',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
});
