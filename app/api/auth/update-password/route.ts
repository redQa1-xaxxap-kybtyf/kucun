import bcrypt from 'bcryptjs';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { updatePassword } from '@/lib/auth';
import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
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

export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
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
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });

    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      );
    }

    // 验证当前密码
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      currentUser.passwordHash
    );

    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { success: false, error: '当前密码错误' },
        { status: 400 }
      );
    }

    // 更新密码
    await updatePassword(user.id, newPassword);

    return NextResponse.json({
      success: true,
      message: '密码更新成功',
    });
  } catch (error) {
    logger.error('auth-update-password', '密码更新失败', error, {
      userId: user.id,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '密码更新失败',
      },
      { status: 500 }
    );
  }
});
