import { type NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { logger } from '@/lib/logger';
import {
  createDataManagementTask,
  runDataManagementTask,
  type DataManagementPreview,
} from '@/lib/services/data-management/data-management-service';
import { getSystemMode } from '@/lib/services/system-mode-service';

function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for 可能包含多个IP，取第一个
    const ip = forwardedFor.split(',')[0]?.trim();
    if (ip) {
      return ip;
    }
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp?.trim()) {
    return realIp.trim();
  }

  const requestIp = (request as unknown as { ip?: string }).ip;
  if (typeof requestIp === 'string' && requestIp.trim()) {
    return requestIp.trim();
  }

  return null;
}

function isDataManagementPreview(
  value: unknown
): value is DataManagementPreview {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const preview = value as Record<string, unknown>;
  if (preview.action !== 'reset_trial' && preview.action !== 'cleanup_test') {
    return false;
  }
  if (preview.systemMode !== 'trial' && preview.systemMode !== 'production') {
    return false;
  }
  if (
    !preview.totals ||
    typeof preview.totals !== 'object' ||
    typeof (preview.totals as Record<string, unknown>).count !== 'number' ||
    typeof (preview.totals as Record<string, unknown>).amountSum !== 'number'
  ) {
    return false;
  }
  if (!Array.isArray(preview.items)) {
    return false;
  }
  if (
    !preview.items.every(item => {
      if (!item || typeof item !== 'object') {
        return false;
      }
      const entry = item as Record<string, unknown>;
      if (typeof entry.id !== 'string') {
        return false;
      }
      if (typeof entry.label !== 'string') {
        return false;
      }
      if (typeof entry.count !== 'number') {
        return false;
      }
      if (
        'amountSum' in entry &&
        entry.amountSum !== null &&
        entry.amountSum !== undefined &&
        typeof entry.amountSum !== 'number'
      ) {
        return false;
      }
      return true;
    })
  ) {
    return false;
  }
  if (typeof preview.generatedAt !== 'string') {
    return false;
  }

  return true;
}

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

    const confirmText =
      typeof body.confirmText === 'string' ? body.confirmText : '';
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

    const ipAddress = getClientIp(request);
    const userAgent = request.headers.get('user-agent');

    const previewCandidate = isDataManagementPreview(body.preview)
      ? body.preview
      : null;
    const preview =
      previewCandidate &&
      previewCandidate.action === action &&
      previewCandidate.systemMode === systemMode
        ? previewCandidate
        : null;

    const task = await createDataManagementTask({
      action,
      requestedBy: user.id,
      idempotencyKey,
      scope: { ipAddress, userAgent },
      preview,
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
