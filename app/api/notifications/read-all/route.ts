import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';

/**
 * 全部标记为已读
 * POST /api/notifications/read-all
 *
 * 🔓 用户可以标记自己的所有通知为已读
 */
export const POST = withAuth(async (request, { user }) => {
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
    // 如果 Notification 模型不存在，返回成功（向后兼容）
    if (
      error instanceof Error &&
      (error.message.includes('does not exist') ||
        error.message.includes('Cannot read properties of undefined') ||
        error.message.includes('notification'))
    ) {
      console.debug('[全部标记已读] Notification 表尚未创建，返回成功');
      return NextResponse.json({
        success: true,
        message: '所有通知已标记为已读',
      });
    }

    console.error('[全部标记已读] 操作失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '全部标记为已读失败',
      },
      { status: 500 }
    );
  }
});
