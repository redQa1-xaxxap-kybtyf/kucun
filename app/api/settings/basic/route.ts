/**
 * 基础设置API路由
 * 处理公司信息、系统名称、Logo等基础配置
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import {
  DEFAULT_SETTINGS,
  type BasicSettings,
  type SettingsResponse,
} from '@/lib/types/settings';
import { BasicSettingsSchema } from '@/lib/validations/settings';

/**
 * GET /api/settings/basic - 获取基础设置
 */
export async function GET(): Promise<NextResponse<SettingsResponse>> {
  try {
    // 验证用户权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 从数据库获取基础设置
    // TODO: 实际项目中从数据库获取
    const basicSettings: BasicSettings = DEFAULT_SETTINGS.basic;

    return NextResponse.json({
      success: true,
      data: { basic: basicSettings },
      message: '获取基础设置成功',
    });
  } catch (error) {
    console.error('获取基础设置失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取基础设置失败',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/basic - 更新基础设置
 */
export async function PUT(
  request: NextRequest
): Promise<NextResponse<SettingsResponse>> {
  try {
    // 验证管理员权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '权限不足，仅管理员可以修改基础设置' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // 验证输入数据
    const validationResult = BasicSettingsSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '输入数据格式不正确',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const updatedBasicSettings = validationResult.data;

    // TODO: 保存到数据库
    // await prisma.settings.update({
    //   where: { id: 'system' },
    //   data: {
    //     basic: updatedBasicSettings,
    //     updatedAt: new Date(),
    //     updatedBy: session.user.id,
    //   },
    // });

    // 模拟保存成功
    const updatedSettings = {
      ...DEFAULT_SETTINGS,
      basic: updatedBasicSettings,
      updatedAt: new Date(),
      updatedBy: session.user.id,
    };

    return NextResponse.json({
      success: true,
      data: updatedSettings,
      message: '基础设置更新成功',
    });
  } catch (error) {
    console.error('更新基础设置失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '更新基础设置失败',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/basic/reset - 重置基础设置为默认值
 */
export async function POST(): Promise<NextResponse<SettingsResponse>> {
  try {
    // 验证管理员权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '权限不足，仅管理员可以重置基础设置' },
        { status: 403 }
      );
    }

    const defaultBasicSettings = DEFAULT_SETTINGS.basic;

    // TODO: 保存到数据库
    // await prisma.settings.update({
    //   where: { id: 'system' },
    //   data: {
    //     basic: defaultBasicSettings,
    //     updatedAt: new Date(),
    //     updatedBy: session.user.id,
    //   },
    // });

    const resetSettings = {
      ...DEFAULT_SETTINGS,
      basic: defaultBasicSettings,
      updatedAt: new Date(),
      updatedBy: session.user.id,
    };

    return NextResponse.json({
      success: true,
      data: resetSettings,
      message: '基础设置已重置为默认值',
    });
  } catch (error) {
    console.error('重置基础设置失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '重置基础设置失败',
      },
      { status: 500 }
    );
  }
}
