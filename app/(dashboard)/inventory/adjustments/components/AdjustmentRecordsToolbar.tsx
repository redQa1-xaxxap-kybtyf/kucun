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
    <div className="overflow-hidden rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-6 shadow-lg shadow-gray-200/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              调整记录
            </h1>
            <p className="text-sm text-gray-600">
              查看和管理库存调整记录，跟踪库存变动历史
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onGoBack && (
            <Button
              variant="outline"
              size="lg"
              className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
              onClick={onGoBack}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回
            </Button>
          )}
          {onAdjust && (
            <Button
              size="lg"
              className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
              onClick={onAdjust}
            >
              <Edit className="mr-2 h-4 w-4" />
              新增调整
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
