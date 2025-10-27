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
 * 符合产品模块UI风格规范：
 * - 渐变背景卡片
 * - 图标容器 + 阴影
 * - 选中状态蓝色高亮
 * - 交互动效
 */
export function InventoryListToolbar({
  selectedCount: _selectedCount,
  onBatchDelete: _onBatchDelete,
  onBatchInbound: _onBatchInbound,
  onBatchOutbound: _onBatchOutbound,
}: InventoryListToolbarProps) {
  const router = useRouter();

  return (
    <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
      <CardContent className="bg-gradient-to-r from-slate-50 to-gray-50 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* 图标容器 */}
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
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
              className="h-11 gap-2 shadow-sm transition-all hover:scale-105 hover:shadow-md"
            >
              <Settings className="h-5 w-5" />
              库存调整
            </Button>
            <Button
              onClick={() => router.push('/inventory/outbound')}
              variant="outline"
              size="lg"
              className="h-11 gap-2 shadow-sm transition-all hover:scale-105 hover:shadow-md"
            >
              <FileUp className="h-5 w-5" />
              产品出库
            </Button>
            <Button
              onClick={() => router.push('/inventory/inbound/create')}
              size="lg"
              className="h-11 gap-2 bg-blue-600 shadow-md shadow-blue-600/30 transition-all hover:scale-105 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/40"
            >
              <Plus className="h-5 w-5" />
              产品入库
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
