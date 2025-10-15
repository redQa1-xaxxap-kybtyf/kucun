import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { extractRequestInfo, logSystemEvent, logger } from '@/lib/logger';

interface ClientErrorRequest {
  module?: string;
  message?: string;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
    digest?: string;
  };
  metadata?: Record<string, unknown>;
}

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = (await request.json()) as ClientErrorRequest;
    const action = body.module ?? 'client_error';
    const description = body.message ?? '客户端错误上报';
    const { ipAddress, userAgent } = extractRequestInfo(request);

    await logSystemEvent({
      type: 'error',
      level: 'error',
      action,
      description,
      userId: user.id,
      ipAddress,
      userAgent,
      metadata: {
        clientError: body.error,
        ...body.metadata,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('logs-report', '记录客户端错误失败', error);
    return NextResponse.json(
      { success: false, error: '记录客户端错误失败' },
      { status: 500 }
    );
  }
});
