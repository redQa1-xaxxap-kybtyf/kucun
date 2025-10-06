import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';

/**
 * 获取通知列表
 * GET /api/notifications
 */
export const GET = withAuth(
  async (request, { user }) => {
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
      console.error('[通知列表] 查询失败:', error);

      // 如果是表不存在的错误，返回空列表（向后兼容）
      if (error instanceof Error && error.message.includes('does not exist')) {
        return NextResponse.json({
          notifications: [],
          unreadCount: 0,
        });
      }

      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : '获取通知列表失败',
        },
        { status: 500 }
      );
    }
  },
  { permissions: ['notifications:view'] }
);
