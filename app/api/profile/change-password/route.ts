/**
 * 个人中心 - 修改密码 API
 *
 * POST /api/profile/change-password
 *
 * 请求体：
 * {
 *   currentPassword: string;
 *   newPassword: string;
 *   confirmNewPassword: string;
 * }
 */

import bcrypt from 'bcryptjs';
import type { NextRequest } from 'next/server';

import { updatePassword } from '@/lib/auth';
import {
  errorResponse,
  successResponse,
  withAuth,
} from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { changePasswordSchema } from '@/lib/validations/user';

export const POST = withAuth(async (request: NextRequest, { user }) => {
  let body:
    | {
        currentPassword: string;
        newPassword: string;
        confirmNewPassword: string;
      }
    | undefined;

  // 1. 解析并验证输入
  try {
    body = (await request.json()) as typeof body;
    changePasswordSchema.parse(body);
  } catch (error) {
    if (error instanceof Error && 'issues' in error) {
      // Zod 错误
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const firstIssue = (error as any).issues?.[0];
      const message =
        (firstIssue && firstIssue.message) || '输入数据格式不正确';
      return errorResponse(message, 400);
    }
    return errorResponse('输入数据格式不正确', 400);
  }

  // 2. 查询当前用户
  const existingUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  if (!existingUser) {
    return errorResponse('用户不存在', 404);
  }

  if (!body) {
    return errorResponse('请求体为空', 400);
  }

  // 3. 校验当前密码
  const isCurrentPasswordValid = await bcrypt.compare(
    body.currentPassword,
    existingUser.passwordHash
  );

  if (!isCurrentPasswordValid) {
    return errorResponse('当前密码错误', 400);
  }

  // 4. 更新密码
  await updatePassword(user.id, body.newPassword);

  return successResponse<{ ok: true }>({ ok: true }, 200, '密码修改成功');
});
