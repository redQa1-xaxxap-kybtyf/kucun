/**
 * 基本设置API路由
 * 严格遵循全栈项目统一约定规范
 */

import { type NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { inventoryConfig, salesOrderConfig, systemConfig } from '@/lib/env';
import { extractRequestInfo, logSystemEventInfo } from '@/lib/logger';
import type { BasicSettings, SettingsApiResponse } from '@/lib/types/settings';
import { logSettingChanges } from '@/lib/utils/setting-change-log';
import {
  BasicSettingsFormSchema,
  BasicSettingsSchema,
} from '@/lib/validations/settings';

// 默认基本设置 - 使用环境配置
const DEFAULT_BASIC_SETTINGS: BasicSettings = {
  companyName: systemConfig.companyName,
  companyAddress: '',
  companyPhone: '',
  companyEmail: '',
  companyWebsite: '',
  systemName: systemConfig.companyName,
  systemVersion: '1.0.0',
  systemDescription: '专业的库存管理解决方案',
  defaultLanguage: systemConfig.defaultLanguage,
  lowStockThreshold: inventoryConfig.defaultMinQuantity,
  enableStockAlerts: true,
  orderNumberPrefix: salesOrderConfig.orderPrefix,
  enableOrderApproval: false,
};

/**
 * GET /api/settings/basic - 获取基本设置
 */
export const GET = withAuth(
  async (request: NextRequest, { user }) => {
    try {
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
      const basicSettings: Partial<BasicSettings> = {
        ...DEFAULT_BASIC_SETTINGS,
      };

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
        // 返回验证错误信息
        return NextResponse.json(
          {
            success: false,
            error: '基本设置数据验证失败',
            details: validationResult.error.issues.map(err => ({
              field: err.path.join('.'),
              message: err.message,
            })),
          } as SettingsApiResponse,
          { status: 400 }
        );
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
  },
  { requireAdmin: true }
);

/**
 * PUT /api/settings/basic - 更新基本设置
 */
export const PUT = withAuth(
  async (request: NextRequest, { user }) => {
    try {
      const userId = user.id;

      const body = await request.json();

      // 验证输入数据
      const validationResult = BasicSettingsFormSchema.safeParse(body);
      if (!validationResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: '输入数据格式不正确',
            details: validationResult.error.issues,
          } as SettingsApiResponse,
          { status: 400 }
        );
      }

      const settingsData = validationResult.data;

      // 获取当前设置值(用于记录变更日志)
      const currentSettings = await prisma.systemSetting.findMany({
        where: {
          key: { in: Object.keys(settingsData) },
        },
        select: {
          key: true,
          value: true,
        },
      });

      const currentSettingsMap = new Map(
        currentSettings.map(s => [s.key, s.value])
      );

      // 批量更新设置
      const updatePromises = Object.entries(settingsData).map(
        async ([key, value]) => {
          if (value === undefined) {
            return null;
          }

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

      // 记录设置变更日志
      const changes = Object.entries(settingsData)
        .filter(([_key, value]) => value !== undefined)
        .map(([key, value]) => {
          let stringValue: string;
          if (typeof value === 'number') {
            stringValue = value.toString();
          } else if (typeof value === 'boolean') {
            stringValue = value.toString();
          } else if (typeof value === 'object' && value !== null) {
            stringValue = JSON.stringify(value);
          } else {
            stringValue = String(value);
          }

          return {
            settingKey: key,
            oldValue: currentSettingsMap.get(key) || null,
            newValue: stringValue,
            remarks: '更新基本设置',
          };
        });

      const requestInfo = extractRequestInfo(request);
      await logSettingChanges(
        changes,
        userId,
        requestInfo.ipAddress || undefined,
        requestInfo.userAgent || undefined
      );

      // 记录系统设置变更日志
      await logSystemEventInfo(
        'update_basic_settings',
        `更新基本设置：成功更新 ${results.length} 个设置项`,
        userId,
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
  },
  { requireAdmin: true }
);
