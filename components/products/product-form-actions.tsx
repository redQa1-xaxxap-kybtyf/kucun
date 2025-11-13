'use client';

import { ArrowLeft, Save } from 'lucide-react';

import { InlineLoading } from '@/components/common/loading';
import { Button } from '@/components/ui/button';

interface ProductFormActionsProps {
  mode: 'create' | 'edit';
  isLoading: boolean;
  onCancel?: () => void;
}

export function ProductFormActions({
  mode,
  isLoading,
  onCancel,
}: ProductFormActionsProps) {
  const submitText = mode === 'create' ? '新建产品' : '保存修改';
  const loadingText = mode === 'create' ? '保存中...' : '保存中...';

  return (
    <div className="flex items-center justify-between pt-6">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={isLoading}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        取消
      </Button>

      <Button type="submit" disabled={isLoading}>
        {isLoading ? (
          <>
            <InlineLoading size="sm" className="mr-2" />
            {loadingText}
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" />
            {submitText}
          </>
        )}
      </Button>
    </div>
  );
}
