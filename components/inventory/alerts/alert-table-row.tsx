'use client';

import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import {
  INVENTORY_ALERT_TYPE_LABELS,
  INVENTORY_ALERT_TYPE_VARIANTS,
  type InventoryAlert,
} from '@/lib/types/inventory';

interface AlertTableRowProps {
  alert: InventoryAlert;
  onViewProduct: (productId: string) => void;
}

function formatAlertValue(alert: InventoryAlert): string {
  switch (alert.alertType) {
    case 'low_stock':
    case 'out_of_stock':
      return `${alert.currentStock || 0} 片`;
    case 'overstock':
      return `${alert.currentStock || 0} 片 (超出阈值)`;
    default:
      return `${alert.currentStock || 0} 片`;
  }
}

function getAlertSeverity(alert: InventoryAlert): 'high' | 'medium' | 'low' {
  if (alert.alertType === 'out_of_stock') {return 'high';}
  if (alert.alertType === 'low_stock') {return 'medium';}
  return 'low';
}

export function AlertTableRow({ alert, onViewProduct }: AlertTableRowProps) {
  const severity = getAlertSeverity(alert);
  const severityColors = {
    high: 'bg-red-100 text-red-800 border-red-200',
    medium: 'bg-orange-100 text-orange-800 border-orange-200',
    low: 'bg-blue-100 text-blue-800 border-blue-200',
  };

  return (
    <TableRow key={alert.id}>
      <TableCell>
        <Badge variant="secondary" className={severityColors[severity]}>
          {severity === 'high'
            ? '紧急'
            : severity === 'medium'
              ? '警告'
              : '提醒'}
        </Badge>
      </TableCell>
      <TableCell>
        <div>
          <div className="font-medium">{alert.productName}</div>
          <div className="text-sm text-muted-foreground">
            {alert.productCode}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge
          variant={INVENTORY_ALERT_TYPE_VARIANTS[alert.alertType] || 'default'}
        >
          {INVENTORY_ALERT_TYPE_LABELS[alert.alertType] || '未知'}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="font-mono text-sm">{formatAlertValue(alert)}</div>
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewProduct(alert.productId)}
        >
          查看
        </Button>
      </TableCell>
    </TableRow>
  );
}
