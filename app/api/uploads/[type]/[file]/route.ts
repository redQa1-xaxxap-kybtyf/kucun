import { promises as fs } from 'fs';
import path from 'path';

import { type NextRequest, NextResponse } from 'next/server';
import { decode, getToken } from 'next-auth/jwt';

import { env, uploadConfig } from '@/lib/env';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

function contentTypeForFileName(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case '.webp':
      return 'image/webp';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
}

function isSafeSegment(seg: string): boolean {
  // disallow path separators, traversal, empty
  if (!seg || seg.includes('/') || seg.includes('\\') || seg.includes('..')) {
    return false;
  }
  return /^[A-Za-z0-9._-]+$/.test(seg);
}

export async function GET(
  request: NextRequest,
  context: {
    params:
      | Promise<{ type: string; file: string }>
      | { type: string; file: string };
  }
) {
  try {
    const params = await context.params;
    const type = String(params.type || '').trim();
    const file = String(params.file || '').trim();

    // 仅允许已知类型目录
    if (!['product', 'avatar', 'document'].includes(type)) {
      return NextResponse.json({ success: false, error: '无效的文件类型' }, { status: 400 });
    }

    if (!isSafeSegment(file)) {
      return NextResponse.json({ success: false, error: '无效的文件名' }, { status: 400 });
    }

    // 读取本地兜底图片默认不公开：
    // - Web 端可通过 NextAuth Cookie 访问
    // - 小程序端无法携带 Authorization 头给 <image>，因此使用 URL 上的 token 参数
    //   - t: 短期“文件访问 token”（由 /api/upload 返回）
    //   - mt: 小程序登录 token（兼容历史数据中的旧 URL）
    const searchParams = request.nextUrl.searchParams;
    const fileToken = searchParams.get('t') || searchParams.get('token');
    const miniToken = searchParams.get('mt');

    let authed = false;

    if (fileToken) {
      try {
        const payload = await decode({
          token: fileToken,
          secret: env.NEXTAUTH_SECRET,
          salt: 'uploads',
        });

        if (payload && typeof payload === 'object') {
          const pathInToken = String((payload as any).path || '');
          if (pathInToken === `${type}/${file}`) {
            authed = true;
          }
        }
      } catch (_error) {
        // ignore
      }
    }

    if (!authed && miniToken) {
      try {
        const payload = await decode({
          token: miniToken,
          secret: env.NEXTAUTH_SECRET,
          salt: 'mini-program',
        });

        if (payload && typeof payload === 'object') {
          const userId = String((payload as any).sub || (payload as any).id || '');
          const username = String((payload as any).username || '');
          if (userId && username) {
            authed = true;
          }
        }
      } catch (_error) {
        // ignore
      }
    }

    if (!authed) {
      try {
        const sessionToken = await getToken({
          req: request,
          secret: env.NEXTAUTH_SECRET,
        });
        if (sessionToken) {
          authed = true;
        }
      } catch (_error) {
        // ignore
      }
    }

    if (!authed) {
      return NextResponse.json({ success: false, error: '未授权访问' }, { status: 401 });
    }

    const baseDir = path.resolve(process.cwd(), uploadConfig.directory);
    const typeDir = path.join(baseDir, type);
    const absolutePath = path.resolve(typeDir, file);

    // 防止路径穿越：确保最终路径仍在 typeDir 内
    if (!absolutePath.startsWith(path.resolve(typeDir) + path.sep)) {
      return NextResponse.json({ success: false, error: '无效的文件路径' }, { status: 400 });
    }

    const bytes = await fs.readFile(absolutePath);

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': contentTypeForFileName(file),
        // 文件名包含时间戳+UUID，内容不可变，允许长期缓存
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    logger.error('upload', '读取本地上传文件失败', error);
    return NextResponse.json({ success: false, error: '文件不存在' }, { status: 404 });
  }
}
