'use client';

import { BellOff } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { AlertTableRow } from '@/components/inventory/alerts/alert-table-row';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { InventoryAlert } from '@/lib/types/inventory';

interface InventoryAlertTableProps {
  alerts: InventoryAlert[];
  showAll: boolean;
  hasMore: boolean;
  onToggleShowAll: () => void;
}

export function InventoryAlertTable({
  alerts,
  showAll,
  hasMore,
  onToggleShowAll,
}: InventoryAlertTableProps) {
  const router = useRouter();

  const handleViewProduct = (productId: string) => {
    router.push(`/products/${productId}`);
  };

  if (alerts.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <BellOff className="mx-auto mb-2 h-8 w-8" />
        <p className="text-sm">暂无库存预警</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">严重程度</TableHead>
            <TableHead>产品信息</TableHead>
            <TableHead>预警类型</TableHead>
            <TableHead>当前库存</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alerts.map(alert => (
            <AlertTableRow
              key={alert.id}
              alert={alert}
              onViewProduct={handleViewProduct}
            />
          ))}
        </TableBody>
      </Table>

      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={onToggleShowAll}
            className="w-full max-w-xs"
          >
            {showAll ? '收起' : '查看全部'}
          </Button>
        </div>
      )}
    </div>
  );
}
