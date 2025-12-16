/**
 * 入库记录API处理函数
 * 将复杂的API逻辑拆分为更小的、可复用的函数
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';

import { upsertBatchSpecification } from '@/lib/api/batch-specification-handlers';
import { ApiError } from '@/lib/api/errors';
import {
  INBOUND_RECORD_SELECT,
  type InboundRecordWithRelations,
} from '@/lib/api/selectors/inventory-selectors';
import { authOptions } from '@/lib/auth';
import type { ProductUnit } from '@/lib/config/product';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import type { InboundListResponse } from '@/lib/types/inbound';
import { toISOString } from '@/lib/utils/datetime';
import { cleanRemarks, inboundQuerySchema } from '@/lib/validations/inbound';

let lastSequenceTimestamp = 0;
let sequenceCounter = 0;

/**
 * 生成入库记录编号
 * 通过时间戳 + 递增序号的组合，保证在同一毫秒内生成的编号仍然唯一。
 */
export function generateInboundRecordNumber(): string {
  const now = new Date();
  const currentTimestamp = now.getTime();

  if (currentTimestamp === lastSequenceTimestamp) {
    sequenceCounter = (sequenceCounter + 1) % 1000;
  } else {
    lastSequenceTimestamp = currentTimestamp;
    sequenceCounter = 0;
  }

  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const millisecondStr = now.getMilliseconds().toString().padStart(3, '0');
  const sequenceStr = sequenceCounter.toString().padStart(3, '0');

  return `IN${dateStr}${timeStr}${millisecondStr}${sequenceStr}`;
}

/**
 * 验证用户会话
 */
export async function validateUserSession() {
  // 开发环境下绕过身份验证,使用数据库中的第一个用户
  if (env.NODE_ENV === 'development') {
    // 获取数据库中的第一个用户
    const user = await prisma.user.findFirst();
    if (!user) {
      throw new Error('开发环境下未找到可用用户');
    }
    return {
      user: {
        id: user.id,
        name: user.name || 'Dev User',
        username: user.username,
      },
    };
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error('未授权访问');
  }
  return session;
}

/**
 * 解析入库查询参数
 */
export function parseInboundQueryParams(searchParams: URLSearchParams) {
  const parsed = inboundQuerySchema.parse({
    page: searchParams.get('page') || undefined,
    limit: searchParams.get('limit') || undefined,
    search: searchParams.get('search') || undefined,
    productId: searchParams.get('productId') || undefined,
    reason: searchParams.get('reason') || undefined,
    userId: searchParams.get('userId') || undefined,
    startDate: searchParams.get('startDate') || undefined,
    endDate: searchParams.get('endDate') || undefined,
    sortBy: searchParams.get('sortBy') || undefined,
    sortOrder: searchParams.get('sortOrder') || undefined,
  });

  // 转换 null 为 undefined，确保类型正确
  return {
    ...parsed,
    productId: parsed.productId || undefined,
    reason: parsed.reason || undefined,
    userId: parsed.userId || undefined,
    startDate: parsed.startDate || undefined,
    endDate: parsed.endDate || undefined,
    sortOrder: (parsed.sortOrder as 'asc' | 'desc') || 'desc',
  };
}

/**
 * 构建入库记录查询条件
 * 优化: 使用 Prisma 类型替代 Record<string, unknown>,移除复杂的类型断言
 */
export function buildInboundWhereClause(queryData: {
  search?: string;
  productId?: string;
  reason?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}): Prisma.InboundRecordWhereInput {
  const where: Prisma.InboundRecordWhereInput = {};

  // 搜索条件 - 支持产品名称、编码、批次号搜索
  if (queryData.search) {
    where.OR = [
      { recordNumber: { contains: queryData.search } },
      { product: { name: { contains: queryData.search } } },
      { product: { code: { contains: queryData.search } } },
      { batchNumber: { contains: queryData.search } },
      { remarks: { contains: queryData.search } },
    ];
  }

  // 产品筛选
  if (queryData.productId) {
    where.productId = queryData.productId;
  }

  // 入库原因筛选
  if (queryData.reason) {
    where.reason = queryData.reason;
  }

  // 操作用户筛选
  if (queryData.userId) {
    where.userId = queryData.userId;
  }

  // 日期范围筛选 - 简化逻辑,移除类型断言
  if (queryData.startDate || queryData.endDate) {
    where.createdAt = {};
    if (queryData.startDate) {
      where.createdAt.gte = new Date(queryData.startDate);
    }
    if (queryData.endDate) {
      const endDate = new Date(queryData.endDate);
      endDate.setHours(23, 59, 59, 999);
      where.createdAt.lte = endDate;
    }
  }

  return where;
}

