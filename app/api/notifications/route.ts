import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';

/**
 * 获取通知列表
 * GET /api/notifications
 *
 * 🔓 所有已登录用户都可以访问通知功能
 */
export const GET = withAuth(async (request, { user }) => {
  try {
    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // 获取通知列表（这里是模拟数据，实际应该从数据库读取）
    // TODO: 创建 Notification 数据模型
    const notifications = await prisma.notification.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    });

    const unreadCount = await prisma.notification.count({
      where: {
        userId: user.id,
        isRead: false,
      },
    });

    return NextResponse.json({
      notifications: notifications.map(n => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        isRead: n.isRead,
        href: n.href,
        createdAt: n.createdAt,
      })),
      unreadCount,
    });
  } catch (error) {
    // 如果 Notification 模型不存在或表不存在，返回空列表（向后兼容）
    if (
      error instanceof Error &&
      (error.message.includes('does not exist') ||
        error.message.includes('Cannot read properties of undefined') ||
        error.message.includes('notification'))
    ) {
      console.debug('[通知列表] Notification 表尚未创建，返回空数据');
      return NextResponse.json({
        notifications: [],
        unreadCount: 0,
      });
    }

    // 其他错误才记录
    console.error('[通知列表] 查询失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取通知列表失败',
      },
      { status: 500 }
    );
  }
});
