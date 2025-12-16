/**
 * 客户搜索API（轻量级）
 * 专为客户选择器组件优化，只返回必要字段
 */

import { type NextRequest, NextResponse } from 'next/server';

import { searchCustomersLightweight } from '@/lib/api/customer-handlers';
import { ApiError } from '@/lib/api/errors';
import { withErrorHandling } from '@/lib/api/middleware';
import { parseOffsetPagination } from '@/lib/api/pagination';
import { withAuth } from '@/lib/auth/api-helpers';

/**
 * 搜索客户（轻量级）
 * GET /api/customers/search?q=关键词&limit=20&excludeId=xxx
 */
export const GET = withAuth(
  async (request: NextRequest) =>
    withErrorHandling(async request => {
      const searchParams = request.nextUrl.searchParams;

      const search = searchParams.get('q') || '';

      let limit: number;
      try {
        const parsed = parseOffsetPagination(searchParams, {
          defaultLimit: 20,
          maxLimit: 50,
          strict: true,
          pageParamName: '__unused',
          pageFieldLabel: '页码',
          limitFieldLabel: '限制数量',
        });
        limit = parsed.limit;
      } catch (error) {
        throw ApiError.badRequest(
          error instanceof Error ? error.message : '限制数量格式不正确'
        );
      }

      const excludeId = searchParams.get('excludeId') || undefined;

      const customers = await searchCustomersLightweight({
        search,
        limit,
        excludeId,
      });

      return NextResponse.json({
        success: true,
        data: customers,
      });
    })(request, {}),
  { permissions: ['customers:view'] }
);
