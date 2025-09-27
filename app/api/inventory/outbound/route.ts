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
      reason,
      batchNumber,
      variantId, // 修复：使用正确的字段名
      notes,
    } = validationResult.data;

    // 使用事务确保数据一致性
    const result = await prisma.$transaction(async tx => {
      // 1. 查找可用库存
      const availableInventory = await tx.inventory.findFirst({
        where: {
          productId,
          quantity: { gte: quantity },
          ...(batchNumber && { batchNumber }),
          ...(variantId && { variantId }), // 修复：使用正确的字段名
        },
        orderBy: [
          { updatedAt: 'asc' }, // 修复：使用存在的字段，按更新时间排序
        ],
      });

      if (!availableInventory) {
        throw new Error('库存不足或未找到匹配的库存记录');
      }

      // 2. 更新库存数量
      const updatedInventory = await tx.inventory.update({
        where: { id: availableInventory.id },
        data: {
          quantity: availableInventory.quantity - quantity,
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

      // 3. 创建出库记录 - 暂时注释，因为数据库中没有outboundRecord表
      // TODO: 需要在数据库schema中添加OutboundRecord表
      // await tx.outboundRecord.create({
      //   data: {
      //     productId,
      //     inventoryId: availableInventory.id,
      //     quantity,
      //     reason: reason || 'manual_outbound',
      //     batchNumber: availableInventory.batchNumber,
      //     variantId: availableInventory.variantId,
      //     notes,
      //     operatorId: 'system', // TODO: 使用实际用户ID
      //     createdAt: new Date(),
      //   },
      // });

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
