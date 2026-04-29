import { NextResponse, type NextRequest } from 'next/server';

import { getMiniProgramCatalog } from '@/lib/services/miniprogram-catalog-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const data = await getMiniProgramCatalog({
    seriesId: searchParams.get('seriesId') || undefined,
    componentType: searchParams.get('componentType') || undefined,
    search: searchParams.get('search') || undefined,
  });

  return NextResponse.json({
    success: true,
    data,
  });
}