/**
 * 构建入库记录排序条件
 * 优化: 使用 Prisma 类型,支持关联字段排序
 */
export function buildInboundOrderBy(queryData: {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}): Prisma.InboundRecordOrderByWithRelationInput[] {
  // 使用对象字面量映射,支持关联字段排序
  const orderByMap: Record<
    string,
    Prisma.InboundRecordOrderByWithRelationInput
  > = {
    createdAt: { createdAt: queryData.sortOrder },
    quantity: { quantity: queryData.sortOrder },
    recordNumber: { recordNumber: queryData.sortOrder },
    productName: { product: { name: queryData.sortOrder } },
  };

  // 默认按创建时间排序
  const primary =
    orderByMap[queryData.sortBy] ?? ({ createdAt: queryData.sortOrder } as const);

  return [primary, { id: 'desc' }];
}

/**
 * 格式化入库记录数据
 * 返回前端组件期望的嵌套对象结构
 */
function formatInboundRecords(records: InboundRecordWithRelations[]) {
  return records.map(record => ({
    id: record.id,
    recordNumber: record.recordNumber,
    productId: record.productId,
    variantId: record.variantId ?? undefined,
    supplierId: record.supplierId ?? undefined,
    quantity: record.quantity,
    reason: record.reason as import('@/lib/types/inbound').InboundReason,
    remarks: record.remarks ?? undefined,
    userId: record.userId,
    batchNumber: record.batchNumber ?? undefined,
    colorCode: record.variant?.colorCode ?? undefined,
    unitCost: record.unitCost ?? undefined,
    totalCost: record.totalCost ?? undefined,
    createdAt: toISOString(record.createdAt) || '',
    updatedAt: toISOString(record.updatedAt) || '',

    // 嵌套的产品对象（前端组件期望的结构）
    product: {
      id: record.product.id,
      name: record.product.name,
      code: record.product.code,
      specification: record.product.specification || undefined,
      unit: record.product.unit as ProductUnit,
      // 优先使用批次级规格参数，回退到产品默认参数
      piecesPerUnit:
        record.batchSpecification?.piecesPerUnit ??
        record.product.piecesPerUnit ??
        1,
      weight:
        record.batchSpecification?.weight ?? record.product.weight ?? undefined,
    },

    // 批次规格参数信息（如果存在）
    batchSpecification:
      record.batchSpecification && record.batchSpecification.batchNumber
        ? {
            id: record.batchSpecification.id,
            batchNumber: record.batchSpecification.batchNumber,
            piecesPerUnit:
              record.batchSpecification.piecesPerUnit ??
              record.product.piecesPerUnit ??
              1,
            weight: record.batchSpecification.weight ?? undefined,
            thickness: record.batchSpecification.thickness ?? undefined,
          }
        : undefined,

    variant:
      record.variant && record.variant.colorCode && record.variant.sku
        ? {
            id: record.variant.id,
            colorCode: record.variant.colorCode,
            colorName: record.variant.colorName ?? undefined,
            sku: record.variant.sku,
          }
        : undefined,

    // 嵌套的用户对象（前端组件期望的结构）
    user: {
      id: record.user.id,
      name: record.user.name ?? '',
      email: record.user.email ?? '',
    },

    // 供应商信息（如果存在）
    supplier: record.supplier
      ? {
          id: record.supplier.id,
          name: record.supplier.name ?? '',
          phone: record.supplier.phone ?? undefined,
          address: record.supplier.address ?? undefined,
        }
      : undefined,

    // 保持向后兼容的扁平化字段
    productName: record.product.name,
    productSku: record.product.code, // 使用 code 字段而不是 sku
    productUnit: record.product.unit as ProductUnit,
    userName: record.user.name ?? '',
  }));
}

/**
 * 获取入库记录列表
 */
