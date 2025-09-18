import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  customerValidations,
  paginationValidations,
} from '@/lib/validations/database';

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
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
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
    const [customers, total] = await Promise.all([
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
        },
        orderBy: { [sortBy as string]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.customer.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // 转换数据格式（snake_case -> camelCase）
    const formattedCustomers = customers.map(customer => ({
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
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    }));

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
