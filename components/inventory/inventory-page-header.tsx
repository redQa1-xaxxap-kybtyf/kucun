'use client';

/**
 * 库存页面头部组件
 * 严格遵循全栈项目统一约定规范
 * 参考：components/categories/category-page-header.tsx
 */

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Package,
  Settings,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface InventoryPageHeaderProps {
  onInbound: () => void;
  onOutbound: () => void;
  onAdjust: () => void;
}

export function InventoryPageHeader({
  onInbound,
  onOutbound,
  onAdjust,
}: InventoryPageHeaderProps) {
  return (
    <Card className="card-shadow-medium overflow-hidden border border-[hsl(var(--color-border-primary))]">
      <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="card-shadow-light flex h-12 w-12 items-center justify-center rounded-xl text-white"
              style={{
                backgroundColor: 'hsl(var(--color-primary))',
              }}
            >
              <Package className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                库存管理
              </h1>
              <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                查看和调整产品库存
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="lg"
              variant="outline"
              onClick={onInbound}
              className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
            >
              <ArrowDownToLine className="mr-2 h-4 w-4" />
              入库
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={onOutbound}
              className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
            >
              <ArrowUpFromLine className="mr-2 h-4 w-4" />
              出库
            </Button>
            <Button
              size="lg"
              onClick={onAdjust}
              className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
            >
              <Settings className="mr-2 h-4 w-4" />
              调整
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
