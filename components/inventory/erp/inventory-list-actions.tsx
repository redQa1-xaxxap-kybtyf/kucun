'use client';

import { Download, Eye, Plus } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';

interface InventoryListActionsProps {
  selectedCount: number;
  onInbound: () => void;
  onOutbound: () => void;
  onAdjust: () => void;
}

export function InventoryListActions({
  selectedCount,
  onInbound,
  onOutbound,
  onAdjust,
}: InventoryListActionsProps) {
  return (
    <div className="flex items-center gap-2">
      {selectedCount > 0 && (
        <div className="text-muted-foreground mr-4 text-sm">
          已选择 {selectedCount} 项
        </div>
      )}

      <Button variant="outline" size="sm" onClick={onInbound}>
        <Plus className="mr-1 h-4 w-4" />
        入库
      </Button>

      <Button variant="outline" size="sm" onClick={onOutbound}>
        <Download className="mr-1 h-4 w-4" />
        出库
      </Button>

      <Button variant="outline" size="sm" onClick={onAdjust}>
        <Eye className="mr-1 h-4 w-4" />
        查看变动
      </Button>
    </div>
  );
}
