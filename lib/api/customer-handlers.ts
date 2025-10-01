/**
 * 客户管理API处理器
 * 严格遵循全栈项目统一约定规范
 */

import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import type {
  Customer,
  CustomerCreateInput,
  CustomerQueryParams,
  CustomerUpdateInput,
} from '@/lib/types/customer';
import {
  parseExtendedInfo,
  processExtendedInfo,
} from '@/lib/validations/customer';

/**
 * 验证用户会话
 * @throws {Error} 当用户未登录时抛出错误
 */
export async function validateUserSession(): Promise<void> {
  // 开发环境下绕过身份验证
  if (env.NODE_ENV === 'development') {
    return;
  }

  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    throw new Error('未授权访问');
  }
}

/**
 * 获取客户详情
 * @param id 客户ID
 * @returns 客户详情信息
 * @throws {Error} 当客户不存在时抛出错误
 */
export async function getCustomerDetail(id: string): Promise<Customer> {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      parentCustomer: {
        select: {
          id: true,
          name: true,
        },
      },
      childCustomers: {
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
      salesOrders: {
        select: {
          id: true,
          totalAmount: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 5, // 只获取最近5个订单
      },
    },
  });

  if (!customer) {
    throw new Error('客户不存在');
  }

  // 解析扩展信息
  const extendedInfo = parseExtendedInfo(customer.extendedInfo || undefined);

  // 计算统计信息
  const totalOrders = customer.salesOrders.length;
  const totalAmount = customer.salesOrders.reduce(
    (sum, order) => sum + order.totalAmount,
    0
  );
  const lastOrderDate = customer.salesOrders[0]?.createdAt.toISOString();

  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone || undefined,
    address: customer.address || undefined,
    extendedInfo: JSON.stringify(extendedInfo),
    parentCustomerId: customer.parentCustomerId || undefined,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
    parentCustomer: (customer.parentCustomer as any) || undefined,
    childCustomers: (customer.childCustomers as any) || undefined,
    totalOrders,
    totalAmount,
    lastOrderDate,
  };
}

/**
 * 创建客户
 * @param data 客户创建数据
 * @returns 创建的客户信息
 * @throws {Error} 当创建失败时抛出错误
 */
export async function createCustomer(
  data: CustomerCreateInput
): Promise<Customer> {
  // 处理扩展信息
  const extendedInfoStr = processExtendedInfo(data.extendedInfo);

  const customer = await prisma.customer.create({
    data: {
      name: data.name,
      phone: data.phone || null,
      address: data.address || null,
      extendedInfo: extendedInfoStr || null,
      parentCustomerId: data.parentCustomerId || null,
    },
    include: {
      parentCustomer: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone || undefined,
    address: customer.address || undefined,
    extendedInfo: customer.extendedInfo || undefined,
    parentCustomerId: customer.parentCustomerId || undefined,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
    parentCustomer: (customer.parentCustomer as any) || undefined,
  };
}

/**
 * 更新客户
 * @param id 客户ID
 * @param data 客户更新数据
 * @returns 更新后的客户信息
 * @throws {Error} 当客户不存在或更新失败时抛出错误
 */
export async function updateCustomer(
  id: string,
  data: CustomerUpdateInput
): Promise<Customer> {
  // 检查客户是否存在
  const existingCustomer = await prisma.customer.findUnique({
    where: { id },
  });

  if (!existingCustomer) {
    throw new Error('客户不存在');
  }

  // 如果更新了父级客户,检查是否会形成循环
  if (data.parentCustomerId) {
    const hasLoop = await checkHierarchyLoop(id, data.parentCustomerId);
    if (hasLoop) {
      throw new Error('无法设置父级客户,会形成循环引用');
    }
  }

  // 处理扩展信息
  const extendedInfoStr = data.extendedInfo
    ? processExtendedInfo(data.extendedInfo)
    : undefined;

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.phone !== undefined && { phone: data.phone || null }),
      ...(data.address !== undefined && { address: data.address || null }),
      ...(extendedInfoStr !== undefined && { extendedInfo: extendedInfoStr }),
      ...(data.parentCustomerId !== undefined && {
        parentCustomerId: data.parentCustomerId || null,
      }),
    },
    include: {
      parentCustomer: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone || undefined,
    address: customer.address || undefined,
    extendedInfo: customer.extendedInfo || undefined,
    parentCustomerId: customer.parentCustomerId || undefined,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
    parentCustomer: (customer.parentCustomer as any) || undefined,
  };
}

/**
 * 删除客户
 * @param id 客户ID
 * @throws {Error} 当客户不存在或删除失败时抛出错误
 */
