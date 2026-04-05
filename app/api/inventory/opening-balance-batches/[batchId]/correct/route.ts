import { type NextRequest, NextResponse } from 'next/server';

import { resolveParams, withErrorHandling } from '@/lib/api/middleware';
import { withAuth } from '@/lib/auth/api-helpers';
import { invalidateInventoryCache } from '@/lib/cache/inventory-cache';
import { RateLimitType, withRateLimit } from '@/lib/rate-limit';
import { correctOpeningBalanceImportBatch } from '@/lib/services/opening-balance-import-batch-service';
import {
  openingBalanceImportBatchCorrectionSchema,
  openingBalanceImportBatchIdSchema,
} from '@/lib/validations/opening-balance-import-batch';

const correctOpeningBalanceBatchHandler = withAuth(
  async (
    request: NextRequest,
    context: {
      params?: Promise<Record<string, string>> | Record<string, string>;
    }
  ) =>
    withErrorHandling(async (_req, ctx) => {
      const { batchId } = await resolveParams(ctx.params);
      const validatedBatchId = openingBalanceImportBatchIdSchema.parse(batchId);
      const body = await request.json();
      const validatedBody = openingBalanceImportBatchCorrectionSchema.parse(body);

      const data = await correctOpeningBalanceImportBatch(
        validatedBatchId,
        validatedBody.corrections
      );

      await Promise.all(
        data.productIds.map(productId => invalidateInventoryCache(productId))
      );

      return NextResponse.json({
        success: true,
        data,
        message:
          data.failedCount > 0
            ? `已更正 ${data.updatedCount} 条，失败 ${data.failedCount} 条`
            : `已更正 ${data.updatedCount} 条期初记录`,
      });
    })(request, context),
  { permissions: ['inventory:adjust'] }
);

export const POST = withRateLimit(RateLimitType.WRITE)(
  correctOpeningBalanceBatchHandler
);
