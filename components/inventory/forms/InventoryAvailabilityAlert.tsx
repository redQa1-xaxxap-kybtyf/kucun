/**
 * 库存可用性检查提示组件
 * 显示库存状态和可用性信息
 */

import { Package } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';

interface InventoryAvailabilityData {
  available: boolean;
  currentStock: number;
  message?: string;
}

interface InventoryAvailabilityAlertProps {
  availabilityData: InventoryAvailabilityData | null;
  mode: 'inbound' | 'outbound' | 'adjust';
}

export function InventoryAvailabilityAlert({
  availabilityData,
  mode,
}: InventoryAvailabilityAlertProps) {
  if (mode !== 'outbound' || !availabilityData) {
    return null;
  }

  return (
    <Alert variant={availabilityData.available ? 'default' : 'destructive'}>
      <Package className="h-4 w-4" />
      <AlertDescription>
        {availabilityData.available
          ? `库存充足：当前库存 ${availabilityData.currentStock}`
          : availabilityData.message || '库存不足，无法完成出库操作'}
      </AlertDescription>
    </Alert>
  );
}