export async function deleteCustomer(id: string): Promise<void> {
  // 检查客户是否存在
  const existingCustomer = await prisma.customer.findUnique({
    where: { id },
    include: {
      childCustomers: true,
      salesOrders: true,
    },
  });

  if (!existingCustomer) {
    throw new Error('客户不存在');
  }

  // 检查是否有子客户
  if (existingCustomer.childCustomers.length > 0) {
    throw new Error(
      `无法删除客户,该客户有 ${existingCustomer.childCustomers.length} 个子客户`
    );
  }

  // 检查是否有关联的销售订单
  if (existingCustomer.salesOrders.length > 0) {
    throw new Error(
      `无法删除客户,该客户有 ${existingCustomer.salesOrders.length} 个关联的销售订单`
    );
  }

  // 检查是否有关联的退货订单
  const returnOrderCount = await prisma.returnOrder.count({
    where: { customerId: id },
  });

  if (returnOrderCount > 0) {
    throw new Error(
      `无法删除客户,该客户有 ${returnOrderCount} 个关联的退货订单`
    );
  }

  // 检查是否有关联的厂家发货订单
  const factoryShipmentCount = await prisma.factoryShipmentOrder.count({
    where: { customerId: id },
  });

  if (factoryShipmentCount > 0) {
    throw new Error(
      `无法删除客户,该客户有 ${factoryShipmentCount} 个关联的厂家发货订单`
    );
  }

  // 检查是否有关联的付款记录
  const paymentCount = await prisma.paymentRecord.count({
    where: { customerId: id },
  });

  if (paymentCount > 0) {
    throw new Error(`无法删除客户,该客户有 ${paymentCount} 个关联的付款记录`);
  }

  // 检查是否有关联的退款记录
  const refundCount = await prisma.refundRecord.count({
    where: { customerId: id },
  });

  if (refundCount > 0) {
    throw new Error(`无法删除客户,该客户有 ${refundCount} 个关联的退款记录`);
  }

  // 检查是否有关联的出库记录
  const outboundCount = await prisma.outboundRecord.count({
    where: { customerId: id },
  });

  if (outboundCount > 0) {
    throw new Error(`无法删除客户,该客户有 ${outboundCount} 个关联的出库记录`);
  }

  // 所有检查通过,可以安全删除
  await prisma.customer.delete({
    where: { id },
  });
}

/**
 * 获取客户列表
 * @param params 查询参数
 * @returns 分页的客户列表
 */
export async function getCustomerList(params: CustomerQueryParams) {
  const {
    page = 1,
    limit = 20,
    search = '',
    sortBy = 'createdAt',
    sortOrder = 'desc',
    parentCustomerId,
  } = params;

  // 构建查询条件
  const where: Record<string, unknown> = {};

  // 搜索条件
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { address: { contains: search, mode: 'insensitive' } },
    ];
  }

  // 父级客户筛选
  if (parentCustomerId) {
    where.parentCustomerId = parentCustomerId;
  }

  // 计算分页
  const skip = (page - 1) * limit;

  // 构建排序条件
  const orderBy: Record<string, string> = {};
  orderBy[sortBy] = sortOrder;

  // 查询客户列表
  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: {
        parentCustomer: {
          select: {
            id: true,
            name: true,
          },
        },
        childCustomers: {
          select: {
            id: true,
          },
        },
        salesOrders: {
          select: {
            id: true,
            totalAmount: true,
            createdAt: true,
          },
        },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.customer.count({ where }),
  ]);

  // 转换数据格式
  const transformedCustomers: any[] = customers.map(customer => {
    const extendedInfo = parseExtendedInfo(customer.extendedInfo || undefined);
    const totalOrders = customer.salesOrders.length;
    const totalAmount = customer.salesOrders.reduce(
      (sum, order) => sum + order.totalAmount,
      0
    );
    const lastOrderDate = customer.salesOrders[0]?.createdAt.toISOString();

    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone || undefined,
      address: customer.address || undefined,
      extendedInfo: JSON.stringify(extendedInfo),
      parentCustomerId: customer.parentCustomerId || undefined,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
      parentCustomer: customer.parentCustomer || undefined,
      totalOrders,
      totalAmount,
      lastOrderDate,
    };
  });

  // 计算分页信息
  const totalPages = Math.ceil(total / limit);

  return {
    data: transformedCustomers,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

/**
 * 检查客户层级是否会形成循环
 * @param customerId 当前客户ID
 * @param newParentId 新父级客户ID
 * @returns 如果会形成循环返回true,否则返回false
 */
async function checkHierarchyLoop(
  customerId: string,
  newParentId: string
): Promise<boolean> {
  // 不能将自己设为父级
  if (customerId === newParentId) {
    return true;
  }

  // 检查新父级的所有祖先
  let currentParentId: string | null = newParentId;
  const visited = new Set<string>();

  while (currentParentId) {
    // 检测循环
    if (visited.has(currentParentId)) {
      return true;
    }

    // 如果新父级的祖先中包含当前客户,则形成循环
    if (currentParentId === customerId) {
      return true;
    }

    visited.add(currentParentId);

    // 查找父级的父级
    const parent: { parentCustomerId: string | null } | null =
      await prisma.customer.findUnique({
        where: { id: currentParentId },
        select: { parentCustomerId: true },
      });

    currentParentId = parent?.parentCustomerId || null;
  }

  return false;
}
