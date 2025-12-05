/**
 * 调整记录工具栏组件
 * 现代化设计风格，与其他模块保持一致
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
    <div className="card-shadow-medium overflow-hidden rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="card-shadow-light flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] text-[hsl(var(--color-text-on-primary))]">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
              调整记录
            </h1>
            <p className="text-sm text-[hsl(var(--color-text-secondary))]">
              查看和管理库存调整记录，跟踪库存变动历史
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onGoBack && (
            <Button
              variant="outline"
              size="lg"
              className="h-11 gap-2"
              onClick={onGoBack}
            >
              <ArrowLeft className="h-4 w-4" />
              返回
            </Button>
          )}
          {onAdjust && (
            <Button
              size="lg"
              className="card-shadow-light h-11 gap-2 transition-transform duration-150 hover:scale-[1.02]"
              onClick={onAdjust}
            >
              <Edit className="h-4 w-4" />
              新建调整
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
