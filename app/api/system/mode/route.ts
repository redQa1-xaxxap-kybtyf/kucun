import { type NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { extractRequestInfo } from '@/lib/logger';
import { getSystemMode, setSystemMode } from '@/lib/services/system-mode-service';
import type { SystemMode } from '@/lib/types/system-mode';

export const GET = withAuth(async () => {
  const mode = await getSystemMode();
  return NextResponse.json({ success: true, data: { mode } });
});

export const POST = withAuth(
  async (request: NextRequest, { user }) => {
    const body = (await request.json()) as { mode?: unknown };
    const requestedMode = body.mode;
    if (requestedMode !== 'trial' && requestedMode !== 'production') {
      return NextResponse.json(
        { success: false, error: 'mode 必须为 trial 或 production' },
        { status: 400 }
      );
    }

    const nextMode = await setSystemMode(requestedMode satisfies SystemMode);

    const requestInfo = extractRequestInfo(request);
    await prisma.systemLog.create({
      data: {
        type: 'system_event',
        level: 'info',
        action: 'system:mode:set',
        description: `系统账套模式切换为 ${nextMode}`.slice(0, 191),
        userId: user.id,
        ipAddress: requestInfo.ipAddress,
        userAgent: requestInfo.userAgent,
        metadata: JSON.stringify({ mode: nextMode }).slice(0, 191),
      },
    });

    return NextResponse.json({ success: true, data: { mode: nextMode } });
  },
  { requireAdmin: true }
);

