import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/api-helpers';
import { TemplateTypeSchema } from '@/lib/print-designer/schemas';

export const dynamic = 'force-dynamic';

const LimitSchema = z.coerce.number().int().min(1).max(50).default(10);

export const GET = withAuth(async request => {
  const typeParam = request.nextUrl.searchParams.get('type');
  const typeResult = TemplateTypeSchema.safeParse(typeParam);

  if (!typeResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: '无效的打印模板类型',
      },
      { status: 400 }
    );
  }

  const limitResult = LimitSchema.safeParse(
    request.nextUrl.searchParams.get('limit') ?? 10
  );

  if (!limitResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: '无效的加载数量',
      },
      { status: 400 }
    );
  }

  const { getRecentDocumentsForTemplate } = await import(
    '@/lib/print-designer/actions/preview-data'
  );

  const data = await getRecentDocumentsForTemplate(
    typeResult.data,
    limitResult.data
  );

  return NextResponse.json({
    success: true,
    data,
  });
});
