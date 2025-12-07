/**
 * 个人资料 API
 *
 * GET  /api/profile        获取当前登录用户的基本信息
 * PUT  /api/profile        更新当前用户的基本信息（目前支持：姓名）
 *
 * 严格遵循全栈项目统一约定规范：
 * - 使用 withAuth 做认证和 CSRF 校验
 * - 使用 prisma 直接访问 users 表
 * - 使用统一的 successResponse / errorResponse 返回结构
 */

import type { NextRequest } from 'next/server';
import { z } from 'zod';

import {
  withAuth,
  errorResponse,
  successResponse,
} from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';

// 个人资料响应类型
interface ProfileResponse {
  id: string;
  email: string;
  username: string;
  name: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// 个人资料更新 schema（允许修改姓名和邮箱）
const ProfileUpdateSchema = z.object({
  name: z
    .string({ message: '姓名必须是字符串' })
    .min(1, { message: '请输入姓名' })
    .max(100, { message: '姓名不能超过100个字符' }),
  email: z
    .string({ message: '邮箱必须是字符串' })
    .email({ message: '请输入有效的邮箱地址' })
    .max(100, { message: '邮箱不能超过100个字符' }),
});

// GET - 获取当前用户的个人资料
export const GET = withAuth(async (_request, { user }) => {
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!dbUser) {
    return errorResponse('用户不存在', 404);
  }

  const data: ProfileResponse = {
    id: dbUser.id,
    email: dbUser.email,
    username: dbUser.username,
    name: dbUser.name,
    role: dbUser.role,
    status: dbUser.status,
    createdAt: dbUser.createdAt.toISOString(),
    updatedAt: dbUser.updatedAt.toISOString(),
  };

  return successResponse<ProfileResponse>(data);
});

// PUT - 更新当前用户的个人资料（目前仅允许修改姓名）
export const PUT = withAuth(async (request: NextRequest, { user }) => {
  let parsed: z.infer<typeof ProfileUpdateSchema> | undefined;

  try {
    const body = await request.json();
    parsed = ProfileUpdateSchema.parse(body);
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message || '输入数据格式不正确'
        : '输入数据格式不正确';
    return errorResponse(message, 400);
  }

  // 检查邮箱是否已被其他用户使用
  const existingEmailUser = await prisma.user.findFirst({
    where: {
      email: parsed.email,
      id: { not: user.id },
    },
    select: { id: true },
  });

  if (existingEmailUser) {
    return errorResponse('该邮箱已被其他账户使用', 400);
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      name: parsed.name,
      email: parsed.email,
    },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const data: ProfileResponse = {
    id: updatedUser.id,
    email: updatedUser.email,
    username: updatedUser.username,
    name: updatedUser.name,
    role: updatedUser.role,
    status: updatedUser.status,
    createdAt: updatedUser.createdAt.toISOString(),
    updatedAt: updatedUser.updatedAt.toISOString(),
  };

  return successResponse<ProfileResponse>(data, 200, '个人资料已更新');
});
