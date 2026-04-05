import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { TemplateTypeSchema } from '@/lib/print-designer/schemas';

export const dynamic = 'force-dynamic';

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

  const documentId = request.nextUrl.searchParams.get('documentId')?.trim();
  if (!documentId) {
    return NextResponse.json(
      {
        success: false,
        error: '缺少单据标识',
      },
      { status: 400 }
    );
  }

  const { getPrintDataForTemplate } = await import(
    '@/lib/print-designer/actions/preview-data'
  );

  const data = await getPrintDataForTemplate(typeResult.data, documentId);
  if (!data) {
    return NextResponse.json(
      {
        success: false,
        error: '未找到可打印的数据',
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data,
  });
});
