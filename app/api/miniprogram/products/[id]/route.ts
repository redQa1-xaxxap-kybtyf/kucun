import { NextResponse, type NextRequest } from 'next/server';

import { getMiniProgramProduct } from '@/lib/services/miniprogram-catalog-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await Promise.resolve(context.params);
  const data = await getMiniProgramProduct(id);

  if (!data) {
    return NextResponse.json(
      {
        success: false,
        error: '产品不存在',
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data,
  });
}
