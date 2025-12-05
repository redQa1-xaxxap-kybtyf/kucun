/**
 * 库存调整页面头部组件
 * 包含标题、描述和操作按钮
 */

import { ArrowLeft, PackagePlus, Plus } from 'lucide-react';

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
    <div
      className="card-shadow-medium overflow-hidden rounded-lg border border-[hsl(var(--color-border-primary))] p-6"
      style={{
        background:
          'linear-gradient(to right, hsl(var(--color-success-light)), hsl(var(--color-success-light) / 0.5))',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className="card-shadow-light flex h-12 w-12 items-center justify-center rounded-xl text-white"
            style={{
              backgroundColor: 'hsl(var(--color-success))',
            }}
          >
            <PackagePlus className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
              库存调整
            </h1>
            <p className="text-sm text-[hsl(var(--color-text-secondary))]">
              查看当前库存状态并进行调整操作
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="lg"
            className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
            onClick={onBack}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          <Button
            size="lg"
            className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
            onClick={onNewAdjust}
          >
            <Plus className="mr-2 h-4 w-4" />
            新增调整
          </Button>
        </div>
      </div>
    </div>
  );
}
