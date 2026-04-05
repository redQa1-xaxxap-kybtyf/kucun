import { type NextRequest, NextResponse } from 'next/server';

import { resolveParams, withErrorHandling } from '@/lib/api/middleware';
import { withAuth } from '@/lib/auth/api-helpers';
import { invalidateInventoryCache } from '@/lib/cache/inventory-cache';
import { RateLimitType, withRateLimit } from '@/lib/rate-limit';
import { deleteOpeningBalanceImportBatch } from '@/lib/services/opening-balance-import-batch-service';
import { openingBalanceImportBatchIdSchema } from '@/lib/validations/opening-balance-import-batch';

const deleteOpeningBalanceBatchHandler = withAuth(
  async (
    request: NextRequest,
    context: {
      params?: Promise<Record<string, string>> | Record<string, string>;
    }
  ) =>
    withErrorHandling(async (_req, ctx) => {
      const { batchId } = await resolveParams(ctx.params);
      const validatedBatchId = openingBalanceImportBatchIdSchema.parse(batchId);

      const data = await deleteOpeningBalanceImportBatch(validatedBatchId);

      await Promise.all(
        data.productIds.map(productId => invalidateInventoryCache(productId))
      );

      return NextResponse.json({
        success: true,
        data,
        message: `已删除 ${data.deletedCount} 条期初记录`,
      });
    })(request, context),
  { permissions: ['inventory:adjust'] }
);

export const POST = withRateLimit(RateLimitType.WRITE)(
  deleteOpeningBalanceBatchHandler
);
