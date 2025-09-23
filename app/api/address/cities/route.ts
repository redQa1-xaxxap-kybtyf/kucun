import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { cities } from '@/lib/data/complete-address-data-full';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const provinceCode = searchParams.get('provinceCode');

    if (!provinceCode) {
      return NextResponse.json(
        {
          success: false,
          error: '省份代码不能为空',
        },
        { status: 400 }
      );
    }

    const filteredCities = cities
      .filter(city => city.provinceCode === provinceCode)
      .map(city => ({
        code: city.code,
        name: city.name,
        type: 'city' as const,
        provinceCode: city.provinceCode,
        parentCode: city.provinceCode,
      }));

    return NextResponse.json({
      success: true,
      data: filteredCities,
    });
  } catch (error) {
    console.error('获取城市数据失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取城市数据失败',
      },
      { status: 500 }
    );
  }
}
