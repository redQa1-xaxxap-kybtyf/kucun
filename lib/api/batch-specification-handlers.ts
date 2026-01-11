/**
 * 批次规格参数处理器
 * 提供批次规格参数的CRUD操作和业务逻辑
 */

import type { Prisma } from '@prisma/client';

import { ApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/db';
import type {
  BatchSpecification,
  BatchSpecificationListResponse,
  CreateBatchSpecificationRequest,
  UpdateBatchSpecificationRequest,
} from '@/lib/types/batch-specification';
import type { Product } from '@/lib/types/product';
import { toISOString } from '@/lib/utils/datetime';

/**
 * 验证产品是否存在
 */
async function validateProductExists(
  productId: string,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const prismaClient = tx || prisma;

  const product = await prismaClient.product.findUnique({
    where: { id: productId },
    select: { id: true, status: true },
  });

  if (!product) {
    throw ApiError.notFound('产品');
  }

  if (product.status !== 'active') {
    throw ApiError.forbidden('产品已停用，无法操作');
  }
}

/**
 * 验证批次规格参数是否存在
 */
async function validateBatchSpecificationExists(id: string): Promise<void> {
  const specification = await prisma.batchSpecification.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!specification) {
    throw ApiError.notFound('批次规格参数');
  }
}

/**
 * 格式化批次规格参数数据
 */
function formatBatchSpecifications(
  specifications: Array<{
    id: string;
    productId: string;
    batchNumber: string;
    piecesPerUnit: number;
    weight: unknown;
    thickness: unknown;
    createdAt: Date;
    updatedAt: Date;
    product?: {
      id: string;
      name: string;
      code: string;
      unit: string;
      specification: string | null;
      piecesPerUnit: number | null;
      status: string;
      createdAt: Date;
      updatedAt: Date;
    };
  }>
): BatchSpecification[] {
  return specifications.map(spec => {
    const weight =
      spec.weight === null || spec.weight === undefined
        ? undefined
        : Number(spec.weight);
    const thickness =
      spec.thickness === null || spec.thickness === undefined
        ? undefined
        : Number(spec.thickness);

    return {
      id: spec.id,
      productId: spec.productId,
      batchNumber: spec.batchNumber,
      piecesPerUnit: spec.piecesPerUnit,
      weight,
      thickness,
      createdAt: toISOString(spec.createdAt) || '',
      updatedAt: toISOString(spec.updatedAt) || '',

      // 嵌套的产品对象（如果包含）
      ...(spec.product && {
        product: {
          id: spec.product.id,
          code: spec.product.code,
          name: spec.product.name,
          specification: spec.product.specification ?? undefined,
          description: undefined,
          unit: spec.product.unit as Product['unit'],
          piecesPerUnit: spec.product.piecesPerUnit ?? spec.piecesPerUnit ?? 0,
          weight,
          thickness,
          status: (spec.product.status ?? 'active') as Product['status'],
          categoryId: undefined,
          category: undefined,
          thumbnailUrl: undefined,
          images: undefined,
          createdAt: toISOString(spec.product.createdAt) || '',
          updatedAt: toISOString(spec.product.updatedAt) || '',
          variants: undefined,
          counts: undefined,
          inventory: undefined,
        } satisfies Product,
      }),
    };
  });
}

/**
 * 构建批次规格参数查询条件
 */
function buildBatchSpecificationWhereClause(queryData: {
  search?: string;
  productId?: string;
  batchNumber?: string;
  startDate?: string;
  endDate?: string;
}): Prisma.BatchSpecificationWhereInput {
  const where: Prisma.BatchSpecificationWhereInput = {};

  // ✅ 防御性编程: 只查询有效产品的批次规格,过滤孤儿记录
  where.product = {
    is: {}, // 确保存在关联的产品
  };

  // 搜索条件
  if (queryData.search) {
    where.OR = [
      { batchNumber: { contains: queryData.search } },
      { product: { name: { contains: queryData.search } } },
      { product: { code: { contains: queryData.search } } },
    ];
  }

  // 产品筛选
  if (queryData.productId) {
    where.productId = queryData.productId;
  }

  // 批次号筛选
  if (queryData.batchNumber) {
    where.batchNumber = { contains: queryData.batchNumber };
  }

  // 日期范围筛选
  if (queryData.startDate || queryData.endDate) {
    where.createdAt = {};
    if (queryData.startDate) {
      where.createdAt.gte = new Date(queryData.startDate);
    }
    if (queryData.endDate) {
      // 结束日期包含当天，所以加1天
      const endDate = new Date(queryData.endDate);
      endDate.setDate(endDate.getDate() + 1);
      where.createdAt.lt = endDate;
    }
  }

  return where;
}

/**
 * 构建批次规格参数排序条件
 */
function buildBatchSpecificationOrderBy(queryData: {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}): Prisma.BatchSpecificationOrderByWithRelationInput {
  if (queryData.sortBy === 'productName') {
    return { product: { name: queryData.sortOrder } };
  }

  // 使用类型安全的方式构建 orderBy
  return {
    [queryData.sortBy]: queryData.sortOrder,
  } as Prisma.BatchSpecificationOrderByWithRelationInput;
}

