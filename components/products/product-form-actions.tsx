'use client';

import { ArrowLeft, Loader2, Save } from 'lucide-react';

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
  const submitText = mode === 'create' ? '创建产品' : '更新产品';
  const loadingText = mode === 'create' ? '创建中...' : '更新中...';

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
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
