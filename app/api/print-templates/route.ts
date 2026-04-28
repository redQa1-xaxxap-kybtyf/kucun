import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { getTemplates, saveTemplate } from '@/lib/print-designer/actions';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async request => {
    const type = request.nextUrl.searchParams.get('type') ?? undefined;
    const result = await getTemplates(type);

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  },
  { requireAdmin: true }
);

export const POST = withAuth(
  async request => {
    const template = await request.json();
    const result = await saveTemplate(template);

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  },
  { requireAdmin: true }
);