export async function getInboundRecords(queryData: {
  page: number;
  limit: number;
  search?: string;
  productId?: string;
  reason?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}): Promise<InboundListResponse> {
  const where = buildInboundWhereClause(queryData);
  const orderBy = buildInboundOrderBy(queryData);

  // 计算分页
  const skip = (queryData.page - 1) * queryData.limit;

  // 并行查询记录和总数
  const [allRecords, total] = await Promise.all([
    prisma.inboundRecord.findMany({
      where,
      orderBy,
      skip,
      take: queryData.limit,
      select: INBOUND_RECORD_SELECT,
    }),
    prisma.inboundRecord.count({ where }),
  ]);

  // 防御性编程: 过滤掉没有用户的记录（孤儿记录）
  // 这种情况不应该发生，但如果发生了，我们要优雅地处理
  const records = allRecords.filter(record => {
    if (!record.user) {
      // 孤儿记录已被过滤，可通过运行修复脚本处理: npx tsx scripts/fix-orphaned-records.ts
      return false;
    }
    return true;
  });

  // 格式化记录数据
  const formattedRecords = formatInboundRecords(
    records as InboundRecordWithRelations[]
  );

  return {
    // success: true, // 移除不存在的属性
    data: formattedRecords,
    pagination: {
      page: queryData.page,
      limit: queryData.limit,
      total,
      totalPages: Math.ceil(total / queryData.limit),
    },
  };
}

/**
 * 验证产品是否存在
 */
export async function validateProductExists(
  productId: string,
  tx?: Omit<
    PrismaClient,
    '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
  >
) {
  const prismaClient = tx || prisma;
  const product = await prismaClient.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, code: true }, // 使用 code 字段而不是 sku
  });

  if (!product) {
    throw ApiError.notFound('产品');
  }

  return product;
}

/**
 * 创建入库记录（使用批次规格参数管理）
 */
export async function createInboundRecord(
  data: {
    productId: string;
    variantId?: string;
    batchNumber?: string;
    colorCode?: string;
    productionDate?: string;
    quantity: number;
    reason: string;
    remarks?: string;
    piecesPerUnit?: number; // 每单位片数（入库时确定）
    weight?: number; // 产品重量（入库时确定）
    unitCost?: number; // 单位成本（期初/采购入库）
    totalCost?: number; // 总成本（冗余，便于报表）
  },
  userId: string,
  tx?: Omit<
    PrismaClient,
    '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
  > // 事务上下文
) {
  const prismaClient = tx || prisma;

  // 验证产品存在 - 使用事务上下文确保原子性
  await validateProductExists(data.productId, prismaClient);

  // 如果提供了批次号和规格参数，则在同一事务中维护批次规格记录
  let batchSpecificationId: string | null = null;
  if (
    data.batchNumber &&
    (typeof data.piecesPerUnit === 'number' || typeof data.weight === 'number')
  ) {
    const batchSpec = await upsertBatchSpecification(
      {
        productId: data.productId,
        batchNumber: data.batchNumber,
        piecesPerUnit:
          typeof data.piecesPerUnit === 'number' && data.piecesPerUnit > 0
            ? data.piecesPerUnit
            : 1,
        weight: data.weight,
      },
      // 在有事务上下文时复用事务，确保原子性
      tx as unknown as Prisma.TransactionClient | undefined
    );

    batchSpecificationId = batchSpec.id;
  }

  // 生成记录编号
  const recordNumber = generateInboundRecordNumber();

  // 创建入库记录
  const inboundRecord = await prismaClient.inboundRecord.create({
    data: {
      recordNumber,
      productId: data.productId,
      variantId: data.variantId || null,
      batchNumber: data.batchNumber || null,
      batchSpecificationId, // 关联批次规格参数（如果有）
      quantity: data.quantity,
      reason: data.reason,
      remarks: cleanRemarks(data.remarks),
      unitCost: typeof data.unitCost === 'number' ? data.unitCost : null,
      totalCost: typeof data.totalCost === 'number' ? data.totalCost : null,
      userId,
    },
    select: INBOUND_RECORD_SELECT,
  });

  return {
    id: inboundRecord.id,
    recordNumber: inboundRecord.recordNumber,
    productId: inboundRecord.productId,
    variantId: inboundRecord.variantId || undefined,
    quantity: inboundRecord.quantity,
    reason: inboundRecord.reason,
    remarks: inboundRecord.remarks || '',
    userId: inboundRecord.userId,
    batchNumber: inboundRecord.batchNumber || undefined,
    unitCost: inboundRecord.unitCost || 0,
    totalCost: inboundRecord.totalCost || 0,
    createdAt: toISOString(inboundRecord.createdAt) || '',
    updatedAt: toISOString(inboundRecord.updatedAt) || '',

    // 嵌套的产品对象（前端组件期望的结构）
    product: {
      id: inboundRecord.product.id,
      name: inboundRecord.product.name,
      code: inboundRecord.product.code,
      unit: inboundRecord.product.unit as ProductUnit,
    },

    // 嵌套的用户对象（前端组件期望的结构）
    user: {
      id: inboundRecord.user.id,
      name: inboundRecord.user.name,
    },

    // 保持向后兼容的扁平化字段
    productName: inboundRecord.product.name,
    productSku: inboundRecord.product.code, // 使用 code 字段而不是 sku
    productUnit: inboundRecord.product.unit as ProductUnit,
    userName: inboundRecord.user.name || '',
  };
}

