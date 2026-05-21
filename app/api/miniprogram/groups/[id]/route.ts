import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { stripSensitiveKeysDeep } from '@/lib/api/mini-program-sanitize';
import { setMiniProgramPublicCacheHeaders } from '@/lib/api/miniprogram-cache';
import { getMiniProgramProductGroup } from '@/lib/services/miniprogram-catalog-service';
import { getRequestOrigin } from '@/lib/utils/request-origin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

const MINI_PROGRAM_MAX_PAGE = 500;
const MINI_PROGRAM_MAX_PAGE_SIZE = 60;
function positiveIntegerParam(name: string, max: number) {
  return z
    .string()
    .regex(/^\d+$/, `${name}格式不正确`)
    .refine(value => Number(value) >= 1, `${name}必须大于 0`)
    .refine(value => Number(value) <= max, `${name}不能超过 ${max}`)
    .optional();
}

const groupQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  page: positiveIntegerParam('分页参数', MINI_PROGRAM_MAX_PAGE),
  pageSize: positiveIntegerParam('每页数量', MINI_PROGRAM_MAX_PAGE_SIZE),
});

function parseGroupQuery(searchParams: URLSearchParams) {
  return groupQuerySchema.safeParse({
    search: searchParams.get('search') || undefined,
    page: searchParams.get('page') || undefined,
    pageSize: searchParams.get('pageSize') || undefined,
  });
}

function safeDecodeRouteParam(value: string) {
  try {
    return decodeURIComponent(value);
  } catch (_error) {
    return null;
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await Promise.resolve(context.params);
  const groupId = safeDecodeRouteParam(id);

  if (!groupId) {
    return NextResponse.json(
      {
        success: false,
        error: '产品组参数不正确',
      },
      { status: 400 }
    );
  }

  const parsed = parseGroupQuery(request.nextUrl.searchParams);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues[0]?.message || '产品组参数不正确',
        details: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  const publicBaseOrigin = getRequestOrigin(request, {
    fallbackOrigin: process.env.NEXTAUTH_URL || request.nextUrl.origin,
    preferFallbackOrigin: Boolean(process.env.NEXTAUTH_URL),
  });
  const data = await getMiniProgramProductGroup(
    groupId,
    parsed.data,
    { publicBaseOrigin }
  );

  if (!data) {
    return NextResponse.json(
      {
        success: false,
        error: '产品组不存在',
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
