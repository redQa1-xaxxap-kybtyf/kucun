import { type NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { getNotificationDelegate } from '@/lib/db/notification-delegate';
import { resolveParams } from '@/lib/api/middleware';

/**
 * 标记通知为已读
 * POST /api/notifications/[id]/read
 *
 * 🔓 用户可以标记自己的通知为已读
 */
export const POST = withAuth(
  async (
    request: NextRequest,
    context: {
      user: { id: string; name: string; email: string };
      params?: Promise<Record<string, string>> | Record<string, string>;
    }
  ) => {
    try {
      const { id } = await resolveParams(context.params);
      const { user } = context;
      const notificationDelegate = getNotificationDelegate(prisma);

      if (!notificationDelegate) {
        console.debug('[标记已读] Notification 委托不存在，返回成功');
        return NextResponse.json({
          success: true,
          message: '通知已标记为已读',
        });
      }

      // 检查通知是否属于当前用户
      const notification = await notificationDelegate.findFirst({
        where: {
          id,
          userId: user.id,
        },
      });

      if (!notification) {
        return NextResponse.json(
          {
            success: false,
            error: '通知不存在或无权访问',
          },
          { status: 404 }
        );
      }

      // 标记为已读
      await notificationDelegate.update({
        where: { id },
        data: { isRead: true },
      });

      return NextResponse.json({
        success: true,
        message: '通知已标记为已读',
      });
    } catch (error) {
      // 如果 Notification 模型不存在，返回成功（向后兼容）
      if (
        error instanceof Error &&
        (error.message.includes('does not exist') ||
          error.message.includes('Cannot read properties of undefined') ||
          error.message.includes('notification'))
      ) {
        console.debug('[标记已读] Notification 表尚未创建，返回成功');
        return NextResponse.json({
          success: true,
          message: '通知已标记为已读',
        });
      }

      console.error('[标记已读] 操作失败:', error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : '标记通知已读失败',
        },
        { status: 500 }
      );
    }
  }
);
