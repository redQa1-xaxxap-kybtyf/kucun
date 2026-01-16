'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Clock, Eraser, Shield, Trash2 } from 'lucide-react';
import * as React from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { csrfFetch } from '@/lib/utils/csrf';

type DataManagementAction = 'reset_trial' | 'cleanup_test';

type PreviewItem = { id: string; label: string; count: number; amountSum?: number };
type Preview = {
  action: DataManagementAction;
  systemMode: 'trial' | 'production';
  totals: { count: number; amountSum: number };
  items: PreviewItem[];
  generatedAt: string;
};

type Task = {
  id: string;
  action: DataManagementAction;
  status: 'queued' | 'running' | 'completed' | 'failed';
  stage: 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | null;
  errorMessage: string | null;
  preview: Preview | null;
  result: any;
  startedAt: string | null;
  finishedAt: string | null;
};

function stageToProgress(stage: Task['stage']) {
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

function stageLabel(stage: Task['stage']) {
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
      return '清理缓存与核验';
    case 'S6':
      return '解锁与落日志';
    default:
      return '等待中';
  }
}

function formatMoney(value?: number) {
  if (typeof value !== 'number') return '-';
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function DataManagementPageClient({ systemMode }: { systemMode: 'trial' | 'production' }) {
  const { toast } = useToast();

  const action: DataManagementAction = systemMode === 'trial' ? 'reset_trial' : 'cleanup_test';
  const confirmWord = systemMode === 'trial' ? '重置' : '清理';

  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [executeOpen, setExecuteOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState('');
  const [taskId, setTaskId] = React.useState<string | null>(null);

  const previewMutation = useMutation({
    mutationFn: async () => {
      const response = await csrfFetch('/api/data-management/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = (await response.json()) as any;
      if (!response.ok || !json?.success) {
        throw new Error(json?.error || '预览失败');
      }
      return json.data as Preview;
    },
    onError: error => {
      toast({ variant: 'destructive', title: '预览失败', description: String(error) });
    },
  });

  const executeMutation = useMutation({
    mutationFn: async () => {
      const response = await csrfFetch('/api/data-management/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          confirmText,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const json = (await response.json()) as any;
      if (!response.ok || !json?.success) {
        throw new Error(json?.error || '执行失败');
      }
      return json.data as { taskId: string };
    },
    onSuccess: data => {
      setTaskId(data.taskId);
      setExecuteOpen(false);
      setConfirmText('');
      toast({ title: '任务已提交', description: `taskId=${data.taskId}` });
    },
    onError: error => {
      toast({ variant: 'destructive', title: '执行失败', description: String(error) });
    },
  });

  const taskQuery = useQuery<Task>({
    queryKey: ['settings', 'data-management-task', taskId ?? ''] as const,
    enabled: Boolean(taskId),
    queryFn: async () => {
      const response = await fetch(`/api/data-management/task?id=${encodeURIComponent(taskId ?? '')}`);
      const json = (await response.json()) as any;
      if (!response.ok || !json?.success) {
        throw new Error(json?.error || '获取任务失败');
      }
      return json.data as Task;
    },
    refetchInterval: query => {
      const data = query.state.data;
      if (!data) return 1500;
      return data.status === 'running' || data.status === 'queued' ? 1500 : false;
    },
  });

  const preview = previewMutation.data;
  const task = taskQuery.data;

  const modeBadge =
    systemMode === 'trial' ? (
      <Badge className="bg-emerald-50 text-emerald-700" variant="secondary">
        当前账套：试用（可重置）
      </Badge>
    ) : (
      <Badge className="bg-amber-50 text-amber-700" variant="secondary">
        当前账套：正式（受保护）
      </Badge>
    );

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center justify-between gap-3">
            <span>当前模式</span>
            {modeBadge}
          </CardTitle>
          <div className="text-sm text-muted-foreground">
            {systemMode === 'trial' ? (
              <div className="flex items-start gap-2">
                <Eraser className="mt-0.5 h-4 w-4 text-emerald-600" />
                <span>
                  试用账套允许一键重置：业务单据、往来台账与报表会清空/归零。
                </span>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <Shield className="mt-0.5 h-4 w-4 text-amber-600" />
                <span>
                  正式账套受保护：仅清理标记为测试的数据；已入账数据会作废/冲销，保证可追溯。
                </span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            variant="outline"
            onClick={() => {
              setPreviewOpen(true);
              previewMutation.mutate();
            }}
            disabled={previewMutation.isPending}
            className="h-10"
          >
            {previewMutation.isPending ? '预览中...' : '预览清理范围'}
          </Button>
          <Button
            variant={systemMode === 'trial' ? 'destructive' : 'default'}
            onClick={() => setExecuteOpen(true)}
            className="h-10"
          >
            {systemMode === 'trial' ? (
              <span className="flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                一键重置试用数据
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                清理测试数据（安全模式）
              </span>
            )}
          </Button>
        </CardContent>
      </Card>

      {taskId && (
        <Card className="shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center justify-between gap-3">
              <span>任务进度</span>
              <Badge variant="secondary" className="font-mono text-[10px]">
                {taskId}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {taskQuery.isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                加载中...
              </div>
            )}

            {task && (
              <>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    {task.status === 'completed' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : task.status === 'failed' ? (
                      <AlertTriangle className="h-4 w-4 text-rose-600" />
                    ) : (
                      <Clock className="h-4 w-4 text-slate-500" />
                    )}
                    <span className="font-medium">
                      {task.status === 'queued'
                        ? '排队中'
                        : task.status === 'running'
                          ? '执行中'
                          : task.status === 'completed'
                            ? '已完成'
                            : '失败'}
                    </span>
                  </div>
                  <span className="text-muted-foreground">
                    {task.stage ? stageLabel(task.stage) : '-'}
                  </span>
                </div>

                <Progress value={stageToProgress(task.stage)} />

                {task.status === 'failed' && task.errorMessage && (
                  <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                    {task.errorMessage}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <AlertDialogContent className="max-w-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>预览清理范围</AlertDialogTitle>
            <AlertDialogDescription>
              用于防误操作：先查看将被处理的数据范围（数量/金额）。不做任何修改。
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            {previewMutation.isPending && (
              <div className="text-sm text-muted-foreground">正在生成预览...</div>
            )}
            {preview && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    生成时间：{new Date(preview.generatedAt).toLocaleString('zh-CN')}
                  </span>
                  <span className="font-medium">
                    合计：{preview.totals.count} 项 / ¥{formatMoney(preview.totals.amountSum)}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {preview.items.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      <span>{item.label}</span>
                      <span className="font-mono text-xs text-slate-600">
                        {item.count}
                        {typeof item.amountSum === 'number' ? ` / ¥${formatMoney(item.amountSum)}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>关闭</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setPreviewOpen(false);
              }}
            >
              我已知晓
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={executeOpen} onOpenChange={setExecuteOpen}>
        <AlertDialogContent className="max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>强确认</AlertDialogTitle>
            <AlertDialogDescription>
              本操作不可撤销。请输入“{confirmWord}”以继续。
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <Input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder={`请输入：${confirmWord}`}
            />
            {systemMode === 'production' && (
              <div className="text-xs text-muted-foreground">
                提示：退货结算相关退款不会直接影响权责利润；清理测试数据会通过作废/冲销保证往来台账可追溯。
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmText('')}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={executeMutation.isPending || confirmText !== confirmWord}
              onClick={() => executeMutation.mutate()}
            >
              {executeMutation.isPending ? '执行中...' : '确认执行'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
