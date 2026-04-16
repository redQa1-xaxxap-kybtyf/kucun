/**
 * 应收账款 API 路由
 * 职责:
 * - 身份认证和授权检查（使用新的声明式权限系统）
 * - 请求参数验证
 * - 调用服务层业务逻辑
 * - 数据序列化和 HTTP 响应格式化
 * - 错误处理和统一响应格式
 */

import { type NextRequest } from 'next/server';

import { parseOffsetPagination } from '@/lib/api/pagination';
import {
  errorResponse,
  successResponse,
  withAuth,
} from '@/lib/auth/api-helpers';
import { buildCacheKey, getOrSetJSON } from '@/lib/cache';
import { FINANCE_CACHE_TTL_SECONDS } from '@/lib/constants/cache';
import { logger } from '@/lib/logger';
import { getReceivables } from '@/lib/services/receivables-service';
import { accountsReceivableQuerySchema } from '@/lib/validations/payment';

// ==================== API 路由 ====================

/**
 * GET /api/finance/receivables - 获取应收账款列表
 * 权限：需要 finance:view 权限
 */
export const GET = withAuth(
  async (request: NextRequest, { user }) => {
    try {
      // 参数验证
      const searchParams = request.nextUrl.searchParams;
      const normalized = new URLSearchParams(searchParams);
      if (!normalized.get('limit') && normalized.get('pageSize')) {
        normalized.set('limit', normalized.get('pageSize') as string);
      }

      let page: number;
      let limit: number;
      try {
        ({ page, limit } = parseOffsetPagination(normalized, {
          defaultLimit: 10,
          maxLimit: 100,
          strict: true,
          pageFieldLabel: '页码',
          limitFieldLabel: '每页数量',
        }));
      } catch (error) {
        return errorResponse(
          error instanceof Error ? error.message : '分页参数格式不正确',
          400
        );
      }

      const paymentStatusParam =
        searchParams.get('paymentStatus') ??
        searchParams.get('status') ??
        undefined;

      const validationResult = accountsReceivableQuerySchema.safeParse({
        page,
        limit,
        search: searchParams.get('search') || undefined,
        customerId: searchParams.get('customerId') || undefined,
        paymentStatus: paymentStatusParam || undefined,
        startDate: searchParams.get('startDate') || undefined,
        endDate: searchParams.get('endDate') || undefined,
        sortBy: searchParams.get('sortBy') || undefined,
        sortOrder: searchParams.get('sortOrder') || undefined,
      });

      if (!validationResult.success) {
        return errorResponse(
          `提交内容有误： ${validationResult.error.issues[0]?.message}`,
          400
        );
      }

      // 构建缓存键 (v2: 包含roundingAdjustment修复)
      const cacheKey = buildCacheKey(
        `finance:receivables:list:v2:${user.id}`,
        validationResult.data
      );

      // 使用缓存包装查询
      const result = await getOrSetJSON(
        cacheKey,
        async () => {
          // 调用服务层
          const data = await getReceivables(validationResult.data);
          return data;
        },
        FINANCE_CACHE_TTL_SECONDS,
        {
          enableRandomTTL: true,
          enableNullCache: true,
        }
      );

      // 返回响应
      return successResponse(result);
    } catch (error) {
      logger.error('finance', '获取应收账款失败', error, {
        userId: user.id,
      });
      const errorMessage =
        error instanceof Error ? error.message : '获取应收账款失败';
      return errorResponse(errorMessage, 500);
    }
  },
  { permissions: ['finance:view'] }
);

