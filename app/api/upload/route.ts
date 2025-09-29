import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import sharp from 'sharp';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { uploadConfig } from '@/lib/env';
import { uploadToQiniu } from '@/lib/services/qiniu-upload';

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

export async function POST(request: NextRequest) {
  try {
    // 验证用户权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

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
          details: validationResult.error.errors,
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
    if (!SUPPORTED_IMAGE_TYPES.includes(file.type as any)) {
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
        const _metadata = await sharpInstance.metadata();

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

        buffer = await sharpInstance.toBuffer();

        console.log(
          `图片优化完成: ${file.name}, 原始大小: ${bytes.byteLength}, 优化后大小: ${buffer.length}`
        );
      } catch (sharpError) {
        console.error('图片优化失败，使用原始文件:', sharpError);
        // 如果优化失败，使用原始buffer
      }
    }

    // 上传到七牛云
    const uploadResult = await uploadToQiniu(buffer, file.name, type);

    if (!uploadResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: uploadResult.error || '上传失败',
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
        uploadedBy: session.user.id,
      },
      message: '文件上传成功',
    });
  } catch (error) {
    console.error('文件上传错误:', error);
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
}

// 获取上传文件信息（可选功能）
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

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
    console.error('获取上传信息错误:', error);
    return NextResponse.json(
      { success: false, error: '获取上传信息失败' },
      { status: 500 }
    );
  }
}
