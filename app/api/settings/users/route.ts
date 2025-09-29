/**
 * 用户管理API路由
 * 严格遵循全栈项目统一约定规范
 */

import bcrypt from 'bcryptjs';
import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { paginationConfig } from '@/lib/env';
import { extractRequestInfo, logUserAction } from '@/lib/logger';
import {
  CreateUserSchema,
  UpdateUserSchema,
  UserListQuerySchema,
} from '@/lib/schemas/settings';
import type {
  UpdateUserRequest,
  UserListResponse,
  UserManagementUser,
} from '@/lib/types/settings';

// 转换数据库用户为API响应格式
function transformUser(user: {
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): UserManagementUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    role: user.role as 'admin' | 'sales',
    status: user.status as 'active' | 'inactive',
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

// GET - 获取用户列表
export async function GET(request: NextRequest) {
  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 权限检查 - 只有管理员可以访问
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '权限不足，只有管理员可以管理用户' },
        { status: 403 }
      );
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const queryParams = {
      page: searchParams.get('page') || '1',
      limit:
        searchParams.get('limit') ||
        paginationConfig.defaultPageSize.toString(),
      search: searchParams.get('search'),
      role: searchParams.get('role'),
      status: searchParams.get('status'),
    };

    // 验证查询参数
    const validatedQuery = UserListQuerySchema.parse(queryParams);

    // 构建查询条件
    const where: {
      OR?: Array<{
        username?: { contains: string; mode: 'insensitive' };
        email?: { contains: string; mode: 'insensitive' };
        name?: { contains: string; mode: 'insensitive' };
      }>;
      role?: string;
      status?: string;
    } = {};

    if (validatedQuery.search) {
      where.OR = [
        { username: { contains: validatedQuery.search, mode: 'insensitive' } },
        { email: { contains: validatedQuery.search, mode: 'insensitive' } },
        { name: { contains: validatedQuery.search, mode: 'insensitive' } },
      ];
    }

    if (validatedQuery.role && validatedQuery.role !== null) {
      where.role = validatedQuery.role;
    }

    if (validatedQuery.status && validatedQuery.status !== null) {
      where.status = validatedQuery.status;
    }

    // 计算分页
    const page = validatedQuery.page || 1;
    const limit = validatedQuery.limit || paginationConfig.defaultPageSize;
    const skip = (page - 1) * limit;

    // 查询用户总数
    const total = await prisma.user.count({ where });

    // 查询用户列表
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    // 构建响应数据
    const response: UserListResponse = {
      users: users.map(transformUser),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取用户列表失败',
      },
      { status: 500 }
    );
  }
}

// POST - 创建新用户
export async function POST(request: NextRequest) {
  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 权限检查 - 只有管理员可以创建用户
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '权限不足，只有管理员可以创建用户' },
        { status: 403 }
      );
    }

    // 解析请求体
    const body = await request.json();

    // 验证输入数据
    const validatedData = CreateUserSchema.parse(body);

    // 检查用户名是否已存在
    const existingUsername = await prisma.user.findUnique({
      where: { username: validatedData.username },
    });

    if (existingUsername) {
      return NextResponse.json(
        { success: false, error: '用户名已存在' },
        { status: 400 }
      );
    }

    // 检查邮箱是否已存在
    const existingEmail = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingEmail) {
      return NextResponse.json(
        { success: false, error: '邮箱已存在' },
        { status: 400 }
      );
    }

    // 加密密码
    const passwordHash = await bcrypt.hash(validatedData.password, 10);

    // 创建用户
    const newUser = await prisma.user.create({
      data: {
        username: validatedData.username,
        email: validatedData.email,
        name: validatedData.name,
        passwordHash,
        role: validatedData.role,
        status: 'active',
      },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 记录用户操作日志
    const requestInfo = extractRequestInfo(request);
    await logUserAction(
      'create_user',
      `创建新用户账户：${newUser.username}`,
      session.user.id,
      requestInfo.ipAddress,
      requestInfo.userAgent,
      {
        targetUserId: newUser.id,
        targetUsername: newUser.username,
        targetRole: newUser.role,
      }
    );

    return NextResponse.json({
      success: true,
      data: transformUser(newUser),
      message: '用户创建成功',
    });
  } catch (error) {
    console.error('创建用户失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '创建用户失败',
      },
      { status: 500 }
    );
  }
}

