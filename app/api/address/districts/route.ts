import { NextResponse, type NextRequest } from 'next/server';

import { areas } from '@/lib/data/complete-address-data-full';
import { logger } from '@/lib/logger';
import { RateLimitType, withRateLimit } from '@/lib/rate-limit';

async function handleDistrictsRequest(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const cityCode = searchParams.get('cityCode');

    if (!cityCode) {
      return NextResponse.json(
        {
          success: false,
          error: '城市代码不能为空',
        },
        { status: 400 }
      );
    }

    const filteredDistricts = areas
      .filter(area => area.cityCode === cityCode)
      .map(area => ({
        code: area.code,
        name: area.name,
        type: 'district' as const,
        cityCode: area.cityCode,
        provinceCode: area.provinceCode,
        parentCode: area.cityCode,
      }));

    return NextResponse.json({
      success: true,
      data: filteredDistricts,
    });
  } catch (error) {
    logger.error('address-districts', '获取区县数据失败', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取区县数据失败',
      },
      { status: 500 }
    );
  }
}

export const GET = withRateLimit(RateLimitType.READ)(handleDistrictsRequest);
