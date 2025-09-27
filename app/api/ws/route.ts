import { NextResponse } from 'next/server';

import { wsServer } from '@/lib/ws/ws-server';

// 确保 WebSocket 服务器启动
export async function GET() {
  try {
    wsServer.ensureStarted();
    return NextResponse.json({
      success: true,
      message: 'WebSocket server is running',
    });
  } catch (error) {
    console.error('WebSocket server error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to start WebSocket server' },
      { status: 500 }
    );
  }
}
