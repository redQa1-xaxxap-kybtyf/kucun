import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { setDefaultTemplate } from '@/lib/print-designer/actions';

export const dynamic = 'force-dynamic';

async function resolveTemplateId(
  params?: Promise<Record<string, string>> | Record<string, string>
) {
  const resolvedParams = await Promise.resolve(params ?? {});
  return resolvedParams.id ?? '';
}

export const POST = withAuth(
  async (request: NextRequest, { params }) => {
    const id = await resolveTemplateId(params);
    const body = (await request.json().catch(() => null)) as {
      type?: string;
    } | null;

    if (!body?.type) {
      return NextResponse.json(
        { success: false, error: '缺少模板类型' },
        { status: 400 }
      );
    }

    const result = await setDefaultTemplate(id, body.type);

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  },
  { requireAdmin: true }
);
