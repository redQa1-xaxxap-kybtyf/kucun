/**
 * 库存调整页面头部组件
 * 包含标题、描述和操作按钮
 */

import { ArrowLeft, Edit, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface InventoryAdjustHeaderProps {
  onBack: () => void;
  onNewAdjust: () => void;
}

export function InventoryAdjustHeader({
  onBack,
  onNewAdjust,
}: InventoryAdjustHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回库存管理
        </Button>
        <div>
          <h1 className="flex items-center text-3xl font-bold tracking-tight">
            <Edit className="mr-3 h-8 w-8" />
            库存调整
          </h1>
          <p className="text-muted-foreground">
            查看当前库存状态并进行调整操作
          </p>
        </div>
      </div>
      <Button onClick={onNewAdjust}>
        <Plus className="mr-2 h-4 w-4" />
        新增调整
      </Button>
    </div>
  );
}