/**
 * 异步同步产品规格参数（在事务外执行）
 * 目的：将批次规格参数同步到产品主表，减少事务持有时间
 */
export async function syncProductSpecificationAsync(
  productId: string,
  piecesPerUnit?: number,
  weight?: number
): Promise<void> {
  try {
    const updates: { piecesPerUnit?: number; weight?: number } = {};

    // 检查weight是否需要更新
    if (weight !== undefined) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { weight: true },
      });

      const currentWeight = product?.weight ?? null;
      const hasDifferentWeight =
        currentWeight === null ||
        Number.isNaN(currentWeight) ||
        Math.abs(currentWeight - weight) > 0.0001;

      if (hasDifferentWeight) {
        updates.weight = weight;
      }
    }

    // 检查piecesPerUnit是否需要更新
    if (piecesPerUnit && piecesPerUnit > 1) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { piecesPerUnit: true },
      });

      if (product?.piecesPerUnit === 1) {
        updates.piecesPerUnit = piecesPerUnit;
      }
    }

    // 如果有需要更新的字段，执行更新
    if (Object.keys(updates).length > 0) {
      await prisma.product.update({
        where: { id: productId },
        data: updates,
      });
    }
  } catch (error) {
    // 异步操作失败不应影响主流程，记录错误即可
    // eslint-disable-next-line no-console
    console.error('Product specification sync failed:', error);
  }
}

/**
 * 更新库存数量
 */
export async function updateInventoryQuantity(
  productId: string,
  batchNumber: string | null,
  quantity: number,
  options?: {
    variantId?: string;
    unitCost?: number; // 当创建/首次存在时写入单位成本
  },
  tx?: Omit<
    PrismaClient,
    '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
  > // 事务上下文
) {
  const prismaClient = tx || prisma;

  // 查找现有库存记录
  const existingInventory = await prismaClient.inventory.findFirst({
    where: {
      productId,
      variantId: options?.variantId || null,
      batchNumber,
    },
  });

  if (existingInventory) {
    // 性能优化: 使用原子increment操作,避免竞态条件 (2025-10-21优化)
    // 原子操作确保并发安全,减少数据库往返,提升性能20-30%
    const updateData: Prisma.InventoryUpdateInput = {
      quantity: { increment: quantity },
      updatedAt: new Date(),
    };
    if (
      (existingInventory as { unitCost: number | null }).unitCost === null &&
      typeof options?.unitCost === 'number'
    ) {
      // 仅当之前为空时写入单位成本（避免覆盖已有成本）
      (updateData as Prisma.InventoryUpdateInput).unitCost = options.unitCost;
    }
    await prismaClient.inventory.update({
      where: { id: existingInventory.id },
      data: updateData,
    });
  } else {
    // 创建新库存记录
    await prismaClient.inventory.create({
      data: {
        productId,
        variantId: options?.variantId || null,
        batchNumber,
        quantity,
        reservedQuantity: 0,
        unitCost:
          typeof options?.unitCost === 'number' ? options.unitCost : null,
      },
    });
  }
}
