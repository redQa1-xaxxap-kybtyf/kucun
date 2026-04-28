'use client';

import { FileText, Loader2, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface FormActionsBarProps {
  onCancel: () => void;
  onSaveDraft: () => void;
  onSubmitOrder: () => void;
  isBusy: boolean;
  hasCustomer: boolean;
  hasItems: boolean;
  activeStatus: string;
}

export function FormActionsBar({
  onCancel,
  onSaveDraft,
  onSubmitOrder,
  isBusy,
  hasCustomer,
  hasItems,
  activeStatus,
}: FormActionsBarProps) {
  return (
    <div className="bg-background sticky bottom-0 border-t pt-6">
      <div className="flex items-center justify-between gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isBusy}
          className="min-w-[100px]"
        >
          取消
        </Button>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onSaveDraft}
            disabled={isBusy || !hasCustomer}
            className="min-w-[120px]"
          >
            {isBusy && activeStatus === 'draft' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                保存草稿
              </>
            )}
          </Button>

          <Button
            type="button"
            onClick={onSubmitOrder}
            disabled={isBusy || !hasCustomer || !hasItems}
            className="bg-primary hover:bg-primary/90 min-w-[120px]"
          >
            {isBusy && activeStatus === 'confirmed' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                提交中...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                提交订单
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="text-muted-foreground mt-3 text-center text-xs">
        保存草稿后可以继续修改；提交订单后，这张订单会进入待处理状态
      </div>
    </div>
  );
}
