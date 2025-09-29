/**
 * 调整记录工具栏组件
 * ERP风格的紧凑布局，符合中国用户习惯
 */

'use client';

import { ArrowLeft, Edit, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface AdjustmentRecordsToolbarProps {
  onGoBack?: () => void;
  onAdjust?: () => void;
}

export function AdjustmentRecordsToolbar({
  onGoBack,
  onAdjust,
}: AdjustmentRecordsToolbarProps) {
  return (
    <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-3">
        {onGoBack && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onGoBack}
            className="h-7 text-xs"
          >
            <ArrowLeft className="mr-1 h-3 w-3" />
            返回
          </Button>
        )}
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span className="text-sm font-medium">调整记录</span>
        </div>
      </div>
      {onAdjust && (
        <Button size="sm" onClick={onAdjust} className="h-7 text-xs">
          <Edit className="mr-1 h-3 w-3" />
          调整
        </Button>
      )}
    </div>
  );
}
