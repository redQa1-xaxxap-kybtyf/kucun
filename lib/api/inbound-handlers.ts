/**
 * 入库记录API处理函数
 * 将复杂的API逻辑拆分为更小的、可复用的函数
 */

import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type { InboundListResponse } from '@/lib/types/inbound';
import { toISOString } from '@/lib/utils/datetime';
import { cleanRemarks, inboundQuerySchema } from '@/lib/validations/inbound';

/**
 * 入库记录数据库查询结果类型
 * 基于实际的Prisma查询结果定义
 */
interface InboundRecordWithRelations {
  id: string;
  recordNumber: string;
  productId: string;
  quantity: number;
  reason: string;
  remarks: string | null;
  userId: string;
  colorCode: string | null;
  productionDate: Date | null;
  unitCost: number | null;
  totalCost: number | null;
  createdAt: Date;
  updatedAt: Date;
  product: {
    id: string;
    name: string;
    code: string;
    unit: string;
  };
  user: {
    id: string;
    name: string;
  };
}

/**
 * 生成入库记录编号
 */
export function generateInboundRecordNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `IN${dateStr}${timeStr}${random}`;
}

/**
 * 验证用户会话
 */
export async function validateUserSession() {
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
  return inboundQuerySchema.parse({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    search: searchParams.get('search'),
    productId: searchParams.get('productId'),
    reason: searchParams.get('reason'),
    userId: searchParams.get('userId'),
    startDate: searchParams.get('startDate'),
    endDate: searchParams.get('endDate'),
    sortBy: searchParams.get('sortBy'),
    sortOrder: searchParams.get('sortOrder'),
  });
}

/**
 * 构建入库记录查询条件
 */
