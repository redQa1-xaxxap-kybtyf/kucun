import bcrypt from 'bcryptjs';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { verifyApiAuth } from '@/lib/api-helpers';
import { updatePassword } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { baseValidations } from '@/lib/validations/base';

// 更新密码验证规则
const updatePasswordSchema = z
  .object({
    currentPassword: baseValidations.password,
    newPassword: baseValidations.password,
    confirmPassword: baseValidations.password,
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: '新密码和确认密码不匹配',
    path: ['confirmPassword'],
  });

export async function POST(request: NextRequest) {
  try {
    // 验证用户会话 - 使用中间件传递的头部信息
    const auth = verifyApiAuth(request);
    if (!auth.success || !auth.userId) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // 验证输入数据
    const validationResult = updatePasswordSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '输入数据格式不正确',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = validationResult.data;

    // 获取用户当前密码
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
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
    await updatePassword(auth.userId, newPassword);

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
