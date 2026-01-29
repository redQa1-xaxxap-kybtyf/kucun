'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { useToast } from '@/components/ui/use-toast';
import { csrfFetch } from '@/lib/utils/csrf';

import type { DataManagementAction, Preview, SystemMode, Task } from '../types';
import {
  formatSwitchModeErrorDetails,
  getApiErrorMessage,
  readApiJson,
} from '../utils';

export function useDataManagementPreview(action: DataManagementAction) {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const response = await csrfFetch('/api/data-management/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const json = await readApiJson<Preview>(response);
      if (!response.ok || !json?.success) {
        throw new Error(getApiErrorMessage(json, '预览失败'));
      }
      return json.data;
    },
    onError: error => {
      toast({
        variant: 'destructive',
        title: '预览失败',
        description: String(error),
      });
    },
  });
}

export function useDataManagementExecute(params: {
  action: DataManagementAction;
  preview: Preview | null;
  confirmText: string;
  onSuccess: (taskId: string) => void;
}) {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const response = await csrfFetch('/api/data-management/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: params.action,
          preview: params.preview,
          confirmText: params.confirmText.trim(),
          idempotencyKey: crypto.randomUUID(),
        }),
      });

      const json = await readApiJson<{ taskId: string }>(response);
      if (!response.ok || !json?.success) {
        throw new Error(getApiErrorMessage(json, '执行失败'));
      }
      return json.data;
    },
    onSuccess: data => {
      params.onSuccess(data.taskId);
      toast({ title: '任务已提交', description: `taskId=${data.taskId}` });
    },
    onError: error => {
      toast({
        variant: 'destructive',
        title: '执行失败',
        description: String(error),
      });
    },
  });
}

export function useSystemModeSwitch(params: {
  targetMode: SystemMode;
  onSuccess: (mode: SystemMode) => void;
}) {
  const { toast } = useToast();
  const router = useRouter();

  return useMutation({
    mutationFn: async () => {
      const response = await csrfFetch('/api/system/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: params.targetMode }),
      });
      const json = await readApiJson<{ mode: SystemMode }>(response);

      if (!response.ok || !json?.success) {
        const baseError = getApiErrorMessage(json, '切换失败');
        const detailText =
          json && !json.success
            ? formatSwitchModeErrorDetails(json.details)
            : '';
        throw new Error(`${baseError}${detailText}`);
      }

      return json.data;
    },
    onSuccess: data => {
      params.onSuccess(data.mode);
      toast({
        title: '账套模式已切换',
        description: `当前：${data.mode === 'trial' ? '试用' : '正式'}（页面将刷新）`,
      });
      router.refresh();
    },
    onError: error => {
      toast({
        variant: 'destructive',
        title: '切换失败',
        description: String(error),
      });
    },
  });
}

export function useDataManagementTask(taskId: string | null) {
  return useQuery<Task>({
    queryKey: ['settings', 'data-management-task', taskId ?? ''] as const,
    enabled: Boolean(taskId),
    queryFn: async () => {
      const response = await fetch(
        `/api/data-management/task?id=${encodeURIComponent(taskId ?? '')}`
      );
      const json = await readApiJson<Task>(response);
      if (!response.ok || !json?.success) {
        throw new Error(getApiErrorMessage(json, '获取任务失败'));
      }
      return json.data;
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: query => {
      const data = query.state.data;
      if (!data) return 1500;
      return data.status === 'running' || data.status === 'queued'
        ? 1500
        : false;
    },
  });
}
