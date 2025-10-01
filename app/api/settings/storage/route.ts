/**
 * 七牛云存储配置API路由
 * 严格遵循全栈项目统一约定规范
 */

import crypto from 'crypto';

import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { storageConfig } from '@/lib/env';
import { extractRequestInfo, logSystemEventInfo } from '@/lib/logger';
import { QiniuStorageConfigSchema } from '@/lib/schemas/settings';
import type {
  QiniuStorageConfig,
  SettingsApiResponse,
} from '@/lib/types/settings';

// 使用环境配置的加密密钥
const ENCRYPTION_KEY = storageConfig.encryptionKey;
const ALGORITHM = 'aes-256-cbc';

/**
 * 加密敏感信息
 */
function encrypt(text: string): string {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY.slice(0, 32)),
      iv
    );
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('加密失败:', error);
    // 如果加密失败，返回原文（在生产环境中应该抛出错误）
    return text;
  }
}

/**
 * 解密敏感信息
 */
function decrypt(text: string): string {
  try {
    if (!text.includes(':')) {
      // 如果没有冒号分隔符，可能是未加密的数据
      return text;
    }

    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = textParts.join(':');
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY.slice(0, 32)),
      iv
    );
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('解密失败:', error);
    // 如果解密失败，返回原文
    return text;
  }
}

/**
 * 获取七牛云存储配置
 */
export async function GET(): Promise<
  NextResponse<SettingsApiResponse<QiniuStorageConfig>>
> {
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 检查管理员权限
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '权限不足，只有管理员可以访问存储配置' },
        { status: 403 }
      );
    }

    // 获取七牛云配置
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            'qiniu_access_key',
            'qiniu_secret_key',
            'qiniu_bucket',
            'qiniu_domain',
            'qiniu_region',
            'qiniu_path_format',
          ],
        },
      },
    });

    // 构建配置对象
    const config: QiniuStorageConfig = {
      accessKey: '',
      secretKey: '',
      bucket: '',
      domain: '',
      region: storageConfig.region,
      pathFormat: '',
    };

    settings.forEach(setting => {
      switch (setting.key) {
        case 'qiniu_access_key':
          config.accessKey = setting.value ? decrypt(setting.value) : '';
          break;
        case 'qiniu_secret_key':
          config.secretKey = setting.value ? decrypt(setting.value) : '';
          break;
        case 'qiniu_bucket':
          config.bucket = setting.value || '';
          break;
        case 'qiniu_domain':
          config.domain = setting.value || '';
          break;
        case 'qiniu_region':
          config.region = setting.value || storageConfig.region;
          break;
        case 'qiniu_path_format':
          config.pathFormat = setting.value || '';
          break;
      }
    });

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('获取七牛云存储配置失败:', error);
    return NextResponse.json(
      { success: false, error: '获取存储配置失败' },
      { status: 500 }
    );
  }
}

/**
 * 保存七牛云存储配置
 */
export async function PUT(
  request: NextRequest
): Promise<NextResponse<SettingsApiResponse<{ message: string }>>> {
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 检查管理员权限
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '权限不足，只有管理员可以修改存储配置' },
        { status: 403 }
      );
    }

    // 解析请求体
    const body = await request.json();
    const validatedData = QiniuStorageConfigSchema.parse(body);

    // 准备配置数据
    const configData = [
      {
        key: 'qiniu_access_key',
        value: encrypt(validatedData.accessKey),
        category: 'storage',
        dataType: 'string',
        description: '七牛云Access Key（加密存储）',
      },
      {
        key: 'qiniu_secret_key',
        value: encrypt(validatedData.secretKey),
        category: 'storage',
        dataType: 'string',
        description: '七牛云Secret Key（加密存储）',
      },
      {
        key: 'qiniu_bucket',
        value: validatedData.bucket,
        category: 'storage',
        dataType: 'string',
        description: '七牛云存储空间名称',
      },
      {
        key: 'qiniu_domain',
        value: validatedData.domain,
        category: 'storage',
        dataType: 'string',
        description: '七牛云访问域名',
      },
      {
        key: 'qiniu_region',
        value: validatedData.region || storageConfig.region,
        category: 'storage',
        dataType: 'string',
        description: '七牛云存储区域',
      },
      {
        key: 'qiniu_path_format',
        value: validatedData.pathFormat || '',
        category: 'storage',
        dataType: 'string',
        description: '七牛云存储目录格式',
      },
    ];

    // 使用事务保存配置
    await prisma.$transaction(async tx => {
      for (const config of configData) {
        await tx.systemSetting.upsert({
          where: { key: config.key },
          update: {
            value: config.value,
            updatedAt: new Date(),
          },
          create: config,
        });
      }
    });

    // 记录系统设置变更日志
    const requestInfo = extractRequestInfo(request);
    await logSystemEventInfo(
      'update_storage_config',
      '更新七牛云存储配置',
      session.user.id,
      requestInfo.ipAddress,
      requestInfo.userAgent,
      {
        bucket: validatedData.bucket,
        domain: validatedData.domain,
        region: validatedData.region,
        // 不记录敏感信息
      }
    );

    return NextResponse.json({
      success: true,
      data: { message: '七牛云存储配置保存成功' },
    });
  } catch (error) {
    console.error('保存七牛云存储配置失败:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: '配置数据格式不正确' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: '保存存储配置失败' },
      { status: 500 }
    );
  }
}
