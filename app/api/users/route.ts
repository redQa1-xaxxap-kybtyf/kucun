import { getServerSession } from 'next-auth';
import { NextResponse, type NextRequest } from 'next/server';

import { authOptions, createUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { paginationConfig } from '@/lib/env';
import { paginationValidations, userValidations } from '@/lib/validations/base';

// 获取用户列表 (仅管理员)
export async function GET(request: NextRequest) {
  try {
    // 验证管理员权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '权限不足' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const queryParams = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(
        searchParams.get('limit') || paginationConfig.defaultPageSize.toString()
      ),
      search: searchParams.get('search') || undefined,
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc',
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

    // 构建查询条件
    const where = search
      ? {
          OR: [{ name: { contains: search } }, { email: { contains: search } }],
        }
      : {};

    // 查询用户列表
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { [sortBy as string]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('获取用户列表错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取用户列表失败',
      },
      { status: 500 }
    );
  }
}

// 创建用户 (仅管理员)
export async function POST(request: NextRequest) {
  try {
    // 验证管理员权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '权限不足' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // 验证输入数据
    const validationResult = userValidations.create.safeParse(body);
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

    const { email, name, password, role } = validationResult.data;

    // 创建用户
    const user = await createUser({
      email,
      username: email, // 使用email作为默认username
      name,
      password,
      role,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
      },
      message: '用户创建成功',
    });
  } catch (error) {
    console.error('创建用户错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '创建用户失败',
      },
      { status: 500 }
    );
  }
}
