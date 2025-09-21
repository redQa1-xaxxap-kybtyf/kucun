import { provinces } from '@/lib/data/complete-address-data-full.js';
import { NextResponse } from 'next/server';

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
    console.error('获取省份数据失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取省份数据失败',
      },
      { status: 500 }
    );
  }
}
