/**
 * 业务设置API路由
 * 处理库存预警、订单规则、财务配置等核心业务设置
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { SETTINGS_DEFAULTS } from '@/lib/config/settings';
import { prisma } from '@/lib/db';
import type { BusinessSettings, SettingsResponse } from '@/lib/types/settings';
import { BusinessSettingsSchema } from '@/lib/validations/settings';

/**
 * GET /api/settings/business - 获取业务设置
 */
export async function GET(): Promise<NextResponse<SettingsResponse>> {
  try {
    // 验证管理员权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '权限不足，仅管理员可以查看业务设置' },
        { status: 403 }
      );
    }

    // 从数据库获取业务设置
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

    const businessSettings: BusinessSettings = JSON.parse(dbSettings.business);

    return NextResponse.json({
      success: true,
      data: { business: businessSettings },
      message: '获取业务设置成功',
    });
  } catch (error) {
    console.error('获取业务设置失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取业务设置失败',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/business - 更新业务设置
 */
export async function PUT(
  request: NextRequest
): Promise<NextResponse<SettingsResponse>> {
  try {
    // 验证管理员权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '权限不足，仅管理员可以修改业务设置' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // 验证输入数据
    const validationResult = BusinessSettingsSchema.safeParse(body);
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

    const updatedBusinessSettings = validationResult.data;

    // 业务逻辑验证
    if (
      updatedBusinessSettings.defaultTaxRate < 0 ||
      updatedBusinessSettings.defaultTaxRate > 1
    ) {
      return NextResponse.json(
        {
          success: false,
          error: '税率必须在0%到100%之间',
        },
        { status: 400 }
      );
    }

    if (updatedBusinessSettings.paymentMethods.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '至少需要选择一种付款方式',
        },
        { status: 400 }
      );
    }

    // 验证订单编号格式
    const orderNumberFormat = updatedBusinessSettings.orderNumberFormat;
    if (!orderNumberFormat.includes('{') || !orderNumberFormat.includes('}')) {
      return NextResponse.json(
        {
          success: false,
          error: '订单编号格式必须包含变量占位符，如{YYYYMMDD}',
        },
        { status: 400 }
      );
    }

    // TODO: 保存到数据库
    // await prisma.settings.update({
    //   where: { id: 'system' },
    //   data: {
    //     business: updatedBusinessSettings,
    //     updatedAt: new Date(),
    //     updatedBy: session.user.id,
    //   },
    // });

    // 模拟保存成功
    const updatedSettings = {
      ...DEFAULT_SETTINGS,
      business: updatedBusinessSettings,
      updatedAt: new Date(),
      updatedBy: session.user.id,
    };

    return NextResponse.json({
      success: true,
      data: updatedSettings,
      message: '业务设置更新成功',
    });
  } catch (error) {
    console.error('更新业务设置失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '更新业务设置失败',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/business/reset - 重置业务设置为默认值
 */
export async function POST(): Promise<NextResponse<SettingsResponse>> {
  try {
    // 验证管理员权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '权限不足，仅管理员可以重置业务设置' },
        { status: 403 }
      );
    }

    const defaultBusinessSettings = DEFAULT_SETTINGS.business;

    // TODO: 保存到数据库
    // await prisma.settings.update({
    //   where: { id: 'system' },
    //   data: {
    //     business: defaultBusinessSettings,
    //     updatedAt: new Date(),
    //     updatedBy: session.user.id,
    //   },
    // });

    const resetSettings = {
      ...DEFAULT_SETTINGS,
      business: defaultBusinessSettings,
      updatedAt: new Date(),
      updatedBy: session.user.id,
    };

    return NextResponse.json({
      success: true,
      data: resetSettings,
      message: '业务设置已重置为默认值',
    });
  } catch (error) {
    console.error('重置业务设置失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '重置业务设置失败',
      },
      { status: 500 }
    );
  }
}
