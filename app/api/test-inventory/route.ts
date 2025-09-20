import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';

export async function GET() {
  try {
    // 测试库存API查询逻辑（不需要身份验证）
    const queryParams = {
      page: 1,
      limit: 20,
      search: '',
      sortBy: 'updatedAt',
      sortOrder: 'desc' as const,
      includeVariants: true,
    };

    // 构建查询条件
    const where: Record<string, unknown> = {};

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
        },
        orderBy: { [queryParams.sortBy]: queryParams.sortOrder },
        skip: (queryParams.page - 1) * queryParams.limit,
        take: queryParams.limit,
      }),
      prisma.inventory.count({ where }),
    ]);

    const totalPages = Math.ceil(total / queryParams.limit);

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
      variant: record.variant,
      updatedAt: record.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      data: formattedInventory,
      pagination: {
        page: queryParams.page,
        limit: queryParams.limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('测试库存查询错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '测试库存查询失败',
        details: error,
      },
      { status: 500 }
    );
  }
}
