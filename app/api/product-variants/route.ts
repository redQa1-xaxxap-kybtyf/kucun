import type { Prisma } from '@prisma/client';
import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { env, paginationConfig } from '@/lib/env';

// 产品变体查询参数验证
const ProductVariantQuerySchema = z.object({
  productId: z.string().uuid('产品ID格式不正确').optional(),
  colorCode: z.string().max(20, '色号不能超过20个字符').optional(),
  status: z.enum(['active', 'inactive']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(paginationConfig.maxPageSize)
    .default(paginationConfig.defaultPageSize),
  sortBy: z.enum(['colorCode', 'sku', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// 产品变体创建输入验证
const ProductVariantCreateSchema = z.object({
  productId: z.string().uuid('产品ID格式不正确'),
  colorCode: z.string().min(1, '色号不能为空').max(20, '色号不能超过20个字符'),
  colorName: z.string().max(50, '色号名称不能超过50个字符').optional(),
  colorValue: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, '颜色值格式不正确')
    .optional(),
  sku: z.string().max(50, 'SKU不能超过50个字符').optional(),
});

// 获取产品变体列表
export async function GET(request: NextRequest) {
  try {
    // 验证用户权限 (开发模式下跳过)
    if (env.NODE_ENV !== 'development') {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json(
          { success: false, error: '未授权访问' },
          { status: 401 }
        );
      }
    }

    const { searchParams } = new URL(request.url);
    const queryParams = {
      productId: searchParams.get('productId') || undefined,
      colorCode: searchParams.get('colorCode') || undefined,
      status: searchParams.get('status') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: searchParams.get('sortOrder') || 'desc',
    };

    // 验证查询参数
    const validationResult = ProductVariantQuerySchema.safeParse(queryParams);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '查询参数格式不正确',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { productId, colorCode, status, page, limit, sortBy, sortOrder } =
      validationResult.data;

    // 构建查询条件
    const where: Prisma.ProductVariantWhereInput = {};
    if (productId) where.productId = productId;
    if (colorCode) where.colorCode = { contains: colorCode };
    if (status) where.status = status;

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
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
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
    console.error('获取产品变体列表错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取产品变体列表失败',
      },
      { status: 500 }
    );
  }
}

// 创建产品变体
export async function POST(request: NextRequest) {
  try {
    // 验证用户权限 (开发模式下跳过)
    if (env.NODE_ENV !== 'development') {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json(
          { success: false, error: '未授权访问' },
          { status: 401 }
        );
      }
    }

    const body = await request.json();

    // 验证输入数据
    const validationResult = ProductVariantCreateSchema.safeParse(body);
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
    console.error('创建产品变体错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '创建产品变体失败',
      },
      { status: 500 }
    );
  }
}