export function buildInboundWhereClause(queryData: {
  search?: string;
  productId?: string;
  reason?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}) {
  const where: Record<string, unknown> = {};

  // 搜索条件 - 支持产品名称、编码、批次号搜索
  if (queryData.search) {
    where.OR = [
      { recordNumber: { contains: queryData.search } },
      { product: { name: { contains: queryData.search } } },
      { product: { code: { contains: queryData.search } } }, // 使用 code 字段而不是 sku
      { batchNumber: { contains: queryData.search } }, // 新增批次号搜索
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

  // 日期范围筛选
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
 */
export function buildInboundOrderBy(queryData: {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}) {
  const orderBy: Record<string, 'asc' | 'desc'> = {};
  orderBy[queryData.sortBy] = queryData.sortOrder;
  return orderBy;
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
    quantity: record.quantity,
    reason: record.reason,
    remarks: record.remarks || '',
    userId: record.userId,
    batchNumber: record.batchNumber || '', // 新增批次号字段
    colorCode: record.colorCode || '',
    productionDate: record.productionDate
      ? toISOString(record.productionDate)?.split('T')[0] || ''
      : '',
    unitCost: record.unitCost || 0,
    totalCost: record.totalCost || 0,
    createdAt: toISOString(record.createdAt) || '',
    updatedAt: toISOString(record.updatedAt) || '',

    // 嵌套的产品对象（前端组件期望的结构）
    product: {
      id: record.product.id,
      name: record.product.name,
      code: record.product.code,
      unit: record.product.unit,
      // 优先使用批次级规格参数，回退到产品默认参数
      piecesPerUnit:
        record.batchSpecification?.piecesPerUnit ||
        record.product.piecesPerUnit,
      weight: record.batchSpecification?.weight || record.product.weight,
    },

    // 批次规格参数信息（如果存在）
    batchSpecification: record.batchSpecification
      ? {
          id: record.batchSpecification.id,
          piecesPerUnit: record.batchSpecification.piecesPerUnit,
          weight: record.batchSpecification.weight,
          thickness: record.batchSpecification.thickness,
        }
      : undefined,

    // 嵌套的用户对象（前端组件期望的结构）
    user: {
      id: record.user.id,
      name: record.user.name,
    },

    // 保持向后兼容的扁平化字段
    productName: record.product.name,
    productSku: record.product.code, // 使用 code 字段而不是 sku
    productUnit: record.product.unit,
    userName: record.user.name || '',
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
  const [records, total] = await Promise.all([
    prisma.inboundRecord.findMany({
      where,
      orderBy,
      skip,
      take: queryData.limit,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            code: true, // 使用 code 字段而不是 sku
            unit: true,
            piecesPerUnit: true, // 产品默认每单位片数
            weight: true, // 产品默认重量
          },
        },
        batchSpecification: {
          select: {
            id: true,
            piecesPerUnit: true, // 批次级每单位片数
            weight: true, // 批次级重量
            thickness: true, // 批次级厚度
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.inboundRecord.count({ where }),
  ]);

  // 格式化记录数据
  const formattedRecords = formatInboundRecords(records);

  return {
    success: true,
    data: formattedRecords,
    pagination: {
      page: queryData.page,
      limit: queryData.limit,
      total,
      pages: Math.ceil(total / queryData.limit),
    },
  };
}

/**
 * 验证产品是否存在
 */
export async function validateProductExists(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, code: true }, // 使用 code 字段而不是 sku
  });

  if (!product) {
    throw new Error('产品不存在');
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
  },
  userId: string,
  tx?: any // 事务上下文
) {
  // 验证产品存在
  await validateProductExists(data.productId);

  const prismaClient = tx || prisma;
  let batchSpecificationId: string | null = null;

  // 如果提供了批次号和规格参数，创建或更新批次规格参数
  if (data.batchNumber && (data.piecesPerUnit || data.weight)) {
    const { upsertBatchSpecification } = await import(
      './batch-specification-handlers'
    );

    const batchSpec = await upsertBatchSpecification(
      {
        productId: data.productId,
        batchNumber: data.batchNumber,
        piecesPerUnit: data.piecesPerUnit || 1,
        weight: data.weight,
      },
      prismaClient
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
      batchSpecificationId, // 关联批次规格参数
      quantity: data.quantity,
      reason: data.reason,
      remarks: cleanRemarks(data.remarks),
      userId,
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          code: true, // 使用 code 字段而不是 sku
          unit: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return {
    id: inboundRecord.id,
    recordNumber: inboundRecord.recordNumber,
    productId: inboundRecord.productId,
    quantity: inboundRecord.quantity,
    reason: inboundRecord.reason,
    remarks: inboundRecord.remarks || '',
    userId: inboundRecord.userId,
    colorCode: inboundRecord.colorCode || '',
    productionDate: inboundRecord.productionDate
      ? toISOString(inboundRecord.productionDate)?.split('T')[0] || ''
      : '',
    unitCost: inboundRecord.unitCost || 0,
    totalCost: inboundRecord.totalCost || 0,
    createdAt: toISOString(inboundRecord.createdAt) || '',
    updatedAt: toISOString(inboundRecord.updatedAt) || '',

    // 嵌套的产品对象（前端组件期望的结构）
    product: {
      id: inboundRecord.product.id,
      name: inboundRecord.product.name,
      code: inboundRecord.product.code,
      unit: inboundRecord.product.unit,
    },

    // 嵌套的用户对象（前端组件期望的结构）
    user: {
      id: inboundRecord.user.id,
      name: inboundRecord.user.name,
    },

    // 保持向后兼容的扁平化字段
    productName: inboundRecord.product.name,
    productSku: inboundRecord.product.code, // 使用 code 字段而不是 sku
    productUnit: inboundRecord.product.unit,
    userName: inboundRecord.user.name || '',
  };
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
  },
  tx?: any // 事务上下文
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
    // 更新现有库存
    await prismaClient.inventory.update({
      where: { id: existingInventory.id },
      data: {
        quantity: existingInventory.quantity + quantity,
        updatedAt: new Date(),
      },
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
      },
    });
  }
}
