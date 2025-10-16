import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

import { type NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/api-helpers';
import { uploadConfig } from '@/lib/env';
import { logger } from '@/lib/logger';
import { uploadToQiniu } from '@/lib/services/qiniu-upload';

// 声明使用 Node.js 运行时（sharp 和 Buffer 需要 Node.js 环境）
export const runtime = 'nodejs';

// 文件上传验证
const uploadValidation = z.object({
  type: z.enum(['product', 'avatar', 'document']).default('product'),
});

// 支持的图片格式
const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

interface LocalUploadResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

function resolveFileExtension(fileName: string, mimeType: string): string {
  const extFromName = path.extname(fileName)?.toLowerCase();
  if (extFromName) {
    return extFromName;
  }

  const mimeMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
  };

  return mimeMap[mimeType] ?? '.jpg';
}

async function saveFileLocally(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  type: string
): Promise<LocalUploadResult> {
  try {
    const safeType = type || 'product';
    const baseDir = path.resolve(process.cwd(), uploadConfig.directory);
    const targetDir = path.join(baseDir, safeType);

    await fs.mkdir(targetDir, { recursive: true });

    const ext = resolveFileExtension(fileName, mimeType);
    const safeFileName = `${Date.now()}-${randomUUID()}${ext}`;
    const absolutePath = path.join(targetDir, safeFileName);

    await fs.writeFile(absolutePath, buffer);

    const publicDir = path.resolve(process.cwd(), 'public');
    let urlPath: string;
    if (absolutePath.startsWith(publicDir)) {
      urlPath = `/${path
        .relative(publicDir, absolutePath)
        .split(path.sep)
        .join('/')}`;
    } else {
      // 如果上传目录不在 public 内，仍然返回相对路径，前端需自行处理
      urlPath = `/${path
        .relative(process.cwd(), absolutePath)
        .split(path.sep)
        .join('/')}`;
    }

    logger.info('upload', '文件已保存到本地目录', undefined, {
      path: absolutePath,
      url: urlPath,
    });

    return {
      success: true,
      url: urlPath,
      key: `local://${safeType}/${safeFileName}`,
    };
  } catch (error) {
    logger.error('upload', '本地保存文件失败', error);
    return {
      success: false,
      error: '文件上传失败（本地保存错误）',
    };
  }
}

export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = (formData.get('type') as string) || 'product';

    // 验证上传类型
    const validationResult = uploadValidation.safeParse({ type });
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '上传类型不正确',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { success: false, error: '未选择文件' },
        { status: 400 }
      );
    }

    // 验证文件类型
    if (
      !SUPPORTED_IMAGE_TYPES.includes(
        file.type as (typeof SUPPORTED_IMAGE_TYPES)[number]
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: '不支持的文件格式，请上传 JPG、PNG、WebP 或 GIF 格式的图片',
        },
        { status: 400 }
      );
    }

    // 验证文件大小
    if (file.size > uploadConfig.maxSize) {
      return NextResponse.json(
        {
          success: false,
          error: `文件大小不能超过 ${uploadConfig.maxSize / 1024 / 1024}MB`,
        },
        { status: 400 }
      );
    }

    // 读取文件内容
    const bytes = await file.arrayBuffer();
    let buffer = Buffer.from(bytes);

    // 如果是图片，使用 sharp 进行优化
    if (file.type.startsWith('image/')) {
      try {
        let sharpInstance = sharp(buffer);

        // 获取图片信息
        await sharpInstance.metadata();

        // 根据上传类型进行不同的优化
        switch (type) {
          case 'product':
            // 产品图片：最大宽度1200px，质量85%
            sharpInstance = sharpInstance
              .resize(1200, 1200, {
                fit: 'inside',
                withoutEnlargement: true,
              })
              .jpeg({ quality: 85 });
            break;

          case 'avatar':
            // 头像：正方形，最大400px
            sharpInstance = sharpInstance
              .resize(400, 400, {
                fit: 'cover',
              })
              .jpeg({ quality: 90 });
            break;

          default:
            // 默认优化
            sharpInstance = sharpInstance
              .resize(1920, 1920, {
                fit: 'inside',
                withoutEnlargement: true,
              })
              .jpeg({ quality: 80 });
        }

        const optimizedBuffer = await sharpInstance.toBuffer();
        buffer = Buffer.from(optimizedBuffer);

        logger.info('upload', '图片优化完成', undefined, {
          fileName: file.name,
          originalSize: bytes.byteLength,
          optimizedSize: buffer.length,
        });
      } catch (sharpError) {
        logger.error('upload', '图片优化失败，使用原始文件', sharpError);
        // 如果优化失败，使用原始buffer
      }
    }

    // 上传到七牛云
    const uploadResult = await uploadToQiniu(buffer, file.name, type);

    if (!uploadResult.success) {
      logger.error('upload', '上传至七牛云失败', undefined, {
        cloudError: uploadResult.error,
      });

      if (uploadConfig.fallbackEnabled) {
        const fallbackResult = await saveFileLocally(
          buffer,
          file.name,
          file.type,
          type
        );

        if (!fallbackResult.success || !fallbackResult.url) {
          return NextResponse.json(
            {
              success: false,
              error:
                uploadResult.error ||
                fallbackResult.error ||
                '上传失败，请联系管理员检查存储配置',
            },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          data: {
            fileName: fallbackResult.key?.split('/').pop() || file.name,
            originalName: file.name,
            size: file.size,
            type: file.type,
            url: fallbackResult.url,
            key: fallbackResult.key,
            uploadedAt: new Date().toISOString(),
            uploadedBy: user.id,
            storage: 'local',
          },
          message:
            '文件已保存到本地存储，建议尽快修复云存储配置（七牛云上传失败）',
        });
      }

      return NextResponse.json(
        {
          success: false,
          error:
            uploadResult.error ||
            '上传失败，请联系管理员检查存储配置（七牛云）',
        },
        { status: 500 }
      );
    }

    // 返回成功响应
    return NextResponse.json({
      success: true,
      data: {
        fileName: uploadResult.key?.split('/').pop() || file.name,
        originalName: file.name,
        size: file.size,
        type: file.type,
        url: uploadResult.url,
        key: uploadResult.key,
        uploadedAt: new Date().toISOString(),
        uploadedBy: user.id,
        storage: 'qiniu',
      },
      message: '文件上传成功',
    });
  } catch (error) {
    logger.error('upload', '文件上传错误', error);
    return NextResponse.json(
      {
        success: false,
        error: '文件上传失败',
        details:
          process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    );
  }
});

// 获取上传文件信息（可选功能）
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'product';

    return NextResponse.json({
      success: true,
      data: {
        maxFileSize: uploadConfig.maxSize,
        supportedTypes: SUPPORTED_IMAGE_TYPES,
        storageType: 'qiniu', // 标识使用七牛云存储
        uploadPath: `qiniu://${type}/`, // 七牛云路径前缀
      },
    });
  } catch (error) {
    logger.error('upload', '获取上传信息错误', error);
    return NextResponse.json(
      { success: false, error: '获取上传信息失败' },
      { status: 500 }
    );
  }
});
