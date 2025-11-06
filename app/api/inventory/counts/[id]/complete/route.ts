// 完成盘点 API 路由
// 遵循 Next.js 15.4 App Router 架构和全局约定规范

import { type NextRequest } from 'next/server';

import { resolveParams } from '@/lib/api/middleware';
import {
  errorResponse,
  successResponse,
  withAuth,
} from '@/lib/auth/api-helpers';
import { completeCount } from '@/lib/services/inventory-count-service';
import { countIdSchema } from '@/lib/validations/inventory-count';

type CountParams = { id: string };

/**
 * POST /api/inventory/counts/[id]/complete - 完成盘点
 * 权限：需要 inventory:manage 权限
 */
export const POST = withAuth(
  async (_request: NextRequest, context) => {
    // 解析路径参数
    const { id } = await resolveParams<CountParams>(
      context.params as Promise<CountParams> | CountParams | undefined
    );

    // 验证路径参数
    const validationResult = countIdSchema.safeParse({ id });

    if (!validationResult.success) {
      return errorResponse(
        `参数验证失败: ${validationResult.error.issues[0]?.message}`,
        400
      );
    }

    // 完成盘点
    const count = await completeCount(id, context.user.id);

    return successResponse(count);
  },
  { permissions: ['inventory:manage'] }
);
