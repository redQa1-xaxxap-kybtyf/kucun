// 库存盘点 API 路由
// 遵循 Next.js 15.4 App Router 架构和全局约定规范

import { type NextRequest } from 'next/server';

import { parseOffsetPagination } from '@/lib/api/pagination';
import {
  errorResponse,
  successResponse,
  withAuth,
} from '@/lib/auth/api-helpers';
import {
  createInventoryCount,
  getInventoryCounts,
} from '@/lib/services/inventory-count-service';
import {
  createInventoryCountSchema,
  inventoryCountQuerySchema,
} from '@/lib/validations/inventory-count';

/**
 * GET /api/inventory/counts - 获取盘点计划列表
 * 权限：需要 inventory:view 权限
 */
export const GET = withAuth(
  async (request: NextRequest) => {
    // 解析查询参数
    const searchParams = request.nextUrl.searchParams;
    const normalized = new URLSearchParams(searchParams);
    if (!normalized.get('pageSize') && normalized.get('limit')) {
      normalized.set('pageSize', normalized.get('limit') as string);
    }

    let page: number;
    let pageSize: number;
    try {
      const parsed = parseOffsetPagination(normalized, {
        defaultPage: 1,
        defaultLimit: 20,
        maxLimit: 100,
        strict: true,
        pageFieldLabel: '页码',
        limitFieldLabel: '每页数量',
        limitParamName: 'pageSize',
      });
      page = parsed.page;
      pageSize = parsed.limit;
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : '分页参数格式不正确',
        400
      );
    }
    const queryParams = {
      page,
      pageSize,
      status: searchParams.get('status') || undefined,
      countType: searchParams.get('countType') || undefined,
      location: searchParams.get('location') || undefined,
      categoryId: searchParams.get('categoryId') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: searchParams.get('sortOrder') || undefined,
    };

    // 验证查询参数
    const validationResult = inventoryCountQuerySchema.safeParse(queryParams);

    if (!validationResult.success) {
      return errorResponse(
        `查询条件有误： ${validationResult.error.issues[0]?.message}`,
        400
      );
    }

    const parsedQuery = validationResult.data;

    // 过滤掉 null 值
    const cleanQuery = {
      ...parsedQuery,
      startDate: parsedQuery.startDate ?? undefined,
      endDate: parsedQuery.endDate ?? undefined,
    };

    // 查询盘点计划列表
    const response = await getInventoryCounts(cleanQuery);

    return successResponse(response);
  },
  { permissions: ['inventory:view'] }
);

/**
 * POST /api/inventory/counts - 创建盘点计划
 * 权限：需要 inventory:manage 权限
 */
export const POST = withAuth(
  async (request: NextRequest, { user }) => {
    // 解析请求体
    const body = await request.json();
    const validationResult = createInventoryCountSchema.safeParse(body);

    if (!validationResult.success) {
      return errorResponse(
        `数据验证失败: ${validationResult.error.issues[0]?.message}`,
        400
      );
    }

    const data = validationResult.data;

    // 创建盘点计划
    const count = await createInventoryCount(data, user.id);

    return successResponse(count);
  },
  { permissions: ['inventory:manage'] }
);

