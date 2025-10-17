import { NextResponse, type NextRequest } from 'next/server';

import { provinces } from '@/lib/data/complete-address-data-full';
import { logger } from '@/lib/logger';
import { RateLimitType, withRateLimit } from '@/lib/rate-limit';

async function handleProvincesRequest(_request: NextRequest) {
  try {
    const formattedProvinces = provinces.map(province => ({
      code: province.code,
      name: province.name,
      type: 'province' as const,
    }));

    return NextResponse.json({
      success: true,
      data: formattedProvinces,
    });
  } catch (error) {
    logger.error('address-provinces', '获取省份数据失败', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取省份数据失败',
      },
      { status: 500 }
    );
  }
}

export const GET = withRateLimit(RateLimitType.READ)(handleProvincesRequest);
