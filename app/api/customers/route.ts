import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  customerValidations,
  paginationValidations,
} from '@/lib/validations/base';

// 获取客户列表
export async function GET(request: NextRequest) {
  try {
    // 验证用户权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const queryParams = {
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
      search: searchParams.get('search') || undefined,
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc',
      parentCustomerId: searchParams.get('parentCustomerId') || undefined,
    };

    // 验证查询参数
    const validationResult = paginationValidations.query.safeParse(queryParams);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '查询参数格式不正确',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { page, limit, search, sortBy, sortOrder } = validationResult.data;
    const { parentCustomerId } = queryParams;

    // 检查是否需要应用层排序（合作天数）
    const needsApplicationSort = sortBy === 'cooperationDays';

    // 构建查询条件
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { address: { contains: search } },
      ];
    }

    if (parentCustomerId) {
      where.parentCustomerId = parentCustomerId;
    }

    // 查询客户列表
    let customers, total;

    if (needsApplicationSort) {
      // 对于需要应用层排序的字段，先获取所有数据
      [customers, total] = await Promise.all([
        prisma.customer.findMany({
          where,
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
            extendedInfo: true,
            parentCustomerId: true,
            createdAt: true,
            updatedAt: true,
            parentCustomer: {
              select: {
                id: true,
                name: true,
              },
            },
            _count: {
              select: {
                salesOrders: true,
              },
            },
            salesOrders: {
              select: {
                id: true,
                createdAt: true,
              },
              orderBy: {
                createdAt: 'asc',
              },
              take: 1, // 只取第一个订单用于计算合作天数
            },
          },
        }),
        prisma.customer.count({ where }),
      ]);
    } else {
      // 对于数据库字段，直接在数据库层排序和分页
      [customers, total] = await Promise.all([
        prisma.customer.findMany({
          where,
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
            extendedInfo: true,
            parentCustomerId: true,
            createdAt: true,
            updatedAt: true,
            parentCustomer: {
              select: {
                id: true,
                name: true,
              },
            },
            _count: {
              select: {
                salesOrders: true,
              },
            },
            salesOrders: {
              select: {
                id: true,
                createdAt: true,
              },
              orderBy: {
                createdAt: 'asc',
              },
              take: 1, // 只取第一个订单用于计算合作天数
            },
          },
          orderBy:
            sortBy === 'transactionCount'
              ? { salesOrders: { _count: sortOrder } }
              : { [sortBy as string]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.customer.count({ where }),
      ]);
    }

    // 转换数据格式（snake_case -> camelCase）
    let formattedCustomers = customers.map(customer => {
      // 计算合作天数
      let cooperationDays: number | undefined;
      if (customer.salesOrders.length > 0) {
        const firstOrderDate = new Date(customer.salesOrders[0].createdAt);
        const currentDate = new Date();
        const timeDiff = currentDate.getTime() - firstOrderDate.getTime();
        cooperationDays = Math.floor(timeDiff / (1000 * 3600 * 24));
      }

      return {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        extendedInfo: customer.extendedInfo
          ? JSON.parse(customer.extendedInfo as string)
          : null,
        parentCustomerId: customer.parentCustomerId,
        parentCustomer: customer.parentCustomer,
        subCustomersCount: 0, // 暂时设为0，后续可以通过单独查询获取
        salesOrdersCount: customer._count.salesOrders,
        // 新增统计字段
        transactionCount: customer._count.salesOrders, // 交易次数（历史订单总数）
        cooperationDays, // 合作天数
        returnOrderCount: 0, // 退货次数（暂时设为0，待退货模块完善后更新）
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      };
    });

    // 如果需要应用层排序，在这里处理
    if (needsApplicationSort) {
      formattedCustomers.sort((a, b) => {
        if (sortBy === 'cooperationDays') {
          const aValue = a.cooperationDays ?? -1; // 未下单的排在最后
          const bValue = b.cooperationDays ?? -1;
          return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
        }
        return 0;
      });

      // 应用层分页
      const startIndex = (page - 1) * limit;
      formattedCustomers = formattedCustomers.slice(
        startIndex,
        startIndex + limit
      );
    }

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: formattedCustomers,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('获取客户列表错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取客户列表失败',
      },
      { status: 500 }
    );
  }
}

// 创建客户
export async function POST(request: NextRequest) {
  try {
    // 验证用户权限 (开发环境下临时绕过)
    if (process.env.NODE_ENV !== 'development') {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json(
          { success: false, error: '未授权访问' },
          { status: 401 }
        );
      }
    }

    const body = await request.json();

    // 验证输入数据
    const validationResult = customerValidations.create.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '输入数据格式不正确',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { name, phone, address, extendedInfo, parentCustomerId } =
      validationResult.data;

    // 如果指定了上级客户，验证其存在性
    if (parentCustomerId) {
      const parentCustomer = await prisma.customer.findUnique({
        where: { id: parentCustomerId },
      });

      if (!parentCustomer) {
        return NextResponse.json(
          { success: false, error: '指定的上级客户不存在' },
          { status: 400 }
        );
      }
    }

    // 创建客户
    const customer = await prisma.customer.create({
      data: {
        name,
        phone,
        address,
        extendedInfo: extendedInfo ? JSON.stringify(extendedInfo) : null,
        parentCustomerId,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        extendedInfo: true,
        parentCustomerId: true,
        createdAt: true,
        updatedAt: true,
        parentCustomer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // 转换数据格式
    const formattedCustomer = {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      extendedInfo: customer.extendedInfo
        ? JSON.parse(customer.extendedInfo as string)
        : null,
      parentCustomerId: customer.parentCustomerId,
      parentCustomer: customer.parentCustomer,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };

    return NextResponse.json({
      success: true,
      data: formattedCustomer,
      message: '客户创建成功',
    });
  } catch (error) {
    console.error('创建客户错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '创建客户失败',
      },
      { status: 500 }
    );
  }
}
