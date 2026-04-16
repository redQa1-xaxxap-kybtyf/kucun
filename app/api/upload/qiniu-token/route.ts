import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/api-helpers';
import { createQiniuDirectUploadParams } from '@/lib/services/qiniu-upload';

export const runtime = 'nodejs';

const bodySchema = z.object({
  type: z.enum(['product', 'avatar', 'document']).default('product'),
  kind: z.enum(['thumbnail', 'main', 'effect']).optional(),
  fileName: z.string().min(1).max(200),
});

function safeFileName(raw: string): string {
  // 只保留最后一段文件名，去掉路径
  const name = raw.split('/').pop()?.split('\\').pop() || 'image.jpg';
  // 过滤掉奇怪字符，保留常见可见字符
  return name.replace(/[^\w.\-() ]+/g, '_');
}

export const POST = withAuth(async (request: NextRequest) => {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: '提交内容不正确', details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { type, kind, fileName } = parsed.data;

  // 文件名用于生成 key（包含扩展名）
  const normalizedFileName = safeFileName(fileName);

  // 对 product 图片按用途做子目录，便于管理（不影响现有 web 端）
  const prefix = type === 'product' && kind ? `${type}/${kind}` : type;
  const params = await createQiniuDirectUploadParams(
    normalizedFileName,
    prefix
  );

  if (!params.success) {
    return NextResponse.json(
      { success: false, error: params.error || '生成七牛上传信息失败' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      uploadToken: params.uploadToken,
      uploadHost: params.uploadHost,
      fallbackUploadHosts: params.fallbackUploadHosts,
      key: params.key,
      url: params.url,
      domain: params.domain,
    },
  });
});

