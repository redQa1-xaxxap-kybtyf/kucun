// 提交盘点数据 API 路由
// 遵循 Next.js 15.4 App Router 架构和全局约定规范

import { type NextRequest } from 'next/server';

import { resolveParams } from '@/lib/api/middleware';
import {
  errorResponse,
  successResponse,
  withAuth,
} from '@/lib/auth/api-helpers';
import { submitCountData } from '@/lib/services/inventory-count-service';
import {
  countIdSchema,
  submitCountDataSchema,
} from '@/lib/validations/inventory-count';

type CountParams = { id: string };

/**
 * POST /api/inventory/counts/[id]/submit - 提交盘点数据
 * 权限：需要 inventory:manage 权限
 */
export const POST = withAuth(
  async (request: NextRequest, context) => {
    // 解析路径参数
    const { id } = await resolveParams<CountParams>(
      context.params as Promise<CountParams> | CountParams | undefined
    );

    // 验证路径参数
    const idValidationResult = countIdSchema.safeParse({ id });

    if (!idValidationResult.success) {
      return errorResponse(
        `提交内容有误： ${idValidationResult.error.issues[0]?.message}`,
        400
      );
    }

    // 解析请求体
    const body = await request.json();
    const validationResult = submitCountDataSchema.safeParse(body);

    if (!validationResult.success) {
      return errorResponse(
        `数据验证失败: ${validationResult.error.issues[0]?.message}`,
        400
      );
    }

    const data = validationResult.data;

    // 提交盘点数据
    const result = await submitCountData(id, data, context.user.id);

    return successResponse(result);
  },
  { permissions: ['inventory:manage'] }
);

