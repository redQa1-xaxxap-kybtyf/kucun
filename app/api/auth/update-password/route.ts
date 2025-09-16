import bcrypt from 'bcryptjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions, updatePassword } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { userValidations } from '@/lib/validations/database';

export async function POST(request: NextRequest) {
  try {
    // 验证用户会话
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // 验证输入数据
    const validationResult = userValidations.updatePassword.safeParse(body);
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

    const { currentPassword, newPassword } = validationResult.data;

    // 获取用户当前密码
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      );
    }

    // 验证当前密码
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash
    );

    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { success: false, error: '当前密码错误' },
        { status: 400 }
      );
    }

    // 更新密码
    await updatePassword(session.user.id, newPassword);

    return NextResponse.json({
      success: true,
      message: '密码更新成功',
    });
  } catch (error) {
    console.error('密码更新错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '密码更新失败',
      },
      { status: 500 }
    );
  }
}
