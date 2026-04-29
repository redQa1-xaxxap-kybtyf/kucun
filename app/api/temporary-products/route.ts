/**
 * 外采产品查询 API
 *
 * GET /api/temporary-products
 *
 * 功能:
 * - 查询外采产品列表
 * - 支持按供应商筛选
 * - 支持搜索(编码、名称、规格)
 * - 支持排序(使用次数、最后使用时间、名称)
 * - 支持分页
 *
 * 只读查询,不提供创建/编辑/删除功能(由系统自动管理)
 */

import type { Prisma } from '@prisma/client';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import {
  buildOffsetPaginationMeta,
  parseOffsetPagination,
} from '@/lib/api/pagination';
import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const temporaryProductWriteSchema = z.object({
  supplierId: z.string().min(1, '请选择供应商'),
  code: z.string().trim().min(1, '请填写产品编码').max(120),
  name: z.string().trim().min(1, '请填写产品名称').max(150),
  specification: z.string().trim().optional().nullable(),
  weight: z.coerce.number().positive().optional().nullable(),
  unit: z.string().trim().optional().default('片'),
  piecesPerUnit: z.coerce.number().int().positive().optional().default(1),
  description: z.string().trim().optional().nullable(),
  thumbnailUrl: z.string().trim().optional().nullable(),
  showInMiniProgram: z.coerce.boolean().optional().default(true),
  latestCostPrice: z.coerce.number().nonnegative().optional().nullable(),
  latestSalePrice: z.coerce.number().nonnegative().optional().nullable(),
  priceRemarks: z.string().trim().optional().nullable(),
});

type TemporaryProductWriteInput = z.infer<typeof temporaryProductWriteSchema>;

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
    _count: {
      select: { salesOrderItems: true; factoryShipmentOrderItems: true };
    };
  };
}>;

type TemporaryProductPriceInfo = {
  latestCostPrice: number | null;
  latestSalePrice: number | null;
  latestPriceSource: string | null;
  latestPriceOrderNumber: string | null;
  latestPriceDate: Date | null;
};

