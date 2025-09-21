/**
 * 系统设置主API路由
 * 处理完整系统设置的获取和管理
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import {
  DEFAULT_SETTINGS,
  type SettingsResponse,
  type SystemSettings,
} from '@/lib/types/settings';

/**
 * GET /api/settings - 获取完整系统设置
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

    // 从数据库获取设置（这里使用模拟数据，实际项目中需要数据库表）
    // TODO: 实际项目中需要创建settings表来存储配置
    const settings: SystemSettings = {
      ...DEFAULT_SETTINGS,
      updatedAt: new Date(),
      updatedBy: session.user.id,
    };

    return NextResponse.json({
      success: true,
      data: settings,
      message: '获取系统设置成功',
    });
  } catch (error) {
    console.error('获取系统设置失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取系统设置失败',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings - 批量更新系统设置
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<SettingsResponse>> {
  try {
    // 验证管理员权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '权限不足，仅管理员可以修改系统设置' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // 这里应该验证和保存到数据库
    // TODO: 实际项目中需要：
    // 1. 使用Zod验证输入数据
    // 2. 保存到数据库settings表
    // 3. 记录操作日志

    const updatedSettings: SystemSettings = {
      ...DEFAULT_SETTINGS,
      ...body,
      updatedAt: new Date(),
      updatedBy: session.user.id,
    };

    return NextResponse.json({
      success: true,
      data: updatedSettings,
      message: '系统设置更新成功',
    });
  } catch (error) {
    console.error('更新系统设置失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '更新系统设置失败',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings - 完整替换系统设置
 */
export async function PUT(
  request: NextRequest
): Promise<NextResponse<SettingsResponse>> {
  try {
    // 验证管理员权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '权限不足，仅管理员可以修改系统设置' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // TODO: 使用SystemSettingsSchema验证数据
    // const validationResult = SystemSettingsSchema.safeParse(body);
    // if (!validationResult.success) {
    //   return NextResponse.json(
    //     {
    //       success: false,
    //       error: '输入数据格式不正确',
    //       details: validationResult.error.errors,
    //     },
    //     { status: 400 }
    //   );
    // }

    const updatedSettings: SystemSettings = {
      ...body,
      updatedAt: new Date(),
      updatedBy: session.user.id,
    };

    // TODO: 保存到数据库
    // await prisma.settings.upsert({
    //   where: { id: 'system' },
    //   update: updatedSettings,
    //   create: { id: 'system', ...updatedSettings },
    // });

    return NextResponse.json({
      success: true,
      data: updatedSettings,
      message: '系统设置替换成功',
    });
  } catch (error) {
    console.error('替换系统设置失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '替换系统设置失败',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings - 重置所有设置为默认值
 */
export async function DELETE(): Promise<NextResponse<SettingsResponse>> {
  try {
    // 验证管理员权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '权限不足，仅管理员可以重置系统设置' },
        { status: 403 }
      );
    }

    const resetSettings: SystemSettings = {
      ...DEFAULT_SETTINGS,
      updatedAt: new Date(),
      updatedBy: session.user.id,
    };

    // TODO: 保存到数据库
    // await prisma.settings.upsert({
    //   where: { id: 'system' },
    //   update: resetSettings,
    //   create: { id: 'system', ...resetSettings },
    // });

    return NextResponse.json({
      success: true,
      data: resetSettings,
      message: '系统设置已重置为默认值',
    });
  } catch (error) {
    console.error('重置系统设置失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '重置系统设置失败',
      },
      { status: 500 }
    );
  }
}
