/**
 * 库存操作表单头部组件
 * 包含标题、描述和返回按钮
 */

import { ArrowLeft, type LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface InventoryFormHeaderProps {
  title: string;
  description: string;
  IconComponent: LucideIcon;
  onCancel?: () => void;
}

export function InventoryFormHeader({
  title,
  description,
  IconComponent,
  onCancel,
}: InventoryFormHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4">
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
        )}
        <div>
          <h1 className="flex items-center text-3xl font-bold tracking-tight">
            <IconComponent className="mr-3 h-8 w-8" />
            {title}
          </h1>
          <p className="text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}
