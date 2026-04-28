import { type NextRequest } from 'next/server';

import { resolveParams } from '@/lib/api/middleware';
import { notFoundResponse, successResponse } from '@/lib/api/response';
import { withAuth } from '@/lib/auth/api-helpers';
import { getProductFlowTracking } from '@/lib/services/product-flow-tracking-service';

export const GET = withAuth(
  async (
    request: NextRequest,
    context: {
      params?: Promise<Record<string, string>> | Record<string, string>;
    }
  ) => {
    const { id } = await resolveParams(context.params);
    const searchParams = request.nextUrl.searchParams;
    const tracking = await getProductFlowTracking(id, {
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
      customerId: searchParams.get('customerId') ?? undefined,
    });

    if (!tracking) {
      return notFoundResponse('产品不存在');
    }

    return successResponse(tracking);
  },
  { permissions: ['products:view'] }
);
