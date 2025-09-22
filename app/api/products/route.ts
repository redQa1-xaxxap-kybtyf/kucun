import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { paginationValidations } from '@/lib/validations/base';

// 获取产品列表
export async function GET(request: NextRequest) {
  try {
    // 验证用户权限 (开发环境下临时绕过)
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
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
      search: searchParams.get('search') || undefined,
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: searchParams.get('sortOrder') || 'desc',
      status: searchParams.get('status') || undefined,
      unit: searchParams.get('unit') || undefined,
      categoryId: searchParams.get('categoryId') || undefined,
    };

    // 验证查询参数
    const validationResult = paginationValidations.query.safeParse(queryParams);
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

    const { page, limit, search, sortBy, sortOrder } = validationResult.data;
    const { status, unit, categoryId } = queryParams;

    // 构建查询条件
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { code: { contains: search } },
        { name: { contains: search } },
        { specification: { contains: search } },
      ];
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    if (unit) {
      where.unit = unit;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    // 查询产品列表
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true,
          code: true,
          name: true,
          specification: true,
          specifications: true,
          unit: true,
          piecesPerUnit: true,
          weight: true,
          thickness: true,
          status: true,
          categoryId: true,
          category: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              inventory: true,
              salesOrderItems: true,
              inboundRecords: true,
            },
          },
        },
        orderBy: { [sortBy as string]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // 获取库存汇总信息
    const productIds = products.map(p => p.id);
    const inventorySummary = await prisma.inventory.groupBy({
      by: ['productId'],
      where: {
        productId: { in: productIds },
      },
      _sum: {
        quantity: true,
        reservedQuantity: true,
      },
    });

    const inventoryMap = new Map(
      inventorySummary.map(item => [
        item.productId,
        {
          totalQuantity: item._sum.quantity || 0,
          reservedQuantity: item._sum.reservedQuantity || 0,
          availableQuantity:
            (item._sum.quantity || 0) - (item._sum.reservedQuantity || 0),
        },
      ])
    );

    // 转换数据格式（snake_case -> camelCase）
    const formattedProducts = products.map(product => ({
      id: product.id,
      code: product.code,
      name: product.name,
      specification: product.specification,
      specifications: product.specifications
        ? JSON.parse(product.specifications as string)
        : null,
      unit: product.unit,
      piecesPerUnit: product.piecesPerUnit,
      weight: product.weight,
      thickness: product.thickness,
      status: product.status,
      categoryId: product.categoryId,
      category: product.category
        ? {
            id: product.category.id,
            name: product.category.name,
            code: product.category.code,
          }
        : null,
      inventory: inventoryMap.get(product.id) || {
        totalQuantity: 0,
        reservedQuantity: 0,
        availableQuantity: 0,
      },
      statistics: {
        inventoryRecordsCount: product._count.inventory,
        salesOrderItemsCount: product._count.salesOrderItems,
        inboundRecordsCount: product._count.inboundRecords,
      },
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      data: formattedProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('获取产品列表错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取产品列表失败',
      },
      { status: 500 }
    );
  }
}

// 创建产品
export async function POST(request: NextRequest) {
  try {
    // 验证用户权限 (开发环境下临时绕过)
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
    const validationResult = createProductSchema.safeParse(body);
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

    const {
      code,
      name,
      specification,
      specifications,
      unit,
      piecesPerUnit,
      weight,
      thickness,
      categoryId,
    } = validationResult.data;

    // 检查产品编码是否已存在
    const existingProduct = await prisma.product.findUnique({
      where: { code },
    });

    if (existingProduct) {
      return NextResponse.json(
        { success: false, error: '产品编码已存在' },
        { status: 400 }
      );
    }

    // 处理分类ID：如果是"uncategorized"则设置为null
    const processedCategoryId =
      categoryId === 'uncategorized' ? null : categoryId;

    // 创建产品
    const product = await prisma.product.create({
      data: {
        code,
        name,
        specification,
        specifications: specifications ? JSON.stringify(specifications) : null,
        unit,
        piecesPerUnit,
        weight,
        thickness,
        categoryId: processedCategoryId,
        status: 'active',
      },
      select: {
        id: true,
        code: true,
        name: true,
        specification: true,
        specifications: true,
        unit: true,
        piecesPerUnit: true,
        weight: true,
        thickness: true,
        status: true,
        categoryId: true,
        category: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    // 转换数据格式
    const formattedProduct = {
      id: product.id,
      code: product.code,
      name: product.name,
      specification: product.specification,
      specifications: product.specifications
        ? JSON.parse(product.specifications as string)
        : null,
      unit: product.unit,
      piecesPerUnit: product.piecesPerUnit,
      weight: product.weight,
      thickness: product.thickness,
      status: product.status,
      categoryId: product.categoryId,
      category: product.category
        ? {
            id: product.category.id,
            name: product.category.name,
            code: product.category.code,
          }
        : null,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };

    return NextResponse.json({
      success: true,
      data: formattedProduct,
      message: '产品创建成功',
    });
  } catch (error) {
    console.error('创建产品错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '创建产品失败',
      },
      { status: 500 }
    );
  }
}