// 验证用户更新权限和数据
async function validateUserUpdate(
  userId: string,
  currentUserId: string,
  validatedData: UpdateUserRequest
) {
  // 检查用户是否存在
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!existingUser) {
    return { error: '用户不存在', status: 404 };
  }

  // 防止用户修改自己的角色或删除自己
  if (userId === currentUserId) {
    if (validatedData.role && validatedData.role !== existingUser.role) {
      return { error: '不能修改自己的角色', status: 400 };
    }
    if (validatedData.status === 'inactive') {
      return { error: '不能禁用自己的账户', status: 400 };
    }
  }

  // 检查用户名是否已被其他用户使用
  if (validatedData.username) {
    const existingUsername = await prisma.user.findFirst({
      where: {
        username: validatedData.username,
        id: { not: userId },
      },
    });

    if (existingUsername) {
      return { error: '用户名已被其他用户使用', status: 400 };
    }
  }

  // 检查邮箱是否已被其他用户使用
  if (validatedData.email) {
    const existingEmail = await prisma.user.findFirst({
      where: {
        email: validatedData.email,
        id: { not: userId },
      },
    });

    if (existingEmail) {
      return { error: '邮箱已被其他用户使用', status: 400 };
    }
  }

  return { success: true };
}

// PUT - 更新用户信息
export async function PUT(request: NextRequest) {
  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 权限检查 - 只有管理员可以更新用户
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '权限不足，只有管理员可以更新用户' },
        { status: 403 }
      );
    }

    // 解析请求体
    const body = await request.json();

    // 验证输入数据
    const validatedData = UpdateUserSchema.parse(body);
    const { userId, ...updateData } = validatedData;

    // 验证用户更新权限和数据
    const validation = await validateUserUpdate(
      userId,
      session.user.id,
      validatedData
    );
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: validation.status }
      );
    }

    // 更新用户
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 记录用户操作日志
    const requestInfo = extractRequestInfo(request);
    await logUserAction(
      'update_user',
      `修改用户信息：${updatedUser.username}`,
      session.user.id,
      requestInfo.ipAddress,
      requestInfo.userAgent,
      {
        targetUserId: updatedUser.id,
        targetUsername: updatedUser.username,
        changes: updateData,
      }
    );

    return NextResponse.json({
      success: true,
      data: transformUser(updatedUser),
      message: '用户更新成功',
    });
  } catch (error) {
    console.error('更新用户失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '更新用户失败',
      },
      { status: 500 }
    );
  }
}

// DELETE - 软删除用户（设置状态为inactive）
export async function DELETE(request: NextRequest) {
  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 权限检查 - 只有管理员可以删除用户
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '权限不足，只有管理员可以删除用户' },
        { status: 403 }
      );
    }

    // 解析请求体
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: '用户ID不能为空' },
        { status: 400 }
      );
    }

    // 防止用户删除自己
    if (userId === session.user.id) {
      return NextResponse.json(
        { success: false, error: '不能删除自己的账户' },
        { status: 400 }
      );
    }

    // 检查用户是否存在
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      );
    }

    // 软删除用户（设置状态为inactive）
    const deletedUser = await prisma.user.update({
      where: { id: userId },
      data: { status: 'inactive' },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 记录用户操作日志
    const requestInfo = extractRequestInfo(request);
    await logUserAction(
      'delete_user',
      `删除用户账户：${deletedUser.username}`,
      session.user.id,
      requestInfo.ipAddress,
      requestInfo.userAgent,
      {
        targetUserId: deletedUser.id,
        targetUsername: deletedUser.username,
        targetRole: deletedUser.role,
      }
    );

    return NextResponse.json({
      success: true,
      data: transformUser(deletedUser),
      message: '用户删除成功',
    });
  } catch (error) {
    console.error('删除用户失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '删除用户失败',
      },
      { status: 500 }
    );
  }
}
