/**
 * 临时产品查询 API
 *
 * GET /api/temporary-products
 *
 * 功能:
 * - 查询临时产品列表
 * - 支持按供应商筛选
 * - 支持搜索(编码、名称、规格)
 * - 支持排序(使用次数、最后使用时间、名称)
 * - 支持分页
 *
 * 只读查询,不提供创建/编辑/删除功能(由系统自动管理)
 */

import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// 排序配置映射（函数外，减少 GET 体积）
const orderByMap: Record<
  string,
  Prisma.TemporaryProductOrderByWithRelationInput
> = {
  usageCount: { usageCount: 'desc' },
  lastUsedAt: { lastUsedAt: 'desc' },
  name: { name: 'asc' },
  code: { code: 'asc' },
  createdAt: { createdAt: 'desc' },
};

function getOrderBy(
  sortBy: string,
  sortOrder: string
): Prisma.TemporaryProductOrderByWithRelationInput {
  const known = Object.prototype.hasOwnProperty.call(orderByMap, sortBy);
  const base = known ? orderByMap[sortBy] : orderByMap.usageCount;
  // 仅当字段有效时才按请求调整排序方向，保持未知字段时的原有默认行为
  if (!known) return base;
  const dir =
    sortOrder === 'asc' || sortOrder === 'desc'
      ? (sortOrder as Prisma.SortOrder)
      : undefined;
  if (!dir) return base;
  const key = Object.keys(base)[0] as keyof typeof base;
  return { [key]: dir } as Prisma.TemporaryProductOrderByWithRelationInput;
}

function buildWhere(
  supplierId: string | undefined,
  search: string
): Prisma.TemporaryProductWhereInput {
  const where: Prisma.TemporaryProductWhereInput = {};
  if (supplierId && supplierId !== 'all') where.supplierId = supplierId;
  if (search) {
    where.OR = [
      { code: { contains: search } },
      { name: { contains: search } },
      { specification: { contains: search } },
    ];
  }
  return where;
}

type TempProductWithRelations = Prisma.TemporaryProductGetPayload<{
  include: {
    supplier: { select: { id: true; name: true; supplierCode: true } };
    creator: { select: { id: true; name: true } };
    _count: { select: { salesOrderItems: true; factoryShipmentItems: true } };
  };
}>;

function formatTemporaryProduct(item: TempProductWithRelations) {
  return {
    id: item.id,
    supplierId: item.supplierId,
    supplierName: item.supplier.name,
    supplierCode: item.supplier.supplierCode,
    code: item.code,
    name: item.name,
    specification: item.specification,
    weight: item.weight,
    unit: item.unit,
    piecesPerUnit: item.piecesPerUnit,
    usageCount: item.usageCount,
    lastUsedAt: item.lastUsedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    creatorName: item.creator?.name || null,
    salesOrderCount: item._count.salesOrderItems,
    factoryShipmentCount: item._count.factoryShipmentItems,
    totalUsageCount:
      item._count.salesOrderItems + item._count.factoryShipmentItems,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // 查询参数
    const supplierId = searchParams.get('supplierId') || undefined;
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'usageCount';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // 查询条件与排序
    const where = buildWhere(supplierId, search);
    const orderBy = getOrderBy(sortBy, sortOrder);

    // 分页参数
    const skip = (page - 1) * limit;

    // 并行查询数据和总数
    const [items, total] = await Promise.all([
      prisma.temporaryProduct.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              supplierCode: true,
            },
          },
          creator: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              salesOrderItems: true,
              factoryShipmentItems: true,
            },
          },
        },
      }),
      prisma.temporaryProduct.count({ where }),
    ]);

    // 格式化响应数据
    const formattedItems = items.map(formatTemporaryProduct);

    return NextResponse.json({
      success: true,
      data: {
        items: formattedItems,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error('temporary-products-api', 'GET失败', error);

    return NextResponse.json(
      {
        success: false,
        error: '查询临时产品失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
