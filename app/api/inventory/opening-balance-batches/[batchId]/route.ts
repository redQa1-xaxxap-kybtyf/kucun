import { type NextRequest, NextResponse } from 'next/server';

import { resolveParams, withErrorHandling } from '@/lib/api/middleware';
import { withAuth } from '@/lib/auth/api-helpers';
import { RateLimitType, withRateLimit } from '@/lib/rate-limit';
import { getOpeningBalanceImportBatchDetail } from '@/lib/services/opening-balance-import-batch-service';
import { openingBalanceImportBatchIdSchema } from '@/lib/validations/opening-balance-import-batch';

const getOpeningBalanceBatchHandler = withAuth(
  async (
    request: NextRequest,
    context: {
      params?: Promise<Record<string, string>> | Record<string, string>;
    }
  ) =>
    withErrorHandling(async (_req, ctx) => {
      const { batchId } = await resolveParams(ctx.params);
      const validatedBatchId = openingBalanceImportBatchIdSchema.parse(batchId);

      const data = await getOpeningBalanceImportBatchDetail(validatedBatchId);

      return NextResponse.json({
        success: true,
        data,
      });
    })(request, context),
  { permissions: ['inventory:view'] }
);

export const GET = withRateLimit(RateLimitType.READ)(
  getOpeningBalanceBatchHandler
);
