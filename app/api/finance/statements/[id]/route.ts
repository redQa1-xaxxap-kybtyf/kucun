import { NextResponse, type NextRequest } from 'next/server';

import { ApiError } from '@/lib/api/errors';
import { parseOffsetPagination } from '@/lib/api/pagination';
import { resolveParams } from '@/lib/api/middleware';
import { withAuth } from '@/lib/auth/api-helpers';
import type { AuthUser } from '@/lib/auth/context';
import { logger } from '@/lib/logger';
import { RateLimitType, withRateLimit } from '@/lib/rate-limit';
import {
  getPartnerStatementDetail,
  type PartnerStatementDetailOptions,
} from '@/lib/services/partner-ledger-service';

const getStatementDetailHandler = withAuth(
  async (
    request: NextRequest,
    context: {
      user: AuthUser;
      params?: Promise<Record<string, string>> | Record<string, string>;
    }
  ) => {
    let partnerId: string | undefined;
    try {
      const { id } = await resolveParams(context.params);
      partnerId = id;

      const searchParams = request.nextUrl.searchParams;
      const normalized = new URLSearchParams(searchParams);
      if (!normalized.get('pageSize') && normalized.get('limit')) {
        normalized.set('pageSize', normalized.get('limit') as string);
      }

      let page: number;
      let pageSize: number;
      try {
        const parsed = parseOffsetPagination(normalized, {
          defaultLimit: 50,
          strict: true,
          pageFieldLabel: '页码',
          limitFieldLabel: '每页数量',
          limitParamName: 'pageSize',
        });
        page = parsed.page;
        pageSize = parsed.limit;
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error:
              error instanceof Error ? error.message : '分页参数格式不正确',
          },
          { status: 400 }
        );
      }

      const options: PartnerStatementDetailOptions = {
        page,
        pageSize,
      };

      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');
      if (startDate) {
        options.startDate = startDate;
      }
      if (endDate) {
        options.endDate = endDate;
      }

      const detail = await getPartnerStatementDetail(id, options);

      return NextResponse.json({
        success: true,
        data: detail,
      });
    } catch (error) {
      logger.error(
        'finance-statements',
        '获取账单详情失败',
        error,
        partnerId ? { partnerId } : undefined
      );

      if (error instanceof ApiError) {
        throw error;
      }

      const message =
        error instanceof Error ? error.message : '获取账单详情失败';

      if (
        message.includes('未找到伙伴') ||
        message.toLowerCase().includes('not found')
      ) {
        return NextResponse.json(
          { success: false, error: '账本不存在或已被移除' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { success: false, error: message },
        { status: 500 }
      );
    }
  },
  { permissions: ['finance:view'] }
);

export const GET = withRateLimit(RateLimitType.FINANCE_READ)(
  getStatementDetailHandler
);
