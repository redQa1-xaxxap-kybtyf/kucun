import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';

/**
 * 全部标记为已读
 * POST /api/notifications/read-all
 */
export const POST = withAuth(
  async (request, { user }) => {
    try {
      // 标记所有未读通知为已读
      await prisma.notification.updateMany({
        where: {
          userId: user.id,
          isRead: false,
        },
        data: {
          isRead: true,
        },
      });

      return NextResponse.json({
        success: true,
        message: '所有通知已标记为已读',
      });
    } catch (error) {
      console.error('[全部标记已读] 操作失败:', error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : '全部标记为已读失败',
        },
        { status: 500 }
      );
    }
  },
  { permissions: ['notifications:update'] }
);