function toNumberOrNull(value: Prisma.Decimal | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function chooseLatestPriceInfo(
  current: TemporaryProductPriceInfo | undefined,
  next: TemporaryProductPriceInfo
) {
  if (!current) return next;
  const currentTime = current.latestPriceDate?.getTime() ?? 0;
  const nextTime = next.latestPriceDate?.getTime() ?? 0;
  return nextTime > currentTime ? next : current;
}

function buildManualPriceInfo(
  item: TempProductWithRelations
): TemporaryProductPriceInfo | undefined {
  const latestCostPrice = toNumberOrNull(item.latestCostPrice);
  const latestSalePrice = toNumberOrNull(item.latestSalePrice);

  if (latestCostPrice === null && latestSalePrice === null) return undefined;

  return {
    latestCostPrice,
    latestSalePrice,
    latestPriceSource: '手动维护',
    latestPriceOrderNumber: null,
    latestPriceDate: item.priceUpdatedAt ?? item.updatedAt,
  };
}

async function loadLatestPriceInfoMap(productIds: string[]) {
  const priceInfoMap = new Map<string, TemporaryProductPriceInfo>();
  if (productIds.length === 0) return priceInfoMap;

  const [salesItems, factoryItems] = await Promise.all([
    prisma.salesOrderItem.findMany({
      where: {
        temporaryProductId: { in: productIds },
      },
      select: {
        temporaryProductId: true,
        unitCost: true,
        unitPrice: true,
        salesOrder: {
          select: {
            orderNumber: true,
            orderDate: true,
          },
        },
      },
      orderBy: [{ salesOrder: { orderDate: 'desc' } }],
    }),
    prisma.factoryShipmentOrderItem.findMany({
      where: {
        temporaryProductId: { in: productIds },
      },
      select: {
        temporaryProductId: true,
        unitCost: true,
        unitPrice: true,
        createdAt: true,
        factoryShipmentOrder: {
          select: {
            orderNumber: true,
            shipmentDate: true,
            createdAt: true,
          },
        },
      },
      orderBy: [
        { factoryShipmentOrder: { shipmentDate: 'desc' } },
        { createdAt: 'desc' },
      ],
    }),
  ]);

  for (const item of salesItems) {
    if (!item.temporaryProductId || priceInfoMap.has(item.temporaryProductId)) {
      continue;
    }

    priceInfoMap.set(item.temporaryProductId, {
      latestCostPrice: toNumberOrNull(item.unitCost),
      latestSalePrice: toNumberOrNull(item.unitPrice),
      latestPriceSource: '销售订单',
      latestPriceOrderNumber: item.salesOrder.orderNumber,
      latestPriceDate: item.salesOrder.orderDate,
    });
  }

  for (const item of factoryItems) {
    if (!item.temporaryProductId) continue;

    const priceInfo = {
      latestCostPrice:
        toNumberOrNull(item.unitCost) ?? toNumberOrNull(item.unitPrice),
      latestSalePrice: toNumberOrNull(item.unitPrice),
      latestPriceSource: '厂家发货',
      latestPriceOrderNumber: item.factoryShipmentOrder.orderNumber,
      latestPriceDate:
        item.factoryShipmentOrder.shipmentDate ??
        item.factoryShipmentOrder.createdAt ??
        item.createdAt,
    };

    priceInfoMap.set(
      item.temporaryProductId,
      chooseLatestPriceInfo(
        priceInfoMap.get(item.temporaryProductId),
        priceInfo
      )
    );
  }

  return priceInfoMap;
}

function formatTemporaryProduct(
  item: TempProductWithRelations,
  priceInfo?: TemporaryProductPriceInfo
) {
  const latestPriceInfo = chooseLatestPriceInfo(
    priceInfo,
    buildManualPriceInfo(item) ?? {
      latestCostPrice: null,
      latestSalePrice: null,
      latestPriceSource: null,
      latestPriceOrderNumber: null,
      latestPriceDate: null,
    }
  );

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
    description: item.description,
    thumbnailUrl: item.thumbnailUrl,
    images: item.images,
    showInMiniProgram: item.showInMiniProgram,
    usageCount: item.usageCount,
    lastUsedAt: item.lastUsedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    creatorName: item.creator?.name || null,
    salesOrderCount: item._count.salesOrderItems,
    factoryShipmentCount: item._count.factoryShipmentOrderItems,
    totalUsageCount:
      item._count.salesOrderItems + item._count.factoryShipmentOrderItems,
    latestCostPrice: latestPriceInfo?.latestCostPrice ?? null,
    latestSalePrice: latestPriceInfo?.latestSalePrice ?? null,
    latestPriceSource: latestPriceInfo?.latestPriceSource ?? null,
    latestPriceOrderNumber: latestPriceInfo?.latestPriceOrderNumber ?? null,
    latestPriceDate: latestPriceInfo?.latestPriceDate ?? null,
    priceRemarks: item.priceRemarks,
  };
}

