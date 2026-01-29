import { type NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { previewDataManagement } from '@/lib/services/data-management/data-management-service';

export const POST = withAuth(
  async (request: NextRequest) => {
    const body = (await request.json()) as { action?: unknown };
    if (body.action !== 'reset_trial' && body.action !== 'cleanup_test') {
      return NextResponse.json(
        { success: false, error: 'action 必须为 reset_trial 或 cleanup_test' },
        { status: 400 }
      );
    }

    const preview = await previewDataManagement(body.action);
    return NextResponse.json({ success: true, data: preview });
  },
  { permissions: ['finance:manage'] }
);
