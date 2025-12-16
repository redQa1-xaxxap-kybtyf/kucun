/**
 * 供应商管理业务逻辑服务层
 * 职责:
 * - 封装所有供应商相关的业务逻辑
 * - 通过 Prisma 客户端与数据库交互
 * - 返回类型安全的数据对象
 * - 可被 API Route 和服务器组件复用
 */

import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { generateSupplierCode } from '@/lib/utils/supplier-utils';

// ==================== 类型定义 ====================

export interface SupplierItem {
  id: string;
  name: string;
  supplierCode: string | null;
  phone: string | null;
  address: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupplierQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'active' | 'inactive' | 'suspended';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SupplierListResult {
  suppliers: SupplierItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateSupplierParams {
  name: string;
  phone?: string | null;
  address?: string | null;
  supplierCode?: string | null;
}

interface SupplierBasicInfo {
  id: string;
  name: string;
  status: string;
}

// ==================== 辅助函数 ====================

/**
 * 构建查询条件
 * 优化: 移除 MySQL 不支持的 mode: 'insensitive'
 */
function buildWhereConditions(params: {
  search?: string;
  status?: 'active' | 'inactive' | 'suspended';
}): Prisma.SupplierWhereInput {
  const where: Prisma.SupplierWhereInput = {};

  // 搜索条件 (MySQL 默认不区分大小写)
  if (params.search) {
    where.OR = [
      { name: { contains: params.search } },
      { phone: { contains: params.search } },
    ];
  }

  // 状态筛选
  if (params.status) {
    where.status = params.status;
  }

  return where;
}

// ==================== 公共服务函数 ====================

/**
 * 获取供应商列表
 */
export async function getSuppliers(
  params: SupplierQueryParams = {}
): Promise<SupplierListResult> {
  const {
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    ...filterParams
  } = params;

  // 构建查询条件
  const where = buildWhereConditions(filterParams);

  // 计算分页
  const skip = (page - 1) * limit;

  // 执行查询 - 使用 select 明确指定返回字段
  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ [sortBy]: sortOrder }, { id: 'desc' }],
      select: {
        id: true,
        name: true,
        supplierCode: true,
        phone: true,
        address: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.supplier.count({ where }),
  ]);

  // 直接返回，无需转换
  return {
    suppliers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * 创建供应商
 */
export async function createSupplier(
  params: CreateSupplierParams
): Promise<SupplierItem> {
  try {
    return await prisma.$transaction(async tx => {
      // 检查供应商名称是否已存在 - 只需要 id 字段
      const existingSupplier = await tx.supplier.findFirst({
        where: { name: params.name },
        select: {
          id: true,
        },
      });

      if (existingSupplier) {
        throw new Error('供应商名称已存在');
      }

      const customCode =
        typeof params.supplierCode === 'string'
          ? params.supplierCode.trim()
          : '';
      const shouldUseCustomCode = customCode.length > 0;
      const supplierCode = shouldUseCustomCode
        ? customCode
        : await generateSupplierCode(tx);

      if (shouldUseCustomCode) {
        const existingCode = await tx.supplier.findFirst({
          where: { supplierCode },
          select: { id: true },
        });

        if (existingCode) {
          throw new Error('供应商编码已存在');
        }
      }

      // 创建供应商 - 使用 select 指定返回字段
      const supplier = await tx.supplier.create({
        data: {
          name: params.name,
          supplierCode,
          phone: params.phone ?? null,
          address: params.address ?? null,
          status: 'active',
        },
        select: {
          id: true,
          name: true,
          phone: true,
          address: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          supplierCode: true,
        },
      });

      return supplier;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = error.meta?.target;
      const fields = Array.isArray(target) ? target : target ? [target] : [];
      if (fields.includes('supplier_code') || fields.includes('supplierCode')) {
        throw new Error('供应商编码已存在');
      }
      if (fields.includes('name')) {
        throw new Error('供应商名称已存在');
      }
    }
    throw error;
  }
}

/**
 * 获取单个供应商详情
 */
export async function getSupplierById(
  id: string
): Promise<SupplierItem | null> {
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      supplierCode: true,
      phone: true,
      address: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!supplier) {
    return null;
  }

  // 直接返回，无需转换
  return supplier;
}

// ==================== 业务校验辅助函数 ====================

async function getSupplierBasicInfo(
  supplierId: string
): Promise<SupplierBasicInfo | null> {
  return prisma.supplier.findUnique({
    where: { id: supplierId },
    select: {
      id: true,
      name: true,
      status: true,
    },
  });
}

/**
 * 确保供应商可以停用
 * 如果存在未完成的厂家发货或未结清的应付账款，则抛出错误
 */
export async function ensureSupplierCanBeDeactivated(
  supplierId: string,
  supplierName?: string
): Promise<void> {
  let basicInfo = supplierName
    ? { id: supplierId, name: supplierName, status: 'unknown' }
    : null;

  if (!basicInfo) {
    basicInfo = await getSupplierBasicInfo(supplierId);
  }

  if (!basicInfo) {
    throw new Error('供应商不存在');
  }

  const [activeShipmentCount, unpaidPayablesCount] = await prisma.$transaction([
    prisma.factoryShipmentOrder.count({
      where: {
        items: {
          some: {
            supplierId,
            factoryShipmentOrder: {
              status: {
                notIn: ['completed', 'cancelled'],
              },
            },
          },
        },
      },
    }),
    prisma.payableRecord.count({
      where: {
        supplierId,
        status: {
          notIn: ['paid', 'cancelled'],
        },
      },
    }),
  ]);

  if (activeShipmentCount > 0) {
    throw new Error(
      `供应商 "${basicInfo.name}" 有 ${activeShipmentCount} 个进行中的发货订单，无法停用`
    );
  }

  if (unpaidPayablesCount > 0) {
    throw new Error(
      `供应商 "${basicInfo.name}" 有 ${unpaidPayablesCount} 笔未结清的应付账款，无法停用`
    );
  }
}

/**
 * 确保供应商可以删除
 * 如果有关联业务数据，则抛出错误
 */
export async function ensureSupplierCanBeDeleted(
  supplierId: string,
  supplierName?: string
): Promise<void> {
  let basicInfo = supplierName
    ? { id: supplierId, name: supplierName, status: 'unknown' }
    : null;

  if (!basicInfo) {
    basicInfo = await getSupplierBasicInfo(supplierId);
  }

  if (!basicInfo) {
    throw new Error('供应商不存在');
  }

  const [
    salesOrderCount,
    shipmentItemCount,
    payableCount,
    paymentOutCount,
    temporaryProductCount,
    purchaseOrderCount,
    purchaseOrderItemCount,
  ] = await prisma.$transaction([
    prisma.salesOrder.count({
      where: { supplierId },
    }),
    prisma.factoryShipmentOrderItem.count({
      where: { supplierId },
    }),
    prisma.payableRecord.count({
      where: { supplierId },
    }),
    prisma.paymentOutRecord.count({
      where: { supplierId },
    }),
    prisma.temporaryProduct.count({
      where: { supplierId },
    }),
    prisma.purchaseOrder.count({
      where: { supplierId },
    }),
    prisma.purchaseOrderItem.count({
      where: { supplierId },
    }),
  ]);

  if (salesOrderCount > 0) {
    throw new Error(
      `供应商 "${basicInfo.name}" 有 ${salesOrderCount} 个关联的销售订单，无法删除`
    );
  }

  if (shipmentItemCount > 0) {
    throw new Error(
      `供应商 "${basicInfo.name}" 有 ${shipmentItemCount} 个关联的发货订单明细，无法删除`
    );
  }

  if (payableCount > 0) {
    throw new Error(
      `供应商 "${basicInfo.name}" 有 ${payableCount} 笔应付账款记录，无法删除`
    );
  }

  if (paymentOutCount > 0) {
    throw new Error(
      `供应商 "${basicInfo.name}" 有 ${paymentOutCount} 条付款记录，无法删除`
    );
  }

  if (temporaryProductCount > 0) {
    throw new Error(
      `供应商 "${basicInfo.name}" 有 ${temporaryProductCount} 个关联的临时产品，无法删除`
    );
  }

  if (purchaseOrderCount > 0) {
    throw new Error(
      `供应商 "${basicInfo.name}" 有 ${purchaseOrderCount} 个关联的采购订单，无法删除`
    );
  }

  if (purchaseOrderItemCount > 0) {
    throw new Error(
      `供应商 "${basicInfo.name}" 有 ${purchaseOrderItemCount} 个关联的采购订单明细，无法删除`
    );
  }
}

/**
 * 获取供应商最近的厂家发货汇总
 */
export async function getRecentSupplierShipments(
  supplierId: string,
  take = 10
) {
  return prisma.factoryShipmentOrder.findMany({
    where: {
      items: {
        some: { supplierId },
      },
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      createdAt: true,
      items: {
        where: { supplierId },
        select: {
          totalPrice: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take,
  });
}

/**
 * 统计供应商关联的厂家发货数量
 */
export async function countSupplierShipments(
  supplierId: string
): Promise<number> {
  return prisma.factoryShipmentOrder.count({
    where: {
      items: {
        some: { supplierId },
      },
    },
  });
}

/**
 * 更新供应商
 */
export async function updateSupplier(
  id: string,
  params: Partial<CreateSupplierParams>
): Promise<SupplierItem> {
  // 如果更新名称,检查是否与其他供应商重复 - 只需要 id 字段
  if (params.name) {
    const existingSupplier = await prisma.supplier.findFirst({
      where: {
        name: params.name,
        id: { not: id },
      },
      select: {
        id: true,
      },
    });

    if (existingSupplier) {
      throw new Error('供应商名称已存在');
    }
  }

  // 更新供应商 - 使用 select 指定返回字段
  const supplier = await prisma.supplier.update({
    where: { id },
    data: {
      name: params.name,
      phone: params.phone || null,
      address: params.address || null,
    },
    select: {
      id: true,
      name: true,
      supplierCode: true,
      phone: true,
      address: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // 直接返回，无需转换
  return supplier;
}

/**
 * 删除供应商(软删除)
 */
export async function deleteSupplier(id: string): Promise<void> {
  await prisma.supplier.update({
    where: { id },
    data: {
      status: 'inactive',
    },
  });
}
