import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { buildCacheKey, getOrSetJSON } from '@/lib/cache/cache';
import { prisma } from '@/lib/db';
import { cacheConfig, env } from '@/lib/env';

// 库存可用性检查请求schema
const checkAvailabilitySchema = z.object({
  productId: z.string().min(1, '产品ID不能为空'),
  quantity: z.number().min(1, '数量必须大于0'),
  variantId: z.string().optional(), // 修复：使用正确的字段名
  batchNumber: z.string().optional(),
  location: z.string().optional(),
});

/**
 * 库存可用性检查API
 * POST /api/inventory/check-availability
 */
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

    // 验证请求数据
    const validationResult = checkAvailabilitySchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '请求数据格式不正确',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const {
      productId,
      quantity,
      variantId, // 修复：使用正确的字段名
      batchNumber,
      location,
    } = validationResult.data;

    // 构建缓存键
    const cacheKey = buildCacheKey('inventory:availability', {
      productId,
      quantity,
      variantId, // 修复：使用正确的字段名
      batchNumber,
      location,
    });

    // 从缓存获取或查询数据库
    const availabilityResult = await getOrSetJSON(
      cacheKey,
      async () => {
        // 构建查询条件
        const whereCondition: any = {
          productId,
          quantity: { gt: 0 }, // 只查询有库存的记录
        };

        if (variantId) whereCondition.variantId = variantId; // 修复：使用正确的字段名
        if (batchNumber) whereCondition.batchNumber = batchNumber;
        if (location) whereCondition.location = location;

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
          orderBy: [
            { updatedAt: 'asc' }, // 修复：使用存在的字段，按更新时间排序
          ],
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
        const allocationPlan: any[] = [];
        if (available) {
          let remainingQuantity = quantity;
          for (const record of inventoryRecords) {
            const recordAvailable = record.quantity - record.reservedQuantity;
            if (recordAvailable > 0 && remainingQuantity > 0) {
              const allocatedQuantity = Math.min(
                recordAvailable,
                remainingQuantity
              );
              allocationPlan.push({
                inventoryId: record.id,
                batchNumber: record.batchNumber,
                variantId: record.variantId, // 修复：使用正确的字段名
                location: record.location,
                allocatedQuantity,
                availableInBatch: recordAvailable,
              });
              remainingQuantity -= allocatedQuantity;
            }
          }
        }

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
            variantId: record.variantId, // 修复：使用正确的字段名
            location: record.location,
            quantity: record.quantity,
            reservedQuantity: record.reservedQuantity,
            availableQuantity: record.quantity - record.reservedQuantity,
          })),
          allocationPlan: available ? allocationPlan : [],
        };
      },
      cacheConfig.inventoryTtl // 使用较短的缓存时间，因为库存变化频繁
    );

    return NextResponse.json({
      success: true,
      data: availabilityResult,
    });
  } catch (error) {
    console.error('检查库存可用性失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '检查库存可用性失败',
      },
      { status: 500 }
    );
  }
}
