/**
 * 基本设置API路由
 * 严格遵循全栈项目统一约定规范
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { extractRequestInfo, logSystemEventInfo } from '@/lib/logger';
import {
  BasicSettingsFormSchema,
  BasicSettingsSchema,
} from '@/lib/schemas/settings';
import type { BasicSettings, SettingsApiResponse } from '@/lib/types/settings';

// 默认基本设置
const DEFAULT_BASIC_SETTINGS: BasicSettings = {
  companyName: '库存管理工具',
  companyAddress: '',
  companyPhone: '',
  companyEmail: '',
  companyWebsite: '',
  systemName: '库存管理工具',
  systemVersion: '1.0.0',
  systemDescription: '专业的库存管理解决方案',
  defaultLanguage: 'zh',
  lowStockThreshold: 10,
  enableStockAlerts: true,
  orderNumberPrefix: 'SO',
  enableOrderApproval: false,
};

/**
 * GET /api/settings/basic - 获取基本设置
 */
export async function GET(_request: NextRequest) {
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' } as SettingsApiResponse,
        { status: 401 }
      );
    }

    // 获取基本设置
    const settings = await prisma.systemSetting.findMany({
      where: {
        category: 'basic',
      },
      select: {
        key: true,
        value: true,
        dataType: true,
      },
    });

    // 构建设置对象
    const basicSettings: Partial<BasicSettings> = { ...DEFAULT_BASIC_SETTINGS };

    settings.forEach(setting => {
      const { key, value, dataType } = setting;

      // 根据数据类型转换值
      let parsedValue: unknown = value;
      try {
        switch (dataType) {
          case 'number':
            parsedValue = Number(value);
            break;
          case 'boolean':
            parsedValue = value === 'true';
            break;
          case 'json':
            parsedValue = JSON.parse(value);
            break;
          default:
            parsedValue = value;
        }
      } catch (error) {
        console.error(`解析设置值失败 [${key}]:`, error);
        parsedValue = value; // 使用原始字符串值
      }

      // 设置到对象中
      if (key in basicSettings) {
        (basicSettings as Record<string, unknown>)[key] = parsedValue;
      }
    });

    // 验证设置数据
    const validationResult = BasicSettingsSchema.safeParse(basicSettings);
    if (!validationResult.success) {
      console.error('基本设置数据验证失败:', validationResult.error);
      // 返回默认设置
      return NextResponse.json({
        success: true,
        data: DEFAULT_BASIC_SETTINGS,
        message: '使用默认设置',
      } as SettingsApiResponse<BasicSettings>);
    }

    return NextResponse.json({
      success: true,
      data: validationResult.data,
    } as SettingsApiResponse<BasicSettings>);
  } catch (error) {
    console.error('获取基本设置失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取基本设置失败',
      } as SettingsApiResponse,
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/basic - 更新基本设置
 */
export async function PUT(request: NextRequest) {
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' } as SettingsApiResponse,
        { status: 401 }
      );
    }

    // 检查用户权限（只有管理员可以修改设置）
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        {
          success: false,
          error: '权限不足，只有管理员可以修改系统设置',
        } as SettingsApiResponse,
        { status: 403 }
      );
    }

    const body = await request.json();

    // 验证输入数据
    const validationResult = BasicSettingsFormSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '输入数据格式不正确',
          details: validationResult.error.errors,
        } as SettingsApiResponse,
        { status: 400 }
      );
    }

    const settingsData = validationResult.data;

    // 批量更新设置
    const updatePromises = Object.entries(settingsData).map(
      async ([key, value]) => {
        if (value === undefined) return null;

        // 确定数据类型
        let dataType: 'string' | 'number' | 'boolean' | 'json' = 'string';
        let stringValue: string;

        if (typeof value === 'number') {
          dataType = 'number';
          stringValue = value.toString();
        } else if (typeof value === 'boolean') {
          dataType = 'boolean';
          stringValue = value.toString();
        } else if (typeof value === 'object' && value !== null) {
          dataType = 'json';
          stringValue = JSON.stringify(value);
        } else {
          stringValue = String(value);
        }

        // 使用upsert操作
        return prisma.systemSetting.upsert({
          where: { key },
          update: {
            value: stringValue,
            dataType,
            updatedAt: new Date(),
          },
          create: {
            key,
            value: stringValue,
            category: 'basic',
            dataType,
            description: `基本设置 - ${key}`,
            isPublic: false,
          },
        });
      }
    );

    // 执行所有更新操作
    const results = await Promise.all(updatePromises.filter(p => p !== null));

    // 记录系统设置变更日志
    const requestInfo = extractRequestInfo(request);
    await logSystemEventInfo(
      'update_basic_settings',
      `更新基本设置：成功更新 ${results.length} 个设置项`,
      session.user.id,
      requestInfo.ipAddress,
      requestInfo.userAgent,
      {
        updatedSettings: Object.keys(settingsData),
        settingsCount: results.length,
      }
    );

    return NextResponse.json({
      success: true,
      data: settingsData,
      message: `成功更新 ${results.length} 个设置项`,
    } as SettingsApiResponse<typeof settingsData>);
  } catch (error) {
    console.error('更新基本设置失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '更新基本设置失败',
      } as SettingsApiResponse,
      { status: 500 }
    );
  }
}
