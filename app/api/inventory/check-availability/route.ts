import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { ApiError } from '@/lib/api/errors';
import { withErrorHandling } from '@/lib/api/middleware';
import { authOptions } from '@/lib/auth';
import { buildCacheKey, getOrSetJSON } from '@/lib/cache/cache';
import { prisma } from '@/lib/db';
import { cacheConfig, env } from '@/lib/env';

// 库存可用性检查请求schema
const checkAvailabilitySchema = z.object({
  productId: z.string().min(1, '产品ID不能为空'),
  quantity: z.number().min(1, '数量必须大于0'),
  variantId: z.string().optional(),
  batchNumber: z.string().optional(),
  location: z.string().optional(),
});

type AvailabilityParams = z.infer<typeof checkAvailabilitySchema>;

type InventoryRecord = {
  id: string;
  quantity: number;
  reservedQuantity: number;
  batchNumber: string | null;
  variantId: string | null;
  location: string | null;
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
  totalAvailable: number;
  requested: number;
  shortfall: number;
  allocationPlan: AllocationItem[];
  message: string;
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

  if (variantId) {whereCondition.variantId = variantId;}
  if (batchNumber) {whereCondition.batchNumber = batchNumber;}
  if (location) {whereCondition.location = location;}

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
        },
      },
    },
    orderBy: [{ updatedAt: 'asc' }],
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

  return {
    available,
    currentStock: totalStock,
    availableStock,
    reservedStock,
    requestedQuantity: quantity,
    message: available
      ? '库存充足'
      : `库存不足，需要 ${quantity} 件，可用 ${availableStock} 件`,
    details: inventoryRecords.map(record => ({
      inventoryId: record.id,
      batchNumber: record.batchNumber,
      variantId: record.variantId,
      location: record.location,
      quantity: record.quantity,
      reservedQuantity: record.reservedQuantity,
      availableQuantity: record.quantity - record.reservedQuantity,
    })),
    allocationPlan,
  };
}

/**
 * 库存可用性检查API
 * POST /api/inventory/check-availability
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  // 验证用户权限 (开发环境下临时绕过)
  if (env.NODE_ENV !== 'development') {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw ApiError.unauthorized();
    }
  }

  const body = await request.json();

  // 验证请求数据
  const validatedData = checkAvailabilitySchema.parse(body);

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
});
