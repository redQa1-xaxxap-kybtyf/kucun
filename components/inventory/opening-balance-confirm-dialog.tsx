'use client';

import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface OpeningBalanceConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 期初入库确认对话框组件
 *
 * 用于在用户提交期初入库记录前进行二次确认，
 * 提醒用户期初库存数据的重要性。
 *
 * 使用 shadcn/ui Dialog 组件，符合项目 UI 规范。
 */
export function OpeningBalanceConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
}: OpeningBalanceConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-900">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            期初入库确认
          </DialogTitle>
          <DialogDescription className="space-y-3 pt-2">
            <p className="text-base font-medium text-gray-900">
              您正在录入期初库存数据，请确认数据准确无误。
            </p>
            <p className="text-sm text-gray-600">
              期初库存将影响后续所有财务核算，建议录入完成后进行核对。
            </p>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            className="sm:mr-2"
          >
            取消
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={handleConfirm}
            className="bg-amber-600 hover:bg-amber-700"
          >
            确认入库
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
