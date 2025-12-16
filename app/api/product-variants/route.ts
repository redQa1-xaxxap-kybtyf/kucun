import type { Prisma } from '@prisma/client';
import { NextResponse, type NextRequest } from 'next/server';

import { parseOffsetPagination } from '@/lib/api/pagination';
import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  productVariantQuerySchema,
  productVariantCreateSchema,
} from '@/lib/validations/product';

// 获取产品变体列表
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    let page: number;
    let limit: number;
    let skip: number;
    try {
      const parsed = parseOffsetPagination(searchParams, {
        strict: true,
        pageFieldLabel: '页码',
        limitFieldLabel: '每页数量',
      });
      page = parsed.page;
      limit = parsed.limit;
      skip = parsed.skip;
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : '分页参数格式不正确',
        },
        { status: 400 }
      );
    }
    const queryParams = {
      productId: searchParams.get('productId') || undefined,
      colorCode: searchParams.get('colorCode') || undefined,
      status: searchParams.get('status') || undefined,
      page,
      limit,
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: searchParams.get('sortOrder') || 'desc',
    };

    // 验证查询参数
    const validationResult = productVariantQuerySchema.safeParse(queryParams);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '查询参数格式不正确',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { productId, colorCode, status, sortBy, sortOrder } =
      validationResult.data;

    // 构建查询条件
    const where: Prisma.ProductVariantWhereInput = {};
    if (productId) {
      where.productId = productId;
    }
    if (colorCode) {
      where.colorCode = { contains: colorCode };
    }
    if (status) {
      where.status = status;
    }

    const orderBy: Prisma.ProductVariantOrderByWithRelationInput[] = [
      { [sortBy]: sortOrder },
      { id: 'desc' },
    ];

    // 查询产品变体列表
    const [variants, total] = await Promise.all([
      prisma.productVariant.findMany({
        where,
        select: {
          id: true,
          productId: true,
          colorCode: true,
          colorName: true,
          colorValue: true,
          sku: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          product: {
            select: {
              id: true,
              code: true,
              name: true,
              unit: true,
              status: true,
            },
          },
          // 库存汇总信息
          inventory: {
            select: {
              quantity: true,
              reservedQuantity: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.productVariant.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // 转换数据格式并计算库存汇总
    const formattedVariants = variants.map(variant => {
      const totalInventory = variant.inventory.reduce(
        (sum, inv) => sum + inv.quantity,
        0
      );
      const reservedInventory = variant.inventory.reduce(
        (sum, inv) => sum + inv.reservedQuantity,
        0
      );

      return {
        id: variant.id,
        productId: variant.productId,
        colorCode: variant.colorCode,
        colorName: variant.colorName,
        colorValue: variant.colorValue,
        sku: variant.sku,
        status: variant.status,
        createdAt: variant.createdAt,
        updatedAt: variant.updatedAt,
        product: variant.product,
        totalInventory,
        reservedInventory,
        availableInventory: totalInventory - reservedInventory,
      };
    });

    return NextResponse.json({
      success: true,
      data: formattedVariants,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    logger.error('product-variants', '获取产品变体列表失败', error, {
      url: request.url,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取产品变体列表失败',
      },
      { status: 500 }
    );
  }
});

// 创建产品变体
export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();

    // 验证输入数据
    const validationResult = productVariantCreateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '输入数据格式不正确',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { productId, colorCode, colorName, colorValue, sku } =
      validationResult.data;

    // 验证产品是否存在
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, code: true, name: true, status: true },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: '产品不存在' },
        { status: 404 }
      );
    }

    if (product.status !== 'active') {
      return NextResponse.json(
        { success: false, error: '产品已停用，无法创建变体' },
        { status: 400 }
      );
    }

    // 检查同一产品下色号是否已存在
    const existingVariant = await prisma.productVariant.findFirst({
      where: {
        productId,
        colorCode,
      },
    });

    if (existingVariant) {
      return NextResponse.json(
        { success: false, error: '该产品的此色号变体已存在' },
        { status: 409 }
      );
    }

    // 生成SKU（如果未提供）
    const finalSku = sku || `${product.code}-${colorCode}`;

    // 检查SKU是否已存在
    const existingSku = await prisma.productVariant.findUnique({
      where: { sku: finalSku },
    });

    if (existingSku) {
      return NextResponse.json(
        { success: false, error: 'SKU已存在，请使用其他SKU' },
        { status: 409 }
      );
    }

    // 创建产品变体
    const variant = await prisma.productVariant.create({
      data: {
        productId,
        colorCode,
        colorName,
        colorValue,
        sku: finalSku,
        status: 'active',
      },
      include: {
        product: {
          select: {
            id: true,
            code: true,
            name: true,
            unit: true,
            status: true,
          },
        },
      },
    });

    // 转换数据格式
    const formattedVariant = {
      id: variant.id,
      productId: variant.productId,
      colorCode: variant.colorCode,
      colorName: variant.colorName,
      colorValue: variant.colorValue,
      sku: variant.sku,
      status: variant.status,
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
      product: variant.product,
      totalInventory: 0,
      reservedInventory: 0,
      availableInventory: 0,
    };

    return NextResponse.json({
      success: true,
      data: formattedVariant,
    });
  } catch (error) {
    logger.error('product-variants', '创建产品变体失败', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '创建产品变体失败',
      },
      { status: 500 }
    );
  }
});