function normalizeNullableText(value?: string | null) {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

function buildTemporaryProductWriteData(data: TemporaryProductWriteInput) {
  const now = new Date();
  const hasPrice =
    (data.latestCostPrice !== null && data.latestCostPrice !== undefined) ||
    (data.latestSalePrice !== null && data.latestSalePrice !== undefined) ||
    normalizeNullableText(data.priceRemarks) !== null;

  return {
    supplierId: data.supplierId,
    code: data.code.trim(),
    name: data.name.trim(),
    specification: normalizeNullableText(data.specification),
    weight: data.weight ?? null,
    unit: data.unit?.trim() || '片',
    piecesPerUnit: data.piecesPerUnit ?? 1,
    description: normalizeNullableText(data.description),
    thumbnailUrl: normalizeNullableText(data.thumbnailUrl),
    showInMiniProgram: data.showInMiniProgram,
    latestCostPrice: data.latestCostPrice ?? null,
    latestSalePrice: data.latestSalePrice ?? null,
    priceUpdatedAt: hasPrice ? now : null,
    priceRemarks: normalizeNullableText(data.priceRemarks),
  };
}

async function createPriceHistoryIfNeeded(input: {
  temporaryProductId: string;
  supplierId: string;
  costPrice?: number | null;
  salePrice?: number | null;
  remarks?: string | null;
  userId?: string | null;
}) {
  const hasPrice =
    (input.costPrice !== null && input.costPrice !== undefined) ||
    (input.salePrice !== null && input.salePrice !== undefined) ||
    normalizeNullableText(input.remarks) !== null;

  if (!hasPrice) return;

  await prisma.temporaryProductPriceHistory.create({
    data: {
      temporaryProductId: input.temporaryProductId,
      supplierId: input.supplierId,
      costPrice: input.costPrice ?? null,
      salePrice: input.salePrice ?? null,
      sourceType: 'manual',
      remarks: normalizeNullableText(input.remarks),
      createdBy: input.userId ?? null,
    },
  });
}

async function handleGetTemporaryProducts(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // 查询参数
    const supplierId = searchParams.get('supplierId') || undefined;
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'usageCount';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const { page, limit, skip } = parseOffsetPagination(searchParams);

    // 查询条件与排序
    const where = buildWhere(supplierId, search);
    const orderBy: Prisma.TemporaryProductOrderByWithRelationInput[] = [
      getOrderBy(sortBy, sortOrder),
      { id: 'desc' },
    ];

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
              factoryShipmentOrderItems: true,
            },
          },
        },
      }),
      prisma.temporaryProduct.count({ where }),
    ]);

    const priceInfoMap = await loadLatestPriceInfoMap(
      items.map(item => item.id)
    );

    // 格式化响应数据
    const formattedItems = items.map(item =>
      formatTemporaryProduct(item, priceInfoMap.get(item.id))
    );

    return NextResponse.json({
      success: true,
      data: {
        items: formattedItems,
        pagination: buildOffsetPaginationMeta({
          page,
          limit,
          total,
          hasMore: skip + formattedItems.length < total,
        }),
      },
    });
  } catch (error) {
    logger.error('temporary-products-api', 'GET失败', error);

    return NextResponse.json(
      {
        success: false,
        error: '查询外采产品失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

export const GET = withAuth(handleGetTemporaryProducts, {
  permissions: ['products:view'],
});

export const POST = withAuth(
  async (request, { user }) => {
    try {
      const body = await request.json();
      const parsed = temporaryProductWriteSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          {
            success: false,
            error: parsed.error.issues[0]?.message || '参数不正确',
          },
          { status: 400 }
        );
      }

      const data = buildTemporaryProductWriteData(parsed.data);
      const product = await prisma.temporaryProduct.create({
        data: {
          ...data,
          createdBy: user.id,
          usageCount: 0,
        },
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
              factoryShipmentOrderItems: true,
            },
          },
        },
      });

      await createPriceHistoryIfNeeded({
        temporaryProductId: product.id,
        supplierId: product.supplierId,
        costPrice: parsed.data.latestCostPrice,
        salePrice: parsed.data.latestSalePrice,
        remarks: parsed.data.priceRemarks,
        userId: user.id,
      });

      return NextResponse.json(
        {
          success: true,
          data: formatTemporaryProduct(product),
        },
        { status: 201 }
      );
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        return NextResponse.json(
          {
            success: false,
            error: '该供应商下已存在相同编码的外采产品',
          },
          { status: 409 }
        );
      }

      logger.error('temporary-products-api', 'POST失败', error);
      return NextResponse.json(
        {
          success: false,
          error: '创建外采产品失败',
          message: error instanceof Error ? error.message : '未知错误',
        },
        { status: 500 }
      );
    }
  },
  { permissions: ['products:create'] }
);
