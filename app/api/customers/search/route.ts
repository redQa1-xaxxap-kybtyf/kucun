/**
 * 客户搜索API（轻量级）
 * 专为客户选择器组件优化，只返回必要字段
 */

import { type NextRequest, NextResponse } from 'next/server';

import { searchCustomersLightweight } from '@/lib/api/customer-handlers';
import { withErrorHandling } from '@/lib/api/middleware';
import { withAuth } from '@/lib/auth/api-helpers';

/**
 * 搜索客户（轻量级）
 * GET /api/customers/search?q=关键词&limit=20&excludeId=xxx
 */
export const GET = withAuth(
  async (request: NextRequest) =>
    withErrorHandling(async request => {
      const { searchParams } = new URL(request.url);

      const search = searchParams.get('q') || '';
      const limit = Math.min(
        parseInt(searchParams.get('limit') || '20', 10),
        50
      ); // 最多返回50条
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
