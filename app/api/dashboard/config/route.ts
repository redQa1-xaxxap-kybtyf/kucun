// 仪表盘配置管理API
// 用户个性化仪表盘配置的CRUD操作

import { getServerSession } from 'next-auth';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { authOptions } from '@/lib/auth';
import {
  DASHBOARD_DEFAULTS,
  DASHBOARD_REFRESH_INTERVALS,
} from '@/lib/config/dashboard';
import { prisma } from '@/lib/db';
import { dashboardConfigUpdateSchema } from '@/lib/validations/dashboard';

// 获取用户仪表盘配置
export async function GET(request: NextRequest) {
  try {
    // 身份验证
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 获取用户配置
    let config = await prisma.dashboardConfig.findUnique({
      where: {
        userId: session.user.id,
      },
    });

    // 如果用户没有配置，创建默认配置
    if (!config) {
      config = await prisma.dashboardConfig.create({
        data: {
          userId: session.user.id,
          refreshInterval: DASHBOARD_REFRESH_INTERVALS.DASHBOARD_DATA,
          showAlerts: DASHBOARD_DEFAULTS.SHOW_ALERTS,
          showTodos: DASHBOARD_DEFAULTS.SHOW_TODOS,
          showCharts: DASHBOARD_DEFAULTS.SHOW_CHARTS,
          showQuickActions: DASHBOARD_DEFAULTS.SHOW_QUICK_ACTIONS,
          layout: DASHBOARD_DEFAULTS.LAYOUT,
          theme: DASHBOARD_DEFAULTS.THEME,
          timeRange: DASHBOARD_DEFAULTS.TIME_RANGE,
        },
      });
    }

    // 转换数据库字段名为前端期望的格式
    const responseData = {
      id: config.id,
      userId: config.userId,
      refreshInterval: config.refreshInterval,
      showAlerts: config.showAlerts,
      showTodos: config.showTodos,
      showCharts: config.showCharts,
      showQuickActions: config.showQuickActions,
      layout: config.layout,
      theme: config.theme,
      timeRange: config.timeRange,
      customSettings: config.customSettings
        ? JSON.parse(config.customSettings)
        : null,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    // TODO: 集成日志系统
    // console.error('获取仪表盘配置失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取仪表盘配置失败',
      },
      { status: 500 }
    );
  }
}

// 更新用户仪表盘配置
export async function PUT(request: NextRequest) {
  try {
    // 身份验证
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析请求体
    const body = await request.json();

    // 验证输入数据
    const validationResult = dashboardConfigUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '请求参数格式不正确',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const updateData = validationResult.data;

    // 处理customSettings字段
    const dbUpdateData: Record<string, unknown> = { ...updateData };
    if (updateData.customSettings) {
      dbUpdateData.customSettings = JSON.stringify(updateData.customSettings);
    }

    // 更新配置
    const updatedConfig = await prisma.dashboardConfig.upsert({
      where: {
        userId: session.user.id,
      },
      update: dbUpdateData,
      create: {
        userId: session.user.id,
        refreshInterval:
          updateData.refreshInterval ??
          DASHBOARD_REFRESH_INTERVALS.DASHBOARD_DATA,
        showAlerts: updateData.showAlerts ?? DASHBOARD_DEFAULTS.SHOW_ALERTS,
        showTodos: updateData.showTodos ?? DASHBOARD_DEFAULTS.SHOW_TODOS,
        showCharts: updateData.showCharts ?? DASHBOARD_DEFAULTS.SHOW_CHARTS,
        showQuickActions:
          updateData.showQuickActions ?? DASHBOARD_DEFAULTS.SHOW_QUICK_ACTIONS,
        layout: updateData.layout ?? DASHBOARD_DEFAULTS.LAYOUT,
        theme: updateData.theme ?? DASHBOARD_DEFAULTS.THEME,
        timeRange: updateData.timeRange ?? DASHBOARD_DEFAULTS.TIME_RANGE,
        customSettings: updateData.customSettings
          ? JSON.stringify(updateData.customSettings)
          : null,
      },
    });

    // 转换响应数据
    const responseData = {
      id: updatedConfig.id,
      userId: updatedConfig.userId,
      refreshInterval: updatedConfig.refreshInterval,
      showAlerts: updatedConfig.showAlerts,
      showTodos: updatedConfig.showTodos,
      showCharts: updatedConfig.showCharts,
      showQuickActions: updatedConfig.showQuickActions,
      layout: updatedConfig.layout,
      theme: updatedConfig.theme,
      timeRange: updatedConfig.timeRange,
      customSettings: updatedConfig.customSettings
        ? JSON.parse(updatedConfig.customSettings)
        : null,
      createdAt: updatedConfig.createdAt.toISOString(),
      updatedAt: updatedConfig.updatedAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: responseData,
      message: '仪表盘配置更新成功',
    });
  } catch (error) {
    // TODO: 集成日志系统
    // console.error('更新仪表盘配置失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '更新仪表盘配置失败',
      },
      { status: 500 }
    );
  }
}

// 重置用户仪表盘配置为默认值
export async function DELETE(request: NextRequest) {
  try {
    // 身份验证
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 重置为默认配置
    const resetConfig = await prisma.dashboardConfig.upsert({
      where: {
        userId: session.user.id,
      },
      update: {
        refreshInterval: DASHBOARD_REFRESH_INTERVALS.DASHBOARD_DATA,
        showAlerts: DASHBOARD_DEFAULTS.SHOW_ALERTS,
        showTodos: DASHBOARD_DEFAULTS.SHOW_TODOS,
        showCharts: DASHBOARD_DEFAULTS.SHOW_CHARTS,
        showQuickActions: DASHBOARD_DEFAULTS.SHOW_QUICK_ACTIONS,
        layout: DASHBOARD_DEFAULTS.LAYOUT,
        theme: DASHBOARD_DEFAULTS.THEME,
        timeRange: DASHBOARD_DEFAULTS.TIME_RANGE,
        customSettings: null,
      },
      create: {
        userId: session.user.id,
        refreshInterval: DASHBOARD_REFRESH_INTERVALS.DASHBOARD_DATA,
        showAlerts: DASHBOARD_DEFAULTS.SHOW_ALERTS,
        showTodos: DASHBOARD_DEFAULTS.SHOW_TODOS,
        showCharts: DASHBOARD_DEFAULTS.SHOW_CHARTS,
        showQuickActions: DASHBOARD_DEFAULTS.SHOW_QUICK_ACTIONS,
        layout: DASHBOARD_DEFAULTS.LAYOUT,
        theme: DASHBOARD_DEFAULTS.THEME,
        timeRange: DASHBOARD_DEFAULTS.TIME_RANGE,
      },
    });

    // 转换响应数据
    const responseData = {
      id: resetConfig.id,
      userId: resetConfig.userId,
      refreshInterval: resetConfig.refreshInterval,
      showAlerts: resetConfig.showAlerts,
      showTodos: resetConfig.showTodos,
      showCharts: resetConfig.showCharts,
      showQuickActions: resetConfig.showQuickActions,
      layout: resetConfig.layout,
      theme: resetConfig.theme,
      timeRange: resetConfig.timeRange,
      customSettings: null,
      createdAt: resetConfig.createdAt.toISOString(),
      updatedAt: resetConfig.updatedAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: responseData,
      message: '仪表盘配置已重置为默认值',
    });
  } catch (error) {
    // TODO: 集成日志系统
    // console.error('重置仪表盘配置失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '重置仪表盘配置失败',
      },
      { status: 500 }
    );
  }
}
