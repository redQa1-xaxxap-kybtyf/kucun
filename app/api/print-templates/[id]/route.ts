import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { deleteTemplate, getTemplate } from '@/lib/print-designer/actions';

export const dynamic = 'force-dynamic';

async function resolveTemplateId(
  params?: Promise<Record<string, string>> | Record<string, string>
) {
  const resolvedParams = await Promise.resolve(params ?? {});
  return resolvedParams.id ?? '';
}

export const GET = withAuth(
  async (_request: NextRequest, { params }) => {
    const id = await resolveTemplateId(params);
    const result = await getTemplate(id);

    return NextResponse.json(result, { status: result.success ? 200 : 404 });
  },
  { requireAdmin: true }
);

export const DELETE = withAuth(
  async (_request: NextRequest, { params }) => {
    const id = await resolveTemplateId(params);
    const result = await deleteTemplate(id);

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  },
  { requireAdmin: true }
);
