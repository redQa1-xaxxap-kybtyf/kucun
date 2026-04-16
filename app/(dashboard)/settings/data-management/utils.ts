import type { ApiResponse, TaskStage } from './types';

export function stageToProgress(stage: TaskStage | null) {
  switch (stage) {
    case 'S0':
      return 10;
    case 'S1':
      return 20;
    case 'S2':
      return 40;
    case 'S3':
      return 60;
    case 'S4':
      return 75;
    case 'S5':
      return 90;
    case 'S6':
      return 100;
    default:
      return 0;
  }
}

export function stageLabel(stage: TaskStage | null) {
  switch (stage) {
    case 'S0':
      return '写入锁与快照';
    case 'S1':
      return '清理关联数据';
    case 'S2':
      return '处理业务单据';
    case 'S3':
      return '冲销往来流水';
    case 'S4':
      return '重建台账汇总';
    case 'S5':
      return '刷新页面数据并核对';
    case 'S6':
      return '解除锁定并记录';
    default:
      return '等待中';
  }
}

export function formatMoney(value?: number) {
  if (typeof value !== 'number') return '-';
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = hours > 0 ? `${String(hours).padStart(2, '0')}:` : '';
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return `${hh}${mm}:${ss}`;
}

export function formatTimeAgo(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function readApiJson<T>(response: Response) {
  try {
    return (await response.json()) as ApiResponse<T>;
  } catch {
    return null;
  }
}

export function getApiErrorMessage(
  json: ApiResponse<unknown> | null,
  fallback: string
) {
  if (!json) return fallback;
  if (json.success) return fallback;
  if (typeof json.error === 'string' && json.error.trim()) return json.error;
  return fallback;
}

export function formatSwitchModeErrorDetails(details: unknown) {
  if (!isRecord(details)) return '';

  const taskIdValue = details['taskId'];
  const actionValue = details['action'];
  if (taskIdValue === undefined && actionValue === undefined) {
    return '';
  }

  const taskId =
    typeof taskIdValue === 'string' && taskIdValue.trim() ? taskIdValue : '-';
  const action =
    typeof actionValue === 'string' && actionValue.trim() ? actionValue : '-';

  return `（taskId=${taskId} action=${action}）`;
}
