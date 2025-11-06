// 盘点统计 API 路由
// 遵循 Next.js 15.4 App Router 架构和全局约定规范

import { type NextRequest } from 'next/server';
import { z } from 'zod';

import {
  errorResponse,
  successResponse,
  withAuth,
} from '@/lib/auth/api-helpers';
import { getCountStatistics } from '@/lib/services/inventory-count-service';
import { countStatusSchema } from '@/lib/validations/inventory-count';

// 统计查询参数验证规则
const statisticsQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: countStatusSchema.optional(),
});

/**
 * GET /api/inventory/counts/statistics - 获取盘点统计数据
 * 权限：需要 inventory:view 权限
 */
export const GET = withAuth(
  async (request: NextRequest) => {
    // 解析查询参数
    const searchParams = new URL(request.url).searchParams;
    const queryParams = {
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      status: searchParams.get('status') || undefined,
    };

    // 验证查询参数
    const validationResult = statisticsQuerySchema.safeParse(queryParams);

    if (!validationResult.success) {
      return errorResponse(
        `查询参数验证失败: ${validationResult.error.issues[0]?.message}`,
        400
      );
    }

    const parsedQuery = validationResult.data;

    // 验证日期范围
    if (
      parsedQuery.startDate &&
      parsedQuery.endDate &&
      new Date(parsedQuery.endDate) < new Date(parsedQuery.startDate)
    ) {
      return errorResponse('结束日期不能早于开始日期', 400);
    }

    // 获取盘点统计数据
    const statistics = await getCountStatistics(parsedQuery);

    return successResponse(statistics);
  },
  { permissions: ['inventory:view'] }
);
