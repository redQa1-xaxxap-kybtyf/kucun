/**
 * 库存操作表单操作按钮组件
 * 包含取消和提交按钮
 */

import { Loader2, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { type OperationMode } from '../hooks/useInventoryOperationForm';

interface InventoryFormActionsProps {
  mode: OperationMode;
  isLoading: boolean;
  onCancel?: () => void;
}

export function InventoryFormActions({
  mode,
  isLoading,
  onCancel,
}: InventoryFormActionsProps) {
  const getActionText = () => {
    switch (mode) {
      case 'inbound':
        return '入库';
      case 'outbound':
        return '出库';
      case 'adjust':
        return '调整';
      default:
        return '确认';
    }
  };

  return (
    <div className="flex items-center justify-end space-x-4">
      {onCancel && (
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          取消
        </Button>
      )}
      <Button type="submit" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        <Save className="mr-2 h-4 w-4" />
        确认{getActionText()}
      </Button>
    </div>
  );
}
