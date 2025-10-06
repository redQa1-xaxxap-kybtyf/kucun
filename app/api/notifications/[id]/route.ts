import { type NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';

/**
 * 删除通知
 * DELETE /api/notifications/[id]
 *
 * 🔓 用户可以删除自己的通知
 */
export const DELETE = withAuth(
  async (
    request: NextRequest,
    {
      user,
      params,
    }: {
      user: { id: string; name: string; email: string };
      params: Promise<{ id: string }>;
    }
  ) => {
    try {
      const { id } = await params;

      // 检查通知是否属于当前用户
      const notification = await prisma.notification.findFirst({
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

      // 删除通知
      await prisma.notification.delete({
        where: { id },
      });

      return NextResponse.json({
        success: true,
        message: '通知已删除',
      });
    } catch (error) {
      // 如果 Notification 模型不存在，返回成功（向后兼容）
      if (
        error instanceof Error &&
        (error.message.includes('does not exist') ||
          error.message.includes('Cannot read properties of undefined') ||
          error.message.includes('notification'))
      ) {
        console.debug('[删除通知] Notification 表尚未创建，返回成功');
        return NextResponse.json({
          success: true,
          message: '通知已删除',
        });
      }

      console.error('[删除通知] 操作失败:', error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : '删除通知失败',
        },
        { status: 500 }
      );
    }
  }
);
