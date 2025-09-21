import { areas } from '@/lib/data/address-data';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
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
    console.error('获取区县数据失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取区县数据失败',
      },
      { status: 500 }
    );
  }
}
