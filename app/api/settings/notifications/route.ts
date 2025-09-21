/**
 * 通知设置API路由
 * 处理消息提醒、预警配置、邮件通知等通知设置
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import {
  DEFAULT_SETTINGS,
  type NotificationSettings,
  type SettingsResponse,
} from '@/lib/types/settings';
import { NotificationSettingsSchema } from '@/lib/validations/settings';

/**
 * GET /api/settings/notifications - 获取通知设置
 */
export async function GET(): Promise<NextResponse<SettingsResponse>> {
  try {
    // 验证用户权限
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: '未授权访问',
          message: '请先登录',
        },
        { status: 401 }
      );
    }

    // TODO: 实际项目中从数据库获取
    const notificationSettings: NotificationSettings =
      DEFAULT_SETTINGS.notifications;

    return NextResponse.json({
      success: true,
      data: { notifications: notificationSettings },
      message: '获取通知设置成功',
    });
  } catch (error) {
    console.error('获取通知设置失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: '服务器内部错误',
        message: '获取通知设置失败，请稍后重试',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/notifications - 更新通知设置
 */
export async function PUT(
  request: NextRequest
): Promise<NextResponse<SettingsResponse>> {
  try {
    // 验证用户权限
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: '未授权访问',
          message: '请先登录',
        },
        { status: 401 }
      );
    }

    // 解析请求体
    const body = await request.json();

    // 验证数据格式
    const validationResult = NotificationSettingsSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join(', ');

      return NextResponse.json(
        {
          success: false,
          error: '数据验证失败',
          message: `请检查输入数据: ${errors}`,
        },
        { status: 400 }
      );
    }

    const notificationSettings = validationResult.data;

    // TODO: 实际项目中保存到数据库
    // await prisma.settings.update({
    //   where: { userId: session.user.id },
    //   data: { notifications: notificationSettings }
    // });

    // 模拟保存成功
    const updatedSettings: NotificationSettings = {
      ...DEFAULT_SETTINGS.notifications,
      ...notificationSettings,
    };

    return NextResponse.json({
      success: true,
      data: { notifications: updatedSettings },
      message: '通知设置更新成功',
    });
  } catch (error) {
    console.error('更新通知设置失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: '服务器内部错误',
        message: '更新通知设置失败，请稍后重试',
      },
      { status: 500 }
    );
  }
}
