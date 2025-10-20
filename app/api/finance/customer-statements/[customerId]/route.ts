import { type NextRequest } from 'next/server';

import { resolveParams } from '@/lib/api/middleware';
import {
  errorResponse,
  successResponse,
  withAuth,
} from '@/lib/auth/api-helpers';
import { logger } from '@/lib/logger';
import { RateLimitType, withRateLimit } from '@/lib/rate-limit';
import { getCustomerStatementDetail } from '@/lib/services/customer-statement-service';

const DEFAULT_RANGE_DAYS = 30;

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getDefaultDateRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - DEFAULT_RANGE_DAYS);

  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
  };
}

function normalizeRange(
  startDate: string | null,
  endDate: string | null
): { startDate: string; endDate: string } {
  if (startDate && endDate) {
    return { startDate, endDate };
  }

  if (startDate && !endDate) {
    const parsedStart = new Date(startDate);
    if (Number.isNaN(parsedStart.valueOf())) {
      return getDefaultDateRange();
    }
    const derivedEnd = new Date(parsedStart);
    derivedEnd.setDate(parsedStart.getDate() + DEFAULT_RANGE_DAYS);
    return {
      startDate,
      endDate: formatDate(derivedEnd),
    };
  }

  if (!startDate && endDate) {
    const parsedEnd = new Date(endDate);
    if (Number.isNaN(parsedEnd.valueOf())) {
      return getDefaultDateRange();
    }
    const derivedStart = new Date(parsedEnd);
    derivedStart.setDate(parsedEnd.getDate() - DEFAULT_RANGE_DAYS);
    return {
      startDate: formatDate(derivedStart),
      endDate,
    };
  }

  return getDefaultDateRange();
}

const getCustomerStatementDetailHandler = withAuth(
  async (request: NextRequest, { params }) => {
    try {
      const { customerId } = await resolveParams(
        params as
          | Promise<Record<string, string>>
          | Record<string, string>
          | undefined
      );
      if (!customerId) {
        return errorResponse('缺少客户ID', 400);
      }

      const searchParams = new URL(request.url).searchParams;
      const { startDate, endDate } = normalizeRange(
        searchParams.get('startDate'),
        searchParams.get('endDate')
      );

      const detail = await getCustomerStatementDetail(
        customerId,
        startDate,
        endDate
      );

      return successResponse(detail);
    } catch (error) {
      logger.error(
        'finance-customer-statements',
        '获取客户对账单详情失败',
        error instanceof Error ? error : undefined
      );
      const message =
        error instanceof Error ? error.message : '获取客户对账单详情失败';
      return errorResponse(message, 500);
    }
  },
  { permissions: ['finance:view'] }
);

export const GET = withRateLimit(RateLimitType.FINANCE_READ)(
  getCustomerStatementDetailHandler
);
