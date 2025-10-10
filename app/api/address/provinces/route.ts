import { NextResponse } from 'next/server';

import { provinces } from '@/lib/data/complete-address-data-full';
import { logger } from '@/lib/logger';

export async function GET() {
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
