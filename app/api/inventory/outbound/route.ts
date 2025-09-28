import { getServerSession } from 'next-auth';
import { type NextRequest, NextResponse } from 'next/server';

import { authOptions } from '@/lib/auth';
import { invalidateInventoryCache } from '@/lib/cache/inventory-cache';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { outboundCreateSchema } from '@/lib/validations/inventory-operations';
import { publishWs } from '@/lib/ws/ws-server';

/**
 * 出库操作API
 * POST /api/inventory/outbound
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
    const validationResult = outboundCreateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '出库数据格式不正确',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const {
      productId,
      quantity,
      batchNumber,
      variantId, // 修复：使用正确的字段名
    } = validationResult.data;

    // 使用事务确保数据一致性
    const result = await prisma.$transaction(async tx => {
      // 1. 查找可用库存 - 修复：使用variantId精确定位库存记录
      const whereCondition: {
        productId: string;
        variantId?: string;
        batchNumber?: string;
      } = {
        productId,
      };

      // 修复：同时提供variantId和batchNumber时，应同时应用两个过滤条件
      if (variantId) {
        whereCondition.variantId = variantId;
      }
      if (batchNumber) {
        whereCondition.batchNumber = batchNumber;
      }

      const availableInventory = await tx.inventory.findFirst({
        where: whereCondition,
        orderBy: [
          { updatedAt: 'asc' }, // 按更新时间排序，优先使用较早的库存
        ],
      });

      if (!availableInventory) {
        throw new Error('未找到匹配的库存记录');
      }

      // 检查可用库存是否足够（总库存 - 预留库存）
      const availableQuantity =
        availableInventory.quantity - availableInventory.reservedQuantity;
      if (availableQuantity < quantity) {
        throw new Error(
          `可用库存不足，当前可用库存：${availableQuantity}，需要出库：${quantity}`
        );
      }

      // 2. 更新库存数量 - 修复：同时更新quantity和reservedQuantity
      const updatedInventory = await tx.inventory.update({
        where: { id: availableInventory.id },
        data: {
          quantity: availableInventory.quantity - quantity,
          // 修复：出库时同步减少预留量，确保预留量不超过实际库存
          reservedQuantity: Math.max(
            0,
            Math.min(
              availableInventory.reservedQuantity,
              availableInventory.quantity - quantity
            )
          ),
          updatedAt: new Date(),
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });

      // 3. 创建出库记录 - 修复：现在数据库中已有OutboundRecord表
      const recordNumber = `OUT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-6)}`;

      await tx.outboundRecord.create({
        data: {
          recordNumber,
          productId,
          inventoryId: availableInventory.id,
          quantity,
          reason: validationResult.data.reason || 'manual_outbound',
          batchNumber: availableInventory.batchNumber,
          variantId: availableInventory.variantId,
          notes: validationResult.data.notes,
          operatorId: 'system', // TODO: 使用实际用户ID
        },
      });

      return updatedInventory;
    });

    // 清除相关缓存
    await invalidateInventoryCache(productId);

    // WebSocket 推送更新
    publishWs('inventory', {
      type: 'outbound',
      productId,
      quantity,
      inventoryId: result.id,
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: '出库操作成功',
    });
  } catch (error) {
    console.error('出库操作失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '出库操作失败',
      },
      { status: 500 }
    );
  }
}
