'use client';

import { FileUp, Package, Plus, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface InventoryListToolbarProps {
  selectedCount: number;
  onBatchDelete?: () => void;
  onBatchInbound?: () => void;
  onBatchOutbound?: () => void;
}

/**
 * 库存列表工具栏组件
 * 库存列表工具栏。
 */
export function InventoryListToolbar({
  selectedCount: _selectedCount,
  onBatchDelete: _onBatchDelete,
  onBatchInbound: _onBatchInbound,
  onBatchOutbound: _onBatchOutbound,
}: InventoryListToolbarProps) {
  const router = useRouter();

  return (
    <Card className="overflow-hidden rounded-md border border-border shadow-sm">
      <CardContent className="bg-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* 图标容器 */}
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[hsl(var(--color-primary))]">
              <Package className="h-6 w-6 text-white" />
            </div>

            {/* 标题和描述 */}
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                库存管理
              </h1>
              <p className="text-sm text-gray-600">
                实时监控库存水平和库存变动
              </p>
            </div>
          </div>

          {/* 主要操作按钮 */}
          <div className="flex gap-2">
            <Button
              onClick={() => router.push('/inventory/adjust')}
              variant="outline"
              size="lg"
              className="h-11 gap-2 shadow-sm"
            >
              <Settings className="h-5 w-5" />
              库存调整
            </Button>
            <Button
              onClick={() => router.push('/inventory/outbound')}
              variant="outline"
              size="lg"
              className="h-11 gap-2 shadow-sm"
            >
              <FileUp className="h-5 w-5" />
              产品出库
            </Button>
            <Button
              onClick={() => router.push('/inventory/inbound/create')}
              size="lg"
              className="h-11 gap-2 shadow-sm"
            >
              <Plus className="h-5 w-5" />
              采购入库
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
