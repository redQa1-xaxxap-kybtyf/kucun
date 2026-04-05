import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import {
  PrintTemplateSchema,
  TemplateTypeSchema,
  type PrintTemplate,
} from '@/lib/print-designer/schemas';
import { getSystemTemplate } from '@/lib/print-designer/system-templates';

export const dynamic = 'force-dynamic';

function parseTemplateContent(content: unknown): PrintTemplate | null {
  const result = PrintTemplateSchema.safeParse(content);
  return result.success ? result.data : null;
}

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

  const template = await prisma.printTemplate.findFirst({
    where: {
      type: typeResult.data,
      isDefault: true,
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  });

  if (template) {
    const content = parseTemplateContent(template.content);
    if (content) {
      return NextResponse.json({
        success: true,
        data: content,
      });
    }
  }

  return NextResponse.json({
    success: true,
    data: getSystemTemplate(typeResult.data),
  });
});