/**
 * 创建或更新批次规格参数
 */
export async function upsertBatchSpecification(
  data: CreateBatchSpecificationRequest,
  tx?: Prisma.TransactionClient
): Promise<BatchSpecification> {
  const prismaClient = tx || prisma;

  // ✅ 验证产品存在 - 传递事务上下文确保原子性
  await validateProductExists(data.productId, prismaClient);

  // 使用upsert确保批次规格参数的唯一性
  const specification = await prismaClient.batchSpecification.upsert({
    where: {
      productId_batchNumber: {
        productId: data.productId,
        batchNumber: data.batchNumber,
      },
    },
    update: {
      piecesPerUnit: data.piecesPerUnit,
      weight: data.weight || null,
      thickness: data.thickness || null,
      updatedAt: new Date(),
    },
    create: {
      productId: data.productId,
      batchNumber: data.batchNumber,
      piecesPerUnit: data.piecesPerUnit,
      weight: data.weight || null,
      thickness: data.thickness || null,
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          code: true,
          unit: true,
          specification: true,
          piecesPerUnit: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  const formatted = formatBatchSpecifications([specification]);
  return formatted[0];
}

/**
 * 获取批次规格参数详情
 */
export async function getBatchSpecificationById(
  id: string
): Promise<BatchSpecification> {
  await validateBatchSpecificationExists(id);

  const specification = await prisma.batchSpecification.findUnique({
    where: { id },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          code: true,
          unit: true,
          specification: true,
          piecesPerUnit: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!specification) {
    throw new Error('批次规格参数不存在');
  }

  // ✅ 防御性检查: 如果是孤儿记录(产品不存在),抛出错误
  if (!specification.product) {
    throw new Error('批次规格参数关联的产品不存在(孤儿记录)');
  }

  const formatted = formatBatchSpecifications([specification]);
  return formatted[0];
}

/**
 * 根据产品ID和批次号获取批次规格参数
 */
export async function getBatchSpecificationByProductAndBatch(
  productId: string,
  batchNumber: string
): Promise<BatchSpecification | null> {
  const specification = await prisma.batchSpecification.findUnique({
    where: {
      productId_batchNumber: {
        productId,
        batchNumber,
      },
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          code: true,
          unit: true,
          specification: true,
          piecesPerUnit: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!specification) {
    return null;
  }

  // ✅ 防御性检查: 如果是孤儿记录(产品不存在),返回null
  if (!specification.product) {
    // 孤儿记录: 批次规格关联的产品不存在
    return null;
  }

  const formatted = formatBatchSpecifications([specification]);
  return formatted[0];
}

/**
 * 获取批次规格参数列表
 */
export async function getBatchSpecifications(queryData: {
  page: number;
  limit: number;
  search?: string;
  productId?: string;
  batchNumber?: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}): Promise<BatchSpecificationListResponse> {
  const where = buildBatchSpecificationWhereClause(queryData);
  const orderBy = buildBatchSpecificationOrderBy(queryData);

  // 计算分页
  const skip = (queryData.page - 1) * queryData.limit;

  // 并行查询记录和总数
  const [specifications, total] = await Promise.all([
    prisma.batchSpecification.findMany({
      where,
      orderBy,
      skip,
      take: queryData.limit,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            code: true,
            unit: true,
            specification: true,
            piecesPerUnit: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    }),
    prisma.batchSpecification.count({ where }),
  ]);

  // 格式化记录数据
  const formattedSpecifications = formatBatchSpecifications(specifications);

  return {
    success: true,
    data: formattedSpecifications,
    pagination: {
      page: queryData.page,
      limit: queryData.limit,
      total,
      totalPages: Math.ceil(total / queryData.limit),
    },
  };
}

/**
 * 更新批次规格参数
 */
export async function updateBatchSpecification(
  id: string,
  data: UpdateBatchSpecificationRequest
): Promise<BatchSpecification> {
  await validateBatchSpecificationExists(id);

  const specification = await prisma.batchSpecification.update({
    where: { id },
    data: {
      ...(data.piecesPerUnit !== undefined && {
        piecesPerUnit: data.piecesPerUnit,
      }),
      ...(data.weight !== undefined && { weight: data.weight || null }),
      ...(data.thickness !== undefined && {
        thickness: data.thickness || null,
      }),
      updatedAt: new Date(),
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          code: true,
          unit: true,
          specification: true,
          piecesPerUnit: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  const formatted = formatBatchSpecifications([specification]);
  return formatted[0];
}

/**
 * 删除批次规格参数
 */
export async function deleteBatchSpecification(id: string): Promise<void> {
  await validateBatchSpecificationExists(id);

  // 检查是否有关联的入库记录
  const relatedRecords = await prisma.inboundRecord.count({
    where: { batchSpecificationId: id },
  });

  if (relatedRecords > 0) {
    throw ApiError.badRequest('该批次规格参数已被入库记录使用，无法删除');
  }

  await prisma.batchSpecification.delete({
    where: { id },
  });
}

/**
 * 验证用户会话（从入库处理器导入）
 */
export async function validateUserSession() {
  const { validateUserSession: validateSession } = await import(
    './inbound-handlers'
  );
  return validateSession();
}
