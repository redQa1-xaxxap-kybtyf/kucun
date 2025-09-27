import { NextResponse } from 'next/server';

import { wsServer } from '@/lib/ws/ws-server';

// 确保 WebSocket 服务器启动
export async function GET() {
  try {
    wsServer.ensureStarted();
    return NextResponse.json({
      success: true,
      message: 'WebSocket服务器正在运行',
    });
  } catch (error) {
    console.error('WebSocket服务器错误:', error);
    return NextResponse.json(
      { success: false, error: 'WebSocket服务器启动失败' },
      { status: 500 }
    );
  }
}
