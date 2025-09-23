/**
 * 系统设置重置API路由
 * 处理系统设置的重置操作
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { SETTINGS_DEFAULTS } from '@/lib/config/settings';
import { prisma } from '@/lib/db';
import type { SettingsResponse } from '@/lib/types/settings';

/**
 * POST /api/settings/reset - 重置系统设置为默认值
 */
export async function POST(): Promise<NextResponse<SettingsResponse>> {
  try {
    // 验证管理员权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '权限不足，仅管理员可以重置系统设置' },
        { status: 403 }
      );
    }

    // 准备默认设置数据
    const defaultSettings = {
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
    };

    // 使用 upsert 操作重置设置
    const resetSettings = await prisma.systemSettings.upsert({
      where: { id: 'system' },
      update: {
        ...defaultSettings,
        updatedAt: new Date(),
      },
      create: {
        ...defaultSettings,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // 解析JSON字段并构造响应
    const systemSettings = {
      basic: {
        companyName: resetSettings.companyName,
        systemName: resetSettings.systemName,
        logoUrl: resetSettings.logoUrl,
        timezone: resetSettings.timezone,
        language: resetSettings.language,
        currency: resetSettings.currency,
        address: resetSettings.address,
        phone: resetSettings.phone,
        email: resetSettings.email,
      },
      userManagement: JSON.parse(resetSettings.userManagement),
      business: JSON.parse(resetSettings.business),
      notifications: JSON.parse(resetSettings.notifications),
      dataManagement: JSON.parse(resetSettings.dataManagement),
      updatedAt: resetSettings.updatedAt,
      updatedBy: resetSettings.updatedBy,
    };

    return NextResponse.json({
      success: true,
      data: systemSettings,
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
