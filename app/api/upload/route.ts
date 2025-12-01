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

type UploadPayloadResult =
  | { ok: true; file: File; type: string }
  | { ok: false; response: NextResponse };

async function extractUploadPayload(
  request: NextRequest
): Promise<UploadPayloadResult> {
  const formData = await request.formData();
  const rawFile = formData.get('file');
  const type = (formData.get('type') as string) || 'product';

  const validationResult = uploadValidation.safeParse({ type });
  if (!validationResult.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          error: '上传类型不正确',
          details: validationResult.error.issues,
        },
        { status: 400 }
      ),
    };
  }

  if (!(rawFile instanceof File)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: '未选择文件' },
        { status: 400 }
      ),
    };
  }

  const file = rawFile as File;

  if (
    !SUPPORTED_IMAGE_TYPES.includes(
      file.type as (typeof SUPPORTED_IMAGE_TYPES)[number]
    )
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          error: '不支持的文件格式，请上传 JPG、PNG、WebP 或 GIF 格式的图片',
        },
        { status: 400 }
      ),
    };
  }

  if (file.size > uploadConfig.maxSize) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          error: `文件大小不能超过 ${uploadConfig.maxSize / 1024 / 1024}MB`,
        },
        { status: 400 }
      ),
    };
  }

  return { ok: true, file, type };
}

async function prepareUploadBuffer(file: File, type: string): Promise<Buffer> {
  const bytes = await file.arrayBuffer();
  let buffer = Buffer.from(bytes);

  if (!file.type.startsWith('image/')) {
    return buffer;
  }

  try {
    let sharpInstance = sharp(buffer);

    await sharpInstance.metadata();

    switch (type) {
      case 'product':
        sharpInstance = sharpInstance.resize(1200, 1200, {
          fit: 'inside',
          withoutEnlargement: true,
        });
        break;
      case 'avatar':
        sharpInstance = sharpInstance.resize(400, 400, {
          fit: 'cover',
        });
        break;
      default:
        sharpInstance = sharpInstance.resize(1920, 1920, {
          fit: 'inside',
          withoutEnlargement: true,
        });
    }

    // 默认统一转为 WebP，以减少带宽占用
    const optimizedBuffer = await sharpInstance
      .webp({ quality: 80 })
      .toBuffer();
    buffer = Buffer.from(optimizedBuffer);

    logger.info('upload', '图片优化完成', undefined, {
      fileName: file.name,
      originalSize: bytes.byteLength,
      optimizedSize: buffer.length,
    });
  } catch (sharpError) {
    logger.error('upload', '图片优化失败，使用原始文件', sharpError);
  }

  return buffer;
}

interface UploadSuccessOptions {
  file: File;
  key?: string;
  url?: string;
  storage: 'qiniu' | 'local';
  userId: string;
  message: string;
}

function respondWithSuccess({
  file,
  key,
  url,
  storage,
  userId,
  message,
}: UploadSuccessOptions) {
  const fileName = key?.split('/').pop() || file.name;

  return NextResponse.json({
    success: true,
    data: {
      fileName,
      originalName: file.name,
      size: file.size,
      type: file.type,
      url,
      key,
      uploadedAt: new Date().toISOString(),
      uploadedBy: userId,
      storage,
    },
    message,
  });
}

async function handleUploadWithFallback(
  buffer: Buffer,
  file: File,
  type: string,
  userId: string
) {
  // 统一以 WebP 作为目标格式存储到七牛
  const targetFileName = `${file.name.replace(/\.[^.]+$/, '')}.webp`;

  const uploadResult = await uploadToQiniu(buffer, targetFileName, type);

  if (uploadResult.success) {
    return respondWithSuccess({
      file,
      key: uploadResult.key,
      url: uploadResult.url,
      storage: 'qiniu',
      userId,
      message: '文件上传成功',
    });
  }

  logger.error('upload', '上传至七牛云失败', undefined, {
    cloudError: uploadResult.error,
  });

  if (!uploadConfig.fallbackEnabled) {
    return NextResponse.json(
      {
        success: false,
        error:
          uploadResult.error || '上传失败，请联系管理员检查存储配置（七牛云）',
      },
      { status: 500 }
    );
  }

  const fallbackResult = await saveFileLocally(
    buffer,
    // 本地兜底也使用 webp 扩展名
    targetFileName,
    'image/webp',
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

  return respondWithSuccess({
    file,
    key: fallbackResult.key,
    url: fallbackResult.url,
    storage: 'local',
    userId,
    message: '文件已保存到本地存储，建议尽快修复云存储配置（七牛云上传失败）',
  });
}

export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    const payload = await extractUploadPayload(request);
    if (!payload.ok) {
      return payload.response;
    }

    const { file, type } = payload;
    const buffer = await prepareUploadBuffer(file, type);

    return handleUploadWithFallback(buffer, file, type, user.id);
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
