// 库存盘点详情 API 路由
// 遵循 Next.js 15.4 App Router 架构和全局约定规范

import { type NextRequest } from 'next/server';

import { resolveParams } from '@/lib/api/middleware';
import {
  errorResponse,
  successResponse,
  withAuth,
} from '@/lib/auth/api-helpers';
import {
  deleteInventoryCount,
  getInventoryCountById,
  updateInventoryCount,
} from '@/lib/services/inventory-count-service';
import {
  countIdSchema,
  updateInventoryCountSchema,
} from '@/lib/validations/inventory-count';

type CountParams = { id: string };

/**
 * GET /api/inventory/counts/[id] - 获取盘点计划详情
 * 权限：需要 inventory:view 权限
 */
export const GET = withAuth(
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

    // 查询盘点计划详情
    const count = await getInventoryCountById(id);

    if (!count) {
      return errorResponse('盘点计划不存在', 404);
    }

    return successResponse(count);
  },
  { permissions: ['inventory:view'] }
);

/**
 * PUT /api/inventory/counts/[id] - 更新盘点计划
 * 权限：需要 inventory:manage 权限
 */
export const PUT = withAuth(
  async (request: NextRequest, context) => {
    // 解析路径参数
    const { id } = await resolveParams<CountParams>(
      context.params as Promise<CountParams> | CountParams | undefined
    );

    // 验证路径参数
    const idValidationResult = countIdSchema.safeParse({ id });

    if (!idValidationResult.success) {
      return errorResponse(
        `参数验证失败: ${idValidationResult.error.issues[0]?.message}`,
        400
      );
    }

    // 验证盘点计划是否存在
    const existingCount = await getInventoryCountById(id);

    if (!existingCount) {
      return errorResponse('盘点计划不存在', 404);
    }

    // 解析请求体
    const body = await request.json();
    const validationResult = updateInventoryCountSchema.safeParse(body);

    if (!validationResult.success) {
      return errorResponse(
        `数据验证失败: ${validationResult.error.issues[0]?.message}`,
        400
      );
    }

    const data = validationResult.data;

    // 更新盘点计划
    const count = await updateInventoryCount(id, data, context.user.id);

    return successResponse(count);
  },
  { permissions: ['inventory:manage'] }
);

/**
 * DELETE /api/inventory/counts/[id] - 删除盘点计划
 * 权限：需要 inventory:manage 权限
 */
export const DELETE = withAuth(
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

    // 验证盘点计划是否存在
    const existingCount = await getInventoryCountById(id);

    if (!existingCount) {
      return errorResponse('盘点计划不存在', 404);
    }

    // 删除盘点计划
    await deleteInventoryCount(id, context.user.id);

    return successResponse({ message: '删除成功' });
  },
  { permissions: ['inventory:manage'] }
);
