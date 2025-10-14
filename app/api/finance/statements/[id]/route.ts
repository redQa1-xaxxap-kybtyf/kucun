import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import type { AuthUser } from '@/lib/auth/context';
import { ApiError } from '@/lib/api/errors';
import { resolveParams } from '@/lib/api/middleware';
import { logger } from '@/lib/logger';
import {
  getPartnerStatementDetail,
  type PartnerStatementDetailOptions,
} from '@/lib/services/partner-ledger-service';

export const GET = withAuth(
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

      const searchParams = new URL(request.url).searchParams;
      const page = parseInt(searchParams.get('page') || '1', 10);
      const pageSizeParam =
        searchParams.get('pageSize') || searchParams.get('limit');
      const pageSize = pageSizeParam ? parseInt(pageSizeParam, 10) : 50;

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
  }
);
