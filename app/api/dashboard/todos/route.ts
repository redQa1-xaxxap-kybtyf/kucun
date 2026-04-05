import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { logger } from '@/lib/logger';
import { listDashboardTodoItems } from '@/lib/services/dashboard-todo-service';

// 获取待办事项数据
export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    const todos = await listDashboardTodoItems(user.id);

    return NextResponse.json({
      success: true,
      data: todos,
    });
  } catch (error) {
    logger.error('dashboard', '获取待办事项失败', error, {
      userId: user.id,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取待办事项失败',
      },
      { status: 500 }
    );
  }
});
