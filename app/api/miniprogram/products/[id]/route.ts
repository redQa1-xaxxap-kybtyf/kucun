import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { stripSensitiveKeysDeep } from '@/lib/api/mini-program-sanitize';
import { setMiniProgramPublicCacheHeaders } from '@/lib/api/miniprogram-cache';
import { getMiniProgramProduct } from '@/lib/services/miniprogram-catalog-service';
import { getRequestOrigin } from '@/lib/utils/request-origin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

const productIdSchema = z.string().trim().min(1).max(128);

function safeDecodeRouteParam(value: string) {
  try {
    return decodeURIComponent(value);
  } catch (_error) {
    return null;
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await Promise.resolve(context.params);
  const productId = safeDecodeRouteParam(id);

  if (!productId) {
    return NextResponse.json(
      {
        success: false,
        error: '产品参数不正确',
      },
      { status: 400 }
    );
  }

  const parsedId = productIdSchema.safeParse(productId);

  if (!parsedId.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsedId.error.issues[0]?.message || '产品参数不正确',
        details: parsedId.error.issues,
      },
      { status: 400 }
    );
  }

  const publicBaseOrigin = getRequestOrigin(request, {
    fallbackOrigin: process.env.NEXTAUTH_URL || request.nextUrl.origin,
    preferFallbackOrigin: Boolean(process.env.NEXTAUTH_URL),
  });
  const data = await getMiniProgramProduct(parsedId.data, {
    publicBaseOrigin,
  });

  if (!data) {
    return NextResponse.json(
      {
        success: false,
        error: '产品不存在',
      },
      { status: 404 }
    );
  }

  return setMiniProgramPublicCacheHeaders(
    NextResponse.json({
      success: true,
      data: stripSensitiveKeysDeep(data),
    })
  );
}
