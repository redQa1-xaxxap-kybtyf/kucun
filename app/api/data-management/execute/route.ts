import { type NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { logger } from '@/lib/logger';
import { getSystemMode } from '@/lib/services/system-mode-service';
import {
  createDataManagementTask,
  runDataManagementTask,
} from '@/lib/services/data-management/data-management-service';

export const POST = withAuth(
  async (request: NextRequest, { user }) => {
    const body = (await request.json()) as {
      action?: unknown;
      preview?: unknown;
      confirmText?: unknown;
      idempotencyKey?: unknown;
    };

    const action = body.action;
    if (action !== 'reset_trial' && action !== 'cleanup_test') {
      return NextResponse.json(
        { success: false, error: 'action 必须为 reset_trial 或 cleanup_test' },
        { status: 400 }
      );
    }

    const confirmText = typeof body.confirmText === 'string' ? body.confirmText : '';
    const expected = action === 'reset_trial' ? '重置' : '清理';
    if (confirmText !== expected) {
      return NextResponse.json(
        { success: false, error: `强确认失败：请输入“${expected}”` },
        { status: 400 }
      );
    }

    const idempotencyKey =
      typeof body.idempotencyKey === 'string' && body.idempotencyKey.length > 0
        ? body.idempotencyKey
        : request.headers.get('x-idempotency-key');

    const systemMode = await getSystemMode();
    if (action === 'reset_trial' && systemMode !== 'trial') {
      return NextResponse.json(
        { success: false, error: '当前为正式账套，禁止重置试用数据' },
        { status: 400 }
      );
    }
    if (action === 'cleanup_test' && systemMode !== 'production') {
      return NextResponse.json(
        { success: false, error: '当前为试用账套，仅允许重置试用数据' },
        { status: 400 }
      );
    }

    const task = await createDataManagementTask({
      action,
      requestedBy: user.id,
      idempotencyKey,
      scope: null,
      preview:
        body.preview && typeof body.preview === 'object' ? (body.preview as any) : null,
    });

    void runDataManagementTask(task.id).catch(error => {
      logger.error('data-management', '后台执行任务失败', error, {
        taskId: task.id,
        action,
      });
    });

    return NextResponse.json({ success: true, data: { taskId: task.id } });
  },
  { permissions: ['finance:manage'] }
);
