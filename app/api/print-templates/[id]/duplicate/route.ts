import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { duplicateTemplate } from '@/lib/print-designer/actions';

export const dynamic = 'force-dynamic';

async function resolveTemplateId(
  params?: Promise<Record<string, string>> | Record<string, string>
) {
  const resolvedParams = await Promise.resolve(params ?? {});
  return resolvedParams.id ?? '';
}

export const POST = withAuth(
  async (_request: NextRequest, { params }) => {
    const id = await resolveTemplateId(params);
    const result = await duplicateTemplate(id);

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  },
  { requireAdmin: true }
);
