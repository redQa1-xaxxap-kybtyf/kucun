import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: '该接口已下线，请改用 /api/finance/statements',
    },
    { status: 410 }
  );
}
