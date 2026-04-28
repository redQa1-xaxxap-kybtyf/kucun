'use client';

import { AlertTriangle, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

import type { Task, TaskStage, TaskStatus } from '../types';
import {
  formatDuration,
  formatMoney,
  formatTimeAgo,
  stageLabel,
  stageToProgress,
} from '../utils';

const STAGE_ORDER = ['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6'] as const;

interface DataManagementTaskProgressCardProps {
  taskId: string;
  task?: Task;
  isLoading: boolean;
  isFetching: boolean;
}

function TaskMetaRow({
  isFetching,
  isTaskActive,
  runningDuration,
  currentStep,
  totalSteps,
  lastUpdateAgo,
  showSlowHint,
}: {
  isFetching: boolean;
  isTaskActive: boolean;
  runningDuration: string | null;
  currentStep: number | null;
  totalSteps: number;
  lastUpdateAgo: string | null;
  showSlowHint: boolean;
}) {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      <span className="flex items-center gap-1">
        {isFetching ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
        )}
        <span>自动刷新：{isTaskActive ? '每 1.5s' : '已停止'}</span>
      </span>
      {runningDuration && <span>已运行：{runningDuration}</span>}
      {currentStep && (
        <span>
          步骤：{currentStep}/{totalSteps}
        </span>
      )}
      {lastUpdateAgo && (
        <span>
          最近更新：{lastUpdateAgo}
          {showSlowHint ? (
            <span className="ml-1 text-amber-600">（本阶段可能耗时较久）</span>
          ) : null}
        </span>
      )}
    </div>
  );
}

function TaskPreviewTotals({
  count,
  amountSum,
}: {
  count: number;
  amountSum: number;
}) {
  return (
    <div className="rounded-md border bg-slate-50 px-3 py-2 text-xs text-slate-700">
      本次范围：{count} 项 / ¥{formatMoney(amountSum)}
    </div>
  );
}

function TaskStatusRow({
  status,
  stage,
  statusLabel,
}: {
  status: TaskStatus;
  stage: TaskStage | null;
  statusLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2">
        {status === 'completed' ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : status === 'failed' ? (
          <AlertTriangle className="h-4 w-4 text-rose-600" />
        ) : (
          <Clock className="h-4 w-4 text-slate-500" />
        )}
        <span className="font-medium">{statusLabel}</span>
      </div>
      <span className="text-muted-foreground">
        {stage ? stageLabel(stage) : '-'}
      </span>
    </div>
  );
}

function TaskProgressSection({
  status,
  stage,
}: {
  status: TaskStatus;
  stage: TaskStage | null;
}) {
  return (
    <div className="space-y-2">
      <Progress
        value={stageToProgress(stage)}
        className={status === 'running' ? 'animate-pulse' : undefined}
      />
      {status === 'running' && (
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>正在后台处理，请勿关闭页面</span>
        </div>
      )}
    </div>
  );
}

function TaskErrorMessage({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
      {message}
    </div>
  );
}

export function DataManagementTaskProgressCard({
  taskId,
  task,
  isLoading,
  isFetching,
}: DataManagementTaskProgressCardProps) {
  const [now, setNow] = React.useState(() => Date.now());
  const isTaskActive =
    task?.status === 'running' || task?.status === 'queued' || isFetching;

  React.useEffect(() => {
    if (!taskId || !isTaskActive) {
      return;
    }

    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isTaskActive, taskId]);

  const taskStartedAtMs = task?.startedAt
    ? new Date(task.startedAt).getTime()
    : null;
  const taskUpdatedAtMs = task?.updatedAt
    ? new Date(task.updatedAt).getTime()
    : null;
  const runningDuration = taskStartedAtMs
    ? formatDuration(now - taskStartedAtMs)
    : null;
  const lastUpdateAgo = taskUpdatedAtMs
    ? formatTimeAgo(now - taskUpdatedAtMs)
    : null;
  const currentStep =
    task?.stage && STAGE_ORDER.includes(task.stage)
      ? STAGE_ORDER.indexOf(task.stage) + 1
      : null;

  const statusLabel =
    task?.status === 'queued'
      ? '排队中'
      : task?.status === 'running'
        ? '执行中'
        : task?.status === 'completed'
          ? '已完成'
          : task?.status === 'failed'
            ? '失败'
            : '-';

  return (
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
        {isLoading && (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4" />
            加载中...
          </div>
        )}

        {task && (
          <>
            <TaskMetaRow
              isFetching={isFetching}
              isTaskActive={isTaskActive}
              runningDuration={runningDuration}
              currentStep={currentStep}
              totalSteps={STAGE_ORDER.length}
              lastUpdateAgo={lastUpdateAgo}
              showSlowHint={Boolean(
                task.status === 'running' &&
                  taskUpdatedAtMs &&
                  now - taskUpdatedAtMs > 15_000
              )}
            />

            {task.preview?.totals && (
              <TaskPreviewTotals
                count={task.preview.totals.count}
                amountSum={task.preview.totals.amountSum}
              />
            )}

            <TaskStatusRow
              status={task.status}
              stage={task.stage}
              statusLabel={statusLabel}
            />

            <TaskProgressSection status={task.status} stage={task.stage} />

            {task.status === 'failed' && task.errorMessage && (
              <TaskErrorMessage message={task.errorMessage} />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
