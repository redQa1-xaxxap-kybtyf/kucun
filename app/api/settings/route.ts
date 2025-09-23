/**
 * 系统设置主API路由
 * 处理完整系统设置的获取和管理
 * 使用真实数据库操作替换模拟数据
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { SETTINGS_DEFAULTS } from '@/lib/config/settings';
import { prisma } from '@/lib/db';
import type { SettingsResponse, SystemSettings } from '@/lib/types/settings';

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

    // 从数据库获取设置
    let dbSettings = await prisma.systemSettings.findUnique({
      where: { id: 'system' },
    });

    // 如果数据库中没有设置，创建默认设置
    if (!dbSettings) {
      dbSettings = await prisma.systemSettings.create({
        data: {
          id: 'system',
          companyName: SETTINGS_DEFAULTS.basic.companyName,
          systemName: SETTINGS_DEFAULTS.basic.systemName,
          logoUrl: SETTINGS_DEFAULTS.basic.logoUrl,
          timezone: SETTINGS_DEFAULTS.basic.timezone,
          language: SETTINGS_DEFAULTS.basic.language,
          currency: SETTINGS_DEFAULTS.basic.currency,
          address: SETTINGS_DEFAULTS.basic.address,
          phone: SETTINGS_DEFAULTS.basic.phone,
          email: SETTINGS_DEFAULTS.basic.email,
          userManagement: JSON.stringify(SETTINGS_DEFAULTS.userManagement),
          business: JSON.stringify(SETTINGS_DEFAULTS.business),
          notifications: JSON.stringify(SETTINGS_DEFAULTS.notifications),
          dataManagement: JSON.stringify(SETTINGS_DEFAULTS.dataManagement),
          updatedBy: session.user.id,
        },
      });
    }

    // 构造响应数据
    const settings: SystemSettings = {
      basic: {
        companyName: dbSettings.companyName,
        systemName: dbSettings.systemName,
        logoUrl: dbSettings.logoUrl,
        timezone: dbSettings.timezone,
        language: dbSettings.language,
        currency: dbSettings.currency,
        address: dbSettings.address,
        phone: dbSettings.phone,
        email: dbSettings.email,
      },
      userManagement: JSON.parse(dbSettings.userManagement),
      business: JSON.parse(dbSettings.business),
      notifications: JSON.parse(dbSettings.notifications),
      dataManagement: JSON.parse(dbSettings.dataManagement),
      updatedAt: dbSettings.updatedAt,
      updatedBy: dbSettings.updatedBy,
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
 * PUT /api/settings - 更新系统设置
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

    // 验证输入数据
    const validationResult = SystemSettingsSchema.safeParse(body);
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

    const validatedData = validationResult.data;

    // 更新数据库设置
    const updatedDbSettings = await prisma.systemSettings.upsert({
      where: { id: 'system' },
      update: {
        companyName: validatedData.basic.companyName,
        systemName: validatedData.basic.systemName,
        logoUrl: validatedData.basic.logoUrl,
        timezone: validatedData.basic.timezone,
        language: validatedData.basic.language,
        currency: validatedData.basic.currency,
        address: validatedData.basic.address,
        phone: validatedData.basic.phone,
        email: validatedData.basic.email,
        userManagement: JSON.stringify(validatedData.userManagement),
        business: JSON.stringify(validatedData.business),
        notifications: JSON.stringify(validatedData.notifications),
        dataManagement: JSON.stringify(validatedData.dataManagement),
        updatedBy: session.user.id,
        updatedAt: new Date(),
      },
      create: {
        id: 'system',
        companyName: validatedData.basic.companyName,
        systemName: validatedData.basic.systemName,
        logoUrl: validatedData.basic.logoUrl,
        timezone: validatedData.basic.timezone,
        language: validatedData.basic.language,
        currency: validatedData.basic.currency,
        address: validatedData.basic.address,
        phone: validatedData.basic.phone,
        email: validatedData.basic.email,
        userManagement: JSON.stringify(validatedData.userManagement),
        business: JSON.stringify(validatedData.business),
        notifications: JSON.stringify(validatedData.notifications),
        dataManagement: JSON.stringify(validatedData.dataManagement),
        updatedBy: session.user.id,
      },
    });

    // 构造响应数据
    const updatedSettings: SystemSettings = {
      basic: {
        companyName: updatedDbSettings.companyName,
        systemName: updatedDbSettings.systemName,
        logoUrl: updatedDbSettings.logoUrl,
        timezone: updatedDbSettings.timezone,
        language: updatedDbSettings.language,
        currency: updatedDbSettings.currency,
        address: updatedDbSettings.address,
        phone: updatedDbSettings.phone,
        email: updatedDbSettings.email,
      },
      userManagement: JSON.parse(updatedDbSettings.userManagement),
      business: JSON.parse(updatedDbSettings.business),
      notifications: JSON.parse(updatedDbSettings.notifications),
      dataManagement: JSON.parse(updatedDbSettings.dataManagement),
      updatedAt: updatedDbSettings.updatedAt,
      updatedBy: updatedDbSettings.updatedBy,
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
