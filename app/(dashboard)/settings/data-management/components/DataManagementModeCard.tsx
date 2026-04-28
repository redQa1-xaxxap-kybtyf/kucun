'use client';

import { Eraser, Shield, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { SystemMode } from '../types';

interface DataManagementModeCardProps {
  systemMode: SystemMode;
  canSwitchMode?: boolean;
  isPreviewPending: boolean;
  onPreview: () => void;
  onExecute: () => void;
}

export function DataManagementModeCard({
  systemMode,
  canSwitchMode,
  isPreviewPending,
  onPreview,
  onExecute,
}: DataManagementModeCardProps) {
  const modeBadge =
    systemMode === 'trial' ? (
      <Badge className="bg-emerald-50 text-emerald-700" variant="secondary">
        试用账套
      </Badge>
    ) : (
      <Badge className="bg-amber-50 text-amber-700" variant="secondary">
        正式账套
      </Badge>
    );

  return (
    <Card className="shadow-sm">
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center justify-between gap-3">
          <span>账套状态</span>
          {modeBadge}
        </CardTitle>
        <div className="text-muted-foreground text-sm">
          {systemMode === 'trial' ? (
            <div className="flex items-start gap-2">
              <Eraser className="mt-0.5 h-4 w-4 text-emerald-600" />
              <span>可一键重置业务单据、往来台账和报表。</span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Shield className="mt-0.5 h-4 w-4 text-amber-600" />
                <span>只清理标记为测试的数据，并保留处理记录。</span>
              </div>
              {canSwitchMode ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  初始化阶段如需清空全部数据，先切换为试用账套。
                </div>
              ) : null}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          variant="outline"
          onClick={onPreview}
          disabled={isPreviewPending}
          className="h-10"
        >
          {isPreviewPending ? '预览中...' : '预览清理范围'}
        </Button>
        <Button
          variant={systemMode === 'trial' ? 'destructive' : 'default'}
          onClick={onExecute}
          className="h-10"
        >
          {systemMode === 'trial' ? (
            <span className="flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              重置试用数据
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              清理测试数据
            </span>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
