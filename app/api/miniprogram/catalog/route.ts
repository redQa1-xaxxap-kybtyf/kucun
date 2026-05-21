import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { stripSensitiveKeysDeep } from '@/lib/api/mini-program-sanitize';
import { setMiniProgramPublicCacheHeaders } from '@/lib/api/miniprogram-cache';
import { getMiniProgramCatalog } from '@/lib/services/miniprogram-catalog-service';
import { getRequestOrigin } from '@/lib/utils/request-origin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MINI_PROGRAM_MAX_PAGE = 500;
const MINI_PROGRAM_MAX_PAGE_SIZE = 60;
const booleanLikeSchema = z.enum(['true', 'false', '1', '0']).optional();
function positiveIntegerParam(name: string, max: number) {
  return z
    .string()
    .regex(/^\d+$/, `${name}格式不正确`)
    .refine(value => Number(value) >= 1, `${name}必须大于 0`)
    .refine(value => Number(value) <= max, `${name}不能超过 ${max}`)
    .optional();
}

const catalogQuerySchema = z.object({
  seriesId: z.string().trim().min(1).max(64).optional(),
  componentType: z.string().trim().min(1).max(64).optional(),
  search: z.string().trim().max(120).optional(),
  page: positiveIntegerParam('分页参数', MINI_PROGRAM_MAX_PAGE),
  pageSize: positiveIntegerParam('每页数量', MINI_PROGRAM_MAX_PAGE_SIZE),
  includeProducts: booleanLikeSchema,
});

function parseCatalogQuery(searchParams: URLSearchParams) {
  return catalogQuerySchema.safeParse({
    seriesId: searchParams.get('seriesId') || undefined,
    componentType: searchParams.get('componentType') || undefined,
    search: searchParams.get('search') || undefined,
    page: searchParams.get('page') || undefined,
    pageSize: searchParams.get('pageSize') || undefined,
    includeProducts: searchParams.get('includeProducts') || undefined,
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const parsed = parseCatalogQuery(searchParams);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues[0]?.message || '小程序目录参数不正确',
        details: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  const publicBaseOrigin = getRequestOrigin(request, {
    fallbackOrigin: process.env.NEXTAUTH_URL || request.nextUrl.origin,
    preferFallbackOrigin: Boolean(process.env.NEXTAUTH_URL),
  });

  const data = await getMiniProgramCatalog(
    parsed.data,
    { publicBaseOrigin }
  );

  return setMiniProgramPublicCacheHeaders(
    NextResponse.json({
      success: true,
      data: stripSensitiveKeysDeep(data),
    })
  );
}
