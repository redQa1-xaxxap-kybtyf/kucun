import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { invalidateInventoryCache } from '@/lib/cache/inventory-cache';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { generateAdjustmentNumber } from '@/lib/utils/adjustment-number-generator';
import { withIdempotency } from '@/lib/utils/idempotency';
import { inventoryAdjustSchema } from '@/lib/validations/inventory-operations';
import { publishWs } from '@/lib/ws/ws-server';

interface AdjustmentData {
  productId: string;
  adjustQuantity: number;
  reason: string;
  batchNumber?: string;
  variantId?: string;
  notes?: string;
}

/**
 * 执行库存调整事务
 */
async function executeAdjustmentTransaction(
  data: AdjustmentData,
  userId: string
) {
  const { productId, adjustQuantity, reason, batchNumber, variantId, notes } =
    data;

  // 1. 在事务外部生成调整单号（避免嵌套事务导致死锁）
  const adjustmentNumber = await generateAdjustmentNumber();

  return await prisma.$transaction(
    async tx => {
      // 2. 查找现有库存记录
      const existingInventory = await tx.inventory.findFirst({
        where: {
          productId,
          ...(batchNumber && { batchNumber }),
          ...(variantId && { variantId }),
        },
      });

      const beforeQuantity = existingInventory?.quantity || 0;
      const reservedQuantity = existingInventory?.reservedQuantity || 0;
      const afterQuantity = beforeQuantity + adjustQuantity;

      // 防止库存变为负数
      if (afterQuantity < 0) {
        throw new Error(
          `调整后库存不能为负数。当前库存: ${beforeQuantity}, 调整数量: ${adjustQuantity}`
        );
      }

      // 修复：检查调整后的可用库存是否低于预留量
      if (afterQuantity < reservedQuantity) {
        throw new Error(
          `调整后可用库存(${afterQuantity})不能低于预留数量(${reservedQuantity})。请先释放预留量或减少调整数量。`
        );
      }

      let updatedInventory;

      if (existingInventory) {
        // 更新现有库存
        updatedInventory = await tx.inventory.update({
          where: { id: existingInventory.id },
          data: { quantity: afterQuantity },
          include: {
            product: {
              select: { id: true, name: true, code: true },
            },
          },
        });
      } else {
        // 创建新的库存记录（仅当调整数量为正数时）
        if (adjustQuantity <= 0) {
          throw new Error('创建新库存记录时，调整数量必须为正数');
        }

        updatedInventory = await tx.inventory.create({
          data: {
            productId,
            quantity: adjustQuantity,
            reservedQuantity: 0,
            batchNumber,
            variantId,
          },
          include: {
            product: {
              select: { id: true, name: true, code: true },
            },
          },
        });
      }

      // 3. 创建调整记录（审计追溯）
      const adjustmentRecord = await tx.inventoryAdjustment.create({
        data: {
          adjustmentNumber,
          productId,
          variantId,
          batchNumber,
          beforeQuantity,
          adjustQuantity,
          afterQuantity,
          reason,
          notes,
          status: 'approved', // 直接审批通过，后续可改为需要审批
          operatorId: userId,
          approverId: userId, // 暂时自动审批
          approvedAt: new Date(),
        },
      });

      return { inventory: updatedInventory, adjustment: adjustmentRecord };
    },
    {
      // 修复：SQLite不支持Serializable隔离级别，根据数据库类型动态设置
      ...(process.env.DATABASE_URL?.includes('mysql') && {
        isolationLevel: 'Serializable' as const,
      }),
      timeout: 10000,
    }
  );
}

/**
 * 库存调整API
 * POST /api/inventory/adjust
 */
export async function POST(request: NextRequest) {
  try {
    // 验证用户权限并获取用户ID
    let userId: string;

    if (env.NODE_ENV === 'development') {
      // 开发环境下使用数据库中的第一个用户
      const user = await prisma.user.findFirst();
      if (!user) {
        return NextResponse.json(
          { success: false, error: '开发环境下未找到可用用户' },
          { status: 500 }
        );
      }
      userId = user.id;
    } else {
      // 生产环境下验证会话
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json(
          { success: false, error: '未授权访问' },
          { status: 401 }
        );
      }
      userId = session.user.id;
    }

    const body = await request.json();

    // 验证请求数据
    const validationResult = inventoryAdjustSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '库存调整数据格式不正确',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { idempotencyKey, productId } = validationResult.data;

    // 使用幂等性包装器执行调整操作
    const result = await withIdempotency(
      idempotencyKey,
      'adjust',
      productId,
      userId,
      validationResult.data,
      async () =>
        await executeAdjustmentTransaction(validationResult.data, userId)
    );

    // 清除相关缓存
    await invalidateInventoryCache(validationResult.data.productId);

    // WebSocket 推送更新
    publishWs('inventory', {
      type: 'adjust',
      productId: validationResult.data.productId,
      adjustQuantity: validationResult.data.adjustQuantity,
      inventoryId: result.inventory.id,
      adjustmentNumber: result.adjustment.adjustmentNumber,
    });

    return NextResponse.json({
      success: true,
      data: {
        inventory: result.inventory,
        adjustment: result.adjustment,
      },
      message: '库存调整成功',
    });
  } catch (error) {
    console.error('库存调整失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '库存调整失败',
      },
      { status: 500 }
    );
  }
}
