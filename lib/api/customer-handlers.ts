/**
 * 客户管理API处理器
 * 严格遵循全栈项目统一约定规范
 */

import type { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';

import {
  buildCustomerDetail,
  mapCustomerBase,
  transformCustomerListItem,
  type CustomerDetailQueryResult,
  type CustomerDetailResult,
  type CustomerListQueryResult,
  type PrismaCustomerBase,
} from '@/lib/api/customer-transformers';
import {
  checkHierarchyLoop,
  ensureUniquePhoneInRegion,
} from '@/lib/api/customer-validators';
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

type CustomerComputedSortField =
  | 'totalOrders'
  | 'totalAmount'
  | 'transactionCount'
  | 'cooperationDays'
  | 'returnOrderCount';

const DIRECT_CUSTOMER_SORT_FIELDS = new Set<
  keyof Prisma.CustomerOrderByWithRelationInput
>(['createdAt', 'updatedAt', 'name']);

const COMPUTED_CUSTOMER_SORT_FIELDS = new Set<CustomerComputedSortField>([
  'totalOrders',
  'totalAmount',
  'transactionCount',
  'cooperationDays',
  'returnOrderCount',
]);

function normalizeSortOrder(sortOrder: string): Prisma.SortOrder {
  return sortOrder === 'asc' ? 'asc' : 'desc';
}

function buildCustomerOrderBy(
  sortBy: string,
  sortOrder: Prisma.SortOrder
): Prisma.CustomerOrderByWithRelationInput {
  if (
    DIRECT_CUSTOMER_SORT_FIELDS.has(
      sortBy as keyof Prisma.CustomerOrderByWithRelationInput
    )
  ) {
    return {
      [sortBy]: sortOrder,
    } as Prisma.CustomerOrderByWithRelationInput;
  }

  return { createdAt: sortOrder };
}

function sortCustomersInMemory(
  customers: Customer[],
  sortBy: string,
  sortOrder: Prisma.SortOrder
): Customer[] {
  if (!COMPUTED_CUSTOMER_SORT_FIELDS.has(sortBy as CustomerComputedSortField)) {
    return customers;
  }

  const getComputedValue = (customer: Customer): number => {
    switch (sortBy as CustomerComputedSortField) {
      case 'totalOrders':
        return customer.totalOrders ?? 0;
      case 'totalAmount':
        return Number(customer.totalAmount ?? 0);
      case 'transactionCount':
        return customer.transactionCount ?? 0;
      case 'cooperationDays':
        return customer.cooperationDays ?? 0;
      case 'returnOrderCount':
        return customer.returnOrderCount ?? 0;
      default:
        return 0;
    }
  };

  const sorted = [...customers];
  sorted.sort((a, b) => {
    const aValue = getComputedValue(a);
    const bValue = getComputedValue(b);
    return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
  });

  return sorted;
}

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
export async function getCustomerDetail(
  id: string
): Promise<CustomerDetailResult> {
  // 优化: 使用 select 替代 include,明确指定所有需要的字段
  const customer = await prisma.customer.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
      extendedInfo: true,
      parentCustomerId: true,
      createdAt: true,
      updatedAt: true,
      // 父客户信息
      parentCustomer: {
        select: {
          id: true,
          name: true,
          phone: true,
          address: true,
          extendedInfo: true,
          parentCustomerId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      // 子客户列表
      childCustomers: {
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          phone: true,
          address: true,
          extendedInfo: true,
          parentCustomerId: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
      // 最近的订单（包含付款信息）
      salesOrders: {
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          paidAmount: true,
          status: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 20, // 获取最近20个订单以便显示未付款订单
      },
      // 退货订单
      returnOrders: {
        select: {
          id: true,
          returnNumber: true,
          totalAmount: true,
          status: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
      },
      // 订单数量统计
      _count: {
        select: {
          salesOrders: true,
          returnOrders: true,
        },
      },
    },
  });

  if (!customer) {
    throw new Error('客户不存在');
  }

  return buildCustomerDetail(customer as CustomerDetailQueryResult);
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
  await ensureUniquePhoneInRegion(data.phone, data.extendedInfo?.region);

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
          phone: true,
          address: true,
          extendedInfo: true,
          parentCustomerId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  const baseCustomer = mapCustomerBase(customer);
  const parentCustomer = customer.parentCustomer
    ? mapCustomerBase(customer.parentCustomer as PrismaCustomerBase)
    : undefined;

  return {
    ...baseCustomer,
    parentCustomer,
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

  const existingExtendedInfo = parseExtendedInfo(
    existingCustomer.extendedInfo || undefined
  );

  const mergedExtendedInfo = data.extendedInfo
    ? { ...existingExtendedInfo, ...data.extendedInfo }
    : existingExtendedInfo;

  await ensureUniquePhoneInRegion(
    data.phone !== undefined ? data.phone : existingCustomer.phone,
    mergedExtendedInfo.region,
    id
  );

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
          phone: true,
          address: true,
          extendedInfo: true,
          parentCustomerId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  const baseCustomer = mapCustomerBase(customer);
  const parentCustomer = customer.parentCustomer
    ? mapCustomerBase(customer.parentCustomer as PrismaCustomerBase)
    : undefined;

  return {
    ...baseCustomer,
    parentCustomer,
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

  // 检查是否有关联的客户产品价格记录
  const customerProductPriceCount = await prisma.customerProductPrice.count({
    where: { customerId: id },
  });

  if (customerProductPriceCount > 0) {
    throw new Error(
      `无法删除客户,该客户有 ${customerProductPriceCount} 个关联的产品价格记录`
    );
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

  const normalizedSortOrder = normalizeSortOrder(sortOrder);
  const where: Prisma.CustomerWhereInput = {};

  // 搜索条件 (MySQL 默认不区分大小写，无需 mode 参数)
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { phone: { contains: search } },
      { address: { contains: search } },
    ];
  }

  // 父级客户筛选
  if (parentCustomerId) {
    where.parentCustomerId = parentCustomerId;
  }

  // 计算分页
  const skip = (page - 1) * limit;

  // 构建排序条件
  const orderBy = buildCustomerOrderBy(sortBy, normalizedSortOrder);

  // 查询客户列表
  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: {
        parentCustomer: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
            extendedInfo: true,
            parentCustomerId: true,
            createdAt: true,
            updatedAt: true,
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
            status: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'asc', // 按创建时间升序，方便计算首次下单时间
          },
        },
        returnOrders: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.customer.count({ where }),
  ]);

  const transformedCustomers = customers.map(customer =>
    transformCustomerListItem(customer as CustomerListQueryResult)
  );
  const sortedCustomers = sortCustomersInMemory(
    transformedCustomers,
    sortBy,
    normalizedSortOrder
  );

  // 计算分页信息
  const totalPages = Math.ceil(total / limit);

  return {
    data: sortedCustomers,
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
