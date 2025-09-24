/**
 * 用户密码重置API路由
 * 严格遵循全栈项目统一约定规范
 */

import bcrypt from 'bcryptjs';
import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ResetPasswordSchema } from '@/lib/schemas/settings';

// POST - 重置用户密码
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

    // 权限检查 - 只有管理员可以重置密码
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '权限不足，只有管理员可以重置用户密码' },
        { status: 403 }
      );
    }

    // 解析请求体
    const body = await request.json();

    // 验证输入数据
    const validatedData = ResetPasswordSchema.parse(body);

    // 检查用户是否存在
    const existingUser = await prisma.user.findUnique({
      where: { id: validatedData.userId },
    });

    if (!existingUser) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      );
    }

    // 加密新密码
    const passwordHash = await bcrypt.hash(validatedData.newPassword, 10);

    // 更新用户密码
    await prisma.user.update({
      where: { id: validatedData.userId },
      data: { passwordHash },
    });

    return NextResponse.json({
      success: true,
      message: '密码重置成功',
    });
  } catch (error) {
    console.error('重置密码失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '重置密码失败',
      },
      { status: 500 }
    );
  }
}
