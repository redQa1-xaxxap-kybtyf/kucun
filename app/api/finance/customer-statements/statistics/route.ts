import {
  errorResponse,
  successResponse,
  withAuth,
} from '@/lib/auth/api-helpers';
import { logger } from '@/lib/logger';
import { getCustomerStatementStatistics } from '@/lib/services/customer-statement-service';

export const GET = withAuth(
  async () => {
    try {
      const statistics = await getCustomerStatementStatistics();
      return successResponse(statistics);
    } catch (error) {
      logger.error(
        'finance-customer-statements',
        '获取客户对账单统计失败',
        error instanceof Error ? error : undefined
      );
      const message =
        error instanceof Error ? error.message : '获取客户对账单统计失败';
      return errorResponse(message, 500);
    }
  },
  { permissions: ['finance:view'] }
);
