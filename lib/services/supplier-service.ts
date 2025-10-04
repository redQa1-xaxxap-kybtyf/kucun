/**
 * 供应商管理业务逻辑服务层
 * 职责:
 * - 封装所有供应商相关的业务逻辑
 * - 通过 Prisma 客户端与数据库交互
 * - 返回类型安全的数据对象
 * - 可被 API Route 和服务器组件复用
 */

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';

// ==================== 类型定义 ====================

export interface SupplierItem {
  id: string;
  name: string;
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
  status?: 'active' | 'inactive';
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
}

// ==================== 辅助函数 ====================

/**
 * 构建查询条件
 */
function buildWhereConditions(params: {
  search?: string;
  status?: 'active' | 'inactive';
}): Prisma.SupplierWhereInput {
  const where: Prisma.SupplierWhereInput = {};

  if (params.search) {
    where.OR = [
      { name: { contains: params.search } },
      { phone: { contains: params.search } },
    ];
  }

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
      orderBy: {
        [sortBy]: sortOrder,
      },
      select: {
        id: true,
        name: true,
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
  // 检查供应商名称是否已存在 - 只需要 id 字段
  const existingSupplier = await prisma.supplier.findFirst({
    where: { name: params.name },
    select: {
      id: true,
    },
  });

  if (existingSupplier) {
    throw new Error('供应商名称已存在');
  }

  // 创建供应商 - 使用 select 指定返回字段
  const supplier = await prisma.supplier.create({
    data: {
      name: params.name,
      phone: params.phone || null,
      address: params.address || null,
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
    },
  });

  // 直接返回，无需转换
  return supplier;
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
