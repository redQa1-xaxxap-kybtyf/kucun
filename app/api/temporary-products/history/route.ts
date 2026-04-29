import type { Prisma } from '@prisma/client';
import { type NextRequest, NextResponse } from 'next/server';

import { parseOffsetPagination } from '@/lib/api/pagination';
import { prisma } from '@/lib/db';

/**
 * GET /api/temporary-products/history
 * 查询外采产品列表（按使用频率降序排序）
 *
 * Query Parameters:
 * - supplierId: 供应商ID（可选，如果提供则只返回该供应商的外采产品）
 * - search: 搜索关键词（可选，搜索产品编码、名称和规格）
 * - page: 页码（默认1）
 * - limit: 每页数量（默认20）
 */
type TemporaryProductPriceInfo = {
  latestCostPrice: number | null;
  latestSalePrice: number | null;
  latestPriceSource: string | null;
  latestPriceOrderNumber: string | null;
  latestPriceDate: Date | null;
};

type TemporaryProductForHistory = Prisma.TemporaryProductGetPayload<{
  select: {
    id: true;
    code: true;
    name: true;
    specification: true;
    unit: true;
    weight: true;
    piecesPerUnit: true;
    description: true;
    thumbnailUrl: true;
    showInMiniProgram: true;
    latestCostPrice: true;
    latestSalePrice: true;
    priceUpdatedAt: true;
    priceRemarks: true;
    usageCount: true;
    lastUsedAt: true;
    supplierId: true;
    supplier: {
      select: {
        id: true;
        name: true;
      };
    };
  };
}>;

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
  item: TemporaryProductForHistory
): TemporaryProductPriceInfo | undefined {
  const latestCostPrice = toNumberOrNull(item.latestCostPrice);
  const latestSalePrice = toNumberOrNull(item.latestSalePrice);

  if (latestCostPrice === null && latestSalePrice === null) {
    return undefined;
  }

  return {
    latestCostPrice,
    latestSalePrice,
    latestPriceSource: '手动维护',
    latestPriceOrderNumber: null,
    latestPriceDate: item.priceUpdatedAt,
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

function formatTemporaryProductForHistory(
  product: TemporaryProductForHistory,
  priceInfo?: TemporaryProductPriceInfo
) {
  const latestPriceInfo = chooseLatestPriceInfo(
    priceInfo,
    buildManualPriceInfo(product) ?? {
      latestCostPrice: null,
      latestSalePrice: null,
      latestPriceSource: null,
      latestPriceOrderNumber: null,
      latestPriceDate: null,
    }
  );

  return {
    ...product,
    weight: toNumberOrNull(product.weight),
    latestCostPrice: latestPriceInfo?.latestCostPrice ?? null,
    latestSalePrice: latestPriceInfo?.latestSalePrice ?? null,
    latestPriceSource: latestPriceInfo?.latestPriceSource ?? null,
    latestPriceOrderNumber: latestPriceInfo?.latestPriceOrderNumber ?? null,
    latestPriceDate: latestPriceInfo?.latestPriceDate ?? null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const supplierId = searchParams.get('supplierId');
    const search = searchParams.get('search');

    let page: number;
    let limit: number;
    let skip: number;
    try {
      const parsed = parseOffsetPagination(searchParams, {
        defaultLimit: 20,
        maxLimit: 100,
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
          error: error instanceof Error ? error.message : '分页参数格式不正确',
        },
        { status: 400 }
      );
    }

    // 构建查询条件
    const where: Prisma.TemporaryProductWhereInput = {};

    if (supplierId) {
      where.supplierId = supplierId;
    }

    if (search) {
      where.OR = [
        { code: { contains: search } },
        { name: { contains: search } },
        { specification: { contains: search } },
      ];
    }

    // 查询总数
    const total = await prisma.temporaryProduct.count({ where });

    // 查询数据（按使用频率降序排序）
    const products = await prisma.temporaryProduct.findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        specification: true,
        unit: true,
        weight: true,
        piecesPerUnit: true,
        description: true,
        thumbnailUrl: true,
        showInMiniProgram: true,
        latestCostPrice: true,
        latestSalePrice: true,
        priceUpdatedAt: true,
        priceRemarks: true,
        usageCount: true,
        lastUsedAt: true,
        supplierId: true,
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { usageCount: 'desc' }, // 按使用次数降序
        { lastUsedAt: 'desc' }, // 最近使用时间降序
        { id: 'desc' },
      ],
      skip,
      take: limit,
    });

    const priceInfoMap = await loadLatestPriceInfoMap(
      products.map(product => product.id)
    );

    return NextResponse.json({
      data: products.map(product =>
        formatTemporaryProductForHistory(product, priceInfoMap.get(product.id))
      ),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('查询外采产品失败:', error);
    return NextResponse.json(
      { error: '查询外采产品失败' },
      { status: 500 }
    );
  }
}
