import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { ApiError } from '@/lib/api/errors';
import { withErrorHandling } from '@/lib/api/middleware';
import { authOptions } from '@/lib/auth';
import { invalidateInventoryCache } from '@/lib/cache/inventory-cache';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { withIdempotency } from '@/lib/utils/idempotency';
import { outboundCreateSchema } from '@/lib/validations/inventory-operations';
import { publishWs } from '@/lib/ws/ws-server';

type OutboundWhereClause = {
  OR?: Array<{
    recordNumber?: { contains: string };
    product?: { name?: { contains: string }; code?: { contains: string } };
    batchNumber?: { contains: string };
  }>;
  reason?: string;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
};

/**
 * 构建出库记录查询条件
 */
function buildOutboundWhereClause(params: {
  search?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
}): OutboundWhereClause {
  const where: OutboundWhereClause = {};

  if (params.search) {
    where.OR = [
      { recordNumber: { contains: params.search } },
      { product: { name: { contains: params.search } } },
      { product: { code: { contains: params.search } } },
      { batchNumber: { contains: params.search } },
    ];
  }

  if (params.type) {
    where.reason = params.type;
  }

  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) {
      where.createdAt.gte = new Date(params.startDate);
    }
    if (params.endDate) {
      where.createdAt.lte = new Date(params.endDate);
    }
  }

  return where;
}

type OutboundRecordWithProduct = {
  id: string;
  recordNumber: string;
  productId: string;
  quantity: number;
  reason: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  product: {
    code: string;
    name: string;
    specification: string | null;
  };
};

/**
 * 格式化出库记录数据
 */
function formatOutboundRecord(record: OutboundRecordWithProduct) {
  return {
    id: record.id,
    recordNumber: record.recordNumber,
    productId: record.productId,
    productCode: record.product.code,
    productName: record.product.name,
    productSpecification: record.product.specification,
    quantity: record.quantity,
    type: record.reason,
    reason: record.notes || undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/**
 * 获取出库记录列表
 * GET /api/inventory/outbound
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  // 验证用户权限
  if (env.NODE_ENV !== 'development') {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw ApiError.unauthorized();
    }
  }

  // 解析查询参数
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const search = searchParams.get('search') || undefined;
  const type = searchParams.get('type') || undefined;
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;

  // 构建查询条件
  const where = buildOutboundWhereClause({ search, type, startDate, endDate });

  // 计算分页
  const skip = (page - 1) * limit;

  // 并行查询记录和总数
  const [records, total] = await Promise.all([
    prisma.outboundRecord.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          select: {
            id: true,
            code: true,
            name: true,
            specification: true,
          },
        },
      },
    }),
    prisma.outboundRecord.count({ where }),
  ]);

  // 格式化数据
  const formattedRecords = records.map(formatOutboundRecord);

  return NextResponse.json({
    data: formattedRecords,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

/**
 * 执行出库事务
 * 使用乐观锁防止并发问题
 */
async function executeOutboundTransaction(
  data: {
    productId: string;
    quantity: number;
    batchNumber?: string;
    variantId?: string;
    reason?: string;
    notes?: string;
    customerId?: string;
  },
  userId: string
) {
  const {
    productId,
    quantity,
    batchNumber,
    variantId,
    reason,
    notes,
    customerId,
  } = data;

  return await prisma.$transaction(async tx => {
    // 1. 查找可用库存
    const whereCondition: {
      productId: string;
      variantId?: string;
      batchNumber?: string;
    } = { productId };

    if (variantId) {
      whereCondition.variantId = variantId;
    }
    if (batchNumber) {
      whereCondition.batchNumber = batchNumber;
    }

    const availableInventory = await tx.inventory.findFirst({
      where: whereCondition,
      orderBy: [{ updatedAt: 'asc' }],
    });

    if (!availableInventory) {
      throw new Error('未找到匹配的库存记录');
    }

    // 检查可用库存
    const availableQuantity =
      availableInventory.quantity - availableInventory.reservedQuantity;
    if (availableQuantity < quantity) {
      throw new Error(
        `可用库存不足,当前可用库存:${availableQuantity},需要出库:${quantity}`
      );
    }

    // 2. 使用乐观锁更新库存 - 确保并发安全
    const updatedCount = await tx.inventory.updateMany({
      where: {
        id: availableInventory.id,
        quantity: { gte: quantity }, // 确保库存足够
      },
      data: {
        quantity: { decrement: quantity },
        reservedQuantity: Math.max(
          0,
          Math.min(
            availableInventory.reservedQuantity,
            availableInventory.quantity - quantity
          )
        ),
        updatedAt: new Date(),
      },
    });

    if (updatedCount.count === 0) {
      throw new Error('库存不足或已被其他操作占用,请重试');
    }

    // 3. 获取更新后的库存记录
    const updatedInventory = await tx.inventory.findUnique({
      where: { id: availableInventory.id },
      include: {
        product: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    // 4. 创建出库记录
    const recordNumber = `OUT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-6)}`;

    await tx.outboundRecord.create({
      data: {
        recordNumber,
        productId,
        inventoryId: availableInventory.id,
        quantity,
        reason: reason || 'manual_outbound',
        batchNumber: availableInventory.batchNumber,
        variantId: availableInventory.variantId,
        notes,
        customerId,
        operatorId: userId,
      },
    });

    return updatedInventory;
  });
}

/**
 * 获取用户ID（开发环境或生产环境）
 */
async function getUserId(): Promise<string> {
  if (env.NODE_ENV === 'development') {
    // 开发环境下使用数据库中的第一个用户
    const user = await prisma.user.findFirst();
    if (!user) {
      throw ApiError.internalError('开发环境下未找到可用用户');
    }
    return user.id;
  } else {
    // 生产环境下验证会话
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw ApiError.unauthorized();
    }
    return session.user.id;
  }
}

/**
 * 出库操作API
 * POST /api/inventory/outbound
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  // 验证用户权限并获取用户ID
  const userId = await getUserId();

  const body = await request.json();

  // 验证请求数据
  const validatedData = outboundCreateSchema.parse(body);

  const { idempotencyKey, productId } = validatedData;

  // 使用幂等性包装器执行出库操作
  const result = await withIdempotency(
    idempotencyKey,
    'outbound',
    productId,
    userId,
    validatedData,
    async () => await executeOutboundTransaction(validatedData, userId)
  );

  // 清除相关缓存
  await invalidateInventoryCache(productId);

  // WebSocket 推送更新
  if (result) {
    publishWs('inventory', {
      type: 'outbound',
      productId,
      quantity: validatedData.quantity,
      inventoryId: result.id,
    });
  }

  return NextResponse.json({
    success: true,
    data: result,
    message: '出库操作成功',
  });
});
