import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

import { type NextRequest, NextResponse } from 'next/server';
import { encode } from 'next-auth/jwt';
import sharp from 'sharp';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/api-helpers';
import { env, uploadConfig } from '@/lib/env';
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

type ProductImageKind = 'thumbnail' | 'main' | 'effect';

// 根据图片用途返回最大允许大小（字节）
function getMaxSizeForKind(type: string, kind?: string | null): number {
  // 仅对产品图片做更细粒度控制，其它类型继续使用全局 maxSize
  if (type === 'product') {
    if (kind === 'thumbnail' || kind === 'main') {
      // 缩略图 & 主图：1MB，且不超过全局限制
      return Math.min(1 * 1024 * 1024, uploadConfig.maxSize);
    }
    if (kind === 'effect') {
      // 效果图：2MB，且不超过全局限制
      return Math.min(2 * 1024 * 1024, uploadConfig.maxSize);
    }
  }

  // 默认回退到全局上传大小
  return uploadConfig.maxSize;
}

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

    // 本地兜底仍写入配置的 UPLOAD_DIR，真正对外访问通过 /api/uploads/... 读取文件，
    // 避免依赖 Nginx /uploads 静态目录映射（线上经常因配置差异导致 404）。
    const baseDir = path.resolve(process.cwd(), uploadConfig.directory);
    const targetDir = path.join(baseDir, safeType);

    await fs.mkdir(targetDir, { recursive: true });

    const ext = resolveFileExtension(fileName, mimeType);
    const safeFileName = `${Date.now()}-${randomUUID()}${ext}`;
    const absolutePath = path.join(targetDir, safeFileName);

    await fs.writeFile(absolutePath, buffer);

    const urlPath = `/api/uploads/${encodeURIComponent(safeType)}/${encodeURIComponent(
      safeFileName
    )}`;

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
    const errno = error as NodeJS.ErrnoException;
    logger.error('upload', '本地保存文件失败', error, {
      code: errno?.code,
      errno: errno?.errno,
      syscall: errno?.syscall,
    });
    return {
      success: false,
      error:
        errno?.code === 'EACCES' || errno?.code === 'EPERM'
          ? '服务器存储目录无写入权限，请联系管理员'
          : '文件上传失败（本地保存错误）',
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
   const kindRaw = formData.get('kind');
   const kind =
     typeof kindRaw === 'string' && kindRaw.trim().length > 0
       ? (kindRaw as ProductImageKind)
       : undefined;

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

  // 按用途限制图片大小（缩略图/主图 1MB，效果图 2MB，默认使用全局限制）
  const maxSizeForKind = getMaxSizeForKind(type, kind);
  if (file.size > maxSizeForKind) {
    const maxMb = maxSizeForKind / 1024 / 1024;
    const sizeText =
      Number.isInteger(maxMb) ? maxMb.toString() : maxMb.toFixed(2);

    let prefix = '文件';
    if (type === 'product' && kind) {
      if (kind === 'thumbnail') prefix = '缩略图';
      else if (kind === 'main') prefix = '主图';
      else if (kind === 'effect') prefix = '效果图';
    }

    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          error: `${prefix}大小不能超过 ${sizeText}MB`,
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
  userId: string,
  options?: { forceFallback?: boolean; publicBaseOrigin?: string }
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

  const fallbackEnabled = uploadConfig.fallbackEnabled || !!options?.forceFallback;

  if (!fallbackEnabled) {
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

  const publicBaseOrigin =
    options?.publicBaseOrigin?.replace(/\/+$/, '') ||
    process.env.NEXTAUTH_URL?.replace(/\/+$/, '') ||
    null;

  // /api/uploads 不公开读取：为本地兜底文件生成短期访问 token（避免在 URL 中暴露长期登录 token）
  let signedRelativeUrl = fallbackResult.url;
  try {
    const localKey = String(fallbackResult.key || '');
    if (localKey.startsWith('local://')) {
      const keyPath = localKey.slice('local://'.length);
      const [localType, localFileName] = keyPath.split('/');
      if (localType && localFileName) {
        const accessToken = await encode({
          token: {
            id: userId,
            username: '',
            role: '',
            status: '',
            path: `${localType}/${localFileName}`,
          },
          secret: env.NEXTAUTH_SECRET,
          salt: 'uploads',
          maxAge: 60 * 60, // 1小时有效期
        });

        signedRelativeUrl = `/api/uploads/${encodeURIComponent(
          localType
        )}/${encodeURIComponent(localFileName)}?t=${encodeURIComponent(
          accessToken
        )}`;
      }
    }
  } catch (error) {
    logger.warn('upload', '生成本地文件访问 token 失败，将使用原始 URL', undefined, {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const absoluteUrl =
    publicBaseOrigin && signedRelativeUrl.startsWith('/')
      ? `${publicBaseOrigin}${signedRelativeUrl}`
      : signedRelativeUrl;

  return respondWithSuccess({
    file,
    key: fallbackResult.key,
    url: absoluteUrl,
    storage: 'local',
    userId,
    message: '文件已保存到本地存储，建议尽快修复云存储配置（七牛云上传失败）',
  });
}

export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    const isMiniProgram = request.headers.get('x-client-from') === 'mini-program';

    const payload = await extractUploadPayload(request);
    if (!payload.ok) {
      return payload.response;
    }

    const { file, type } = payload;
    const buffer = await prepareUploadBuffer(file, type);

    const publicBaseOrigin = process.env.NEXTAUTH_URL
      ? new URL(process.env.NEXTAUTH_URL).origin
      : request.nextUrl.origin;

    // 小程序端上传优先保证可用：即使未启用 UPLOAD_FALLBACK_ENABLED，
    // 也允许在七牛失败时落本地（避免生产环境存储配置缺失导致“无法上传”）。
    return handleUploadWithFallback(buffer, file, type, user.id, {
      forceFallback: isMiniProgram,
      publicBaseOrigin,
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
