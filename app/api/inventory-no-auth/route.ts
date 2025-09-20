import { type NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { paginationValidations } from '@/lib/validations/base';

// 获取库存列表（无需身份验证，用于测试）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryParams = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      search: searchParams.get('search') || undefined,
      sortBy: searchParams.get('sortBy') || 'updatedAt',
      sortOrder: (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc',
      productId: searchParams.get('productId') || undefined,
      variantId: searchParams.get('variantId') || undefined,
      colorCode: searchParams.get('colorCode') || undefined,
      batchNumber: searchParams.get('batchNumber') || undefined,
      location: searchParams.get('location') || undefined,
      productionDateStart: searchParams.get('productionDateStart') || undefined,
      productionDateEnd: searchParams.get('productionDateEnd') || undefined,
      lowStock: searchParams.get('lowStock') === 'true',
      hasStock: searchParams.get('hasStock') === 'true',
      groupByVariant: searchParams.get('groupByVariant') === 'true',
      includeVariants: searchParams.get('includeVariants') === 'true',
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

    const {
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      productId,
      variantId,
      colorCode,
      batchNumber,
      location,
      productionDateStart,
      productionDateEnd,
      lowStock,
      hasStock,
      groupByVariant: _groupByVariant,
      includeVariants,
    } = validationResult.data;

    // 构建查询条件
    const where: Record<string, string | number | boolean | object> = {};

    if (search) {
      where.OR = [
        { product: { code: { contains: search } } },
        { product: { name: { contains: search } } },
        { colorCode: { contains: search } },
        { batchNumber: { contains: search } },
        { location: { contains: search } },
      ];
    }

    if (productId) {
      where.productId = productId;
    }

    if (variantId) {
      where.variantId = variantId;
    }

    if (colorCode) {
      where.colorCode = colorCode;
    }

    if (batchNumber) {
      where.batchNumber = batchNumber;
    }

    if (location) {
      where.location = location;
    }

    if (productionDateStart || productionDateEnd) {
      where.productionDate = {};
      if (productionDateStart) {
        where.productionDate.gte = productionDateStart;
      }
      if (productionDateEnd) {
        where.productionDate.lte = productionDateEnd;
      }
    }

    if (lowStock) {
      // 低库存：可用库存 <= 10
      where.quantity = { lte: 10 };
    }

    if (hasStock) {
      // 有库存：数量 > 0
      where.quantity = { gt: 0 };
    }

    // 查询库存列表
    const [inventoryRecords, total] = await Promise.all([
      prisma.inventory.findMany({
        where,
        select: {
          id: true,
          productId: true,
          variantId: true,
          colorCode: true,
          productionDate: true,
          batchNumber: true,
          quantity: true,
          reservedQuantity: true,
          location: true,
          unitCost: true,
          updatedAt: true,
          product: {
            select: {
              id: true,
              code: true,
              name: true,
              specification: true,
              unit: true,
              piecesPerUnit: true,
              status: true,
            },
          },
          ...(includeVariants && {
            variant: {
              select: {
                id: true,
                colorCode: true,
                colorName: true,
                colorValue: true,
                sku: true,
                status: true,
              },
            },
          }),
        },
        orderBy: { [sortBy as string]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.inventory.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // 转换数据格式（snake_case -> camelCase）
    const formattedInventory = inventoryRecords.map(record => ({
      id: record.id,
      productId: record.productId,
      variantId: record.variantId,
      colorCode: record.colorCode,
      productionDate: record.productionDate,
      batchNumber: record.batchNumber,
      quantity: record.quantity,
      reservedQuantity: record.reservedQuantity,
      availableQuantity: record.quantity - record.reservedQuantity,
      location: record.location,
      unitCost: record.unitCost,
      product: record.product,
      variant: (record as { variant?: unknown }).variant,
      updatedAt: record.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      data: formattedInventory,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('获取库存列表错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取库存列表失败',
      },
      { status: 500 }
    );
  }
}
