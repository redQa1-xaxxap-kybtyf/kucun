import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { buildCacheKey, getOrSetJSON } from '@/lib/cache/cache';
import { prisma } from '@/lib/db';
import { cacheConfig } from '@/lib/env';
import { RateLimitType, withRateLimit } from '@/lib/rate-limit';
import {
  getBatchPiecesPerUnitFromMap,
  getUniformPiecesPerUnit,
  loadBatchPiecesPerUnitMap,
} from '@/lib/utils/batch-pieces-per-unit';
import { formatPieceSummary } from '@/lib/utils/piece-calculation';
import {
  inventoryAvailabilityCheckSchema,
  type InventoryAvailabilityCheckInput,
} from '@/lib/validations/inventory';

type AvailabilityParams = InventoryAvailabilityCheckInput;

type InventoryRecord = {
  id: string;
  productId: string;
  quantity: number;
  reservedQuantity: number;
  batchNumber: string | null;
  variantId: string | null;
  location: string | null;
  product: {
    id: string;
    name: string;
    code: string;
    status: string;
    unit: string;
    piecesPerUnit: number | null;
  };
};

type AllocationItem = {
  inventoryId: string;
  batchNumber: string | null;
  variantId: string | null;
  location: string | null;
  allocatedQuantity: number;
  availableInBatch: number;
};

/**
 * 计算分配方案
 */
function calculateAllocationPlan(
  inventoryRecords: InventoryRecord[],
  quantity: number
): AllocationItem[] {
  const allocationPlan: AllocationItem[] = [];
  let remainingQuantity = quantity;

  for (const record of inventoryRecords) {
    const recordAvailable = record.quantity - record.reservedQuantity;
    if (recordAvailable > 0 && remainingQuantity > 0) {
      const allocatedQuantity = Math.min(recordAvailable, remainingQuantity);
      allocationPlan.push({
        inventoryId: record.id,
        batchNumber: record.batchNumber,
        variantId: record.variantId,
        location: record.location,
        allocatedQuantity,
        availableInBatch: recordAvailable,
      });
      remainingQuantity -= allocatedQuantity;
    }
  }

  return allocationPlan;
}

type AvailabilityResult = {
  available: boolean;
  currentStock: number;
  availableStock: number;
  reservedStock: number;
  requestedQuantity?: number;
  message: string;
  details?: AllocationItem[];
};

/**
 * 检查库存可用性
 */
async function checkInventoryAvailability(
  params: AvailabilityParams
): Promise<AvailabilityResult> {
  const { productId, quantity, variantId, batchNumber, location } = params;

  // 构建查询条件
  const whereCondition: {
    productId: string;
    quantity: { gt: number };
    variantId?: string;
    batchNumber?: string;
    location?: string;
  } = {
    productId,
    quantity: { gt: 0 },
  };

  if (variantId) {
    whereCondition.variantId = variantId;
  }
  if (batchNumber) {
    whereCondition.batchNumber = batchNumber;
  }
  if (location) {
    whereCondition.location = location;
  }

  // 查询匹配的库存记录
  const inventoryRecords = await prisma.inventory.findMany({
    where: whereCondition,
    include: {
      product: {
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
          unit: true,
          piecesPerUnit: true,
        },
      },
    },
    orderBy: [{ updatedAt: 'asc' }],
    take: 5000,
  });

  // 检查产品是否存在且状态正常
  if (inventoryRecords.length === 0) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { name: true, code: true, status: true },
    });

    if (!product) {
      return {
        available: false,
        currentStock: 0,
        availableStock: 0,
        reservedStock: 0,
        message: '产品不存在',
        details: [],
      };
    }

    if (product.status !== 'active') {
      return {
        available: false,
        currentStock: 0,
        availableStock: 0,
        reservedStock: 0,
        message: '产品已停用',
        details: [],
      };
    }

    return {
      available: false,
      currentStock: 0,
      availableStock: 0,
      reservedStock: 0,
      message: '无匹配的库存记录',
      details: [],
    };
  }

  // 计算总库存和可用库存
  const totalStock = inventoryRecords.reduce(
    (sum, record) => sum + record.quantity,
    0
  );
  const reservedStock = inventoryRecords.reduce(
    (sum, record) => sum + record.reservedQuantity,
    0
  );
  const availableStock = totalStock - reservedStock;

  // 检查是否有足够的可用库存
  const available = availableStock >= quantity;

  // 如果可用，计算具体的分配方案
  const allocationPlan = available
    ? calculateAllocationPlan(inventoryRecords, quantity)
    : [];

  const product = inventoryRecords[0]?.product;
  const unitLabel =
    typeof product?.unit === 'string' && product.unit.trim() === 'piece'
      ? '件'
      : typeof product?.unit === 'string' && product.unit.trim() === 'sheet'
        ? '片'
        : typeof product?.unit === 'string' && product.unit.trim()
          ? product.unit.trim()
          : '片';
  const batchPiecesPerUnitMap = await loadBatchPiecesPerUnitMap(
    inventoryRecords.map(record => ({
      productId: record.productId,
      variantId: record.variantId,
      batchNumber: record.batchNumber,
    }))
  );
  const piecesPerUnit =
    getUniformPiecesPerUnit(
      inventoryRecords.map(record => {
        const batchPiecesPerUnit = getBatchPiecesPerUnitFromMap(
          batchPiecesPerUnitMap,
          {
            productId: record.productId,
            variantId: record.variantId,
            batchNumber: record.batchNumber,
          }
        );

        return batchPiecesPerUnit ?? record.product?.piecesPerUnit;
      })
    ) ?? 0;

  const formatForMessage = (value: number) =>
    piecesPerUnit > 0
      ? formatPieceSummary(value, piecesPerUnit, {
          fallbackUnit: '片',
          zeroDisplay: '0片',
          includeApprox: unitLabel === '件',
        })
      : `${value}片`;

  return {
    available,
    currentStock: totalStock,
    availableStock,
    reservedStock,
    requestedQuantity: quantity,
    message: available
      ? '库存充足'
      : `库存不足，需要 ${formatForMessage(quantity)}，可用 ${formatForMessage(availableStock)}`,
    details: allocationPlan,
  };
}

/**
 * 库存可用性检查API
 * POST /api/inventory/check-availability
 */
const postInventoryAvailabilityHandler = withAuth(
  async (request: NextRequest) => {
    const body = await request.json();

    // 验证请求数据
    const validatedData = inventoryAvailabilityCheckSchema.parse(body);

    // 构建缓存键
    const cacheKey = buildCacheKey('inventory:availability', validatedData);

    // 从缓存获取或查询数据库
    const availabilityResult = await getOrSetJSON(
      cacheKey,
      async () => await checkInventoryAvailability(validatedData),
      cacheConfig.inventoryTtl
    );

    return NextResponse.json({
      success: true,
      data: availabilityResult,
    });
  }
);

export const POST = withRateLimit(RateLimitType.WRITE)(
  postInventoryAvailabilityHandler
);
