'use client';

import { BarChart3, Package, Plus, Settings } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Inventory } from '@/lib/types/inventory';

import { BatchInboundForm } from '@/components/inventory/batch-inbound-form';
import { BatchInventoryTable } from '@/components/inventory/batch-inventory-table';

/**
 * 批次管理页面
 * 集成批次入库、库存查看、批次分析等功能
 */
const BatchManagementPage = () => {
  const [showInboundDialog, setShowInboundDialog] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState<Inventory | null>(
    null
  );

  // 处理入库成功
  const handleInboundSuccess = () => {
    setShowInboundDialog(false);
    // 刷新库存数据会通过TanStack Query自动处理
  };

  // 处理库存行点击
  const handleInventoryRowClick = (inventory: Inventory) => {
    setSelectedInventory(inventory);
    // 这里可以打开详情对话框或导航到详情页面
    // 移除console.log语句，使用适当的状态管理
  };

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* 页面标题和操作区域 */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">批次管理</h1>
          <p className="text-muted-foreground">
            管理产品批次信息，包括生产日期、批次号、色号等
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Dialog open={showInboundDialog} onOpenChange={setShowInboundDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                批次入库
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>批次管理入库</DialogTitle>
              </DialogHeader>
              <BatchInboundForm onSuccess={handleInboundSuccess} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 功能标签页 */}
      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            批次库存
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            批次分析
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            批次设置
          </TabsTrigger>
        </TabsList>

        {/* 批次库存标签页 */}
        <TabsContent value="inventory" className="space-y-4">
          <BatchInventoryTable onRowClick={handleInventoryRowClick} />
        </TabsContent>

        {/* 批次分析标签页 */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* 统计卡片 */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    总批次数
                  </p>
                  <p className="text-2xl font-bold">156</p>
                </div>
                <Package className="h-8 w-8 text-blue-600" />
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    有库存批次
                  </p>
                  <p className="text-2xl font-bold text-green-600">142</p>
                </div>
                <Package className="h-8 w-8 text-green-600" />
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    低库存批次
                  </p>
                  <p className="text-2xl font-bold text-orange-600">23</p>
                </div>
                <Package className="h-8 w-8 text-orange-600" />
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    缺货批次
                  </p>
                  <p className="text-2xl font-bold text-red-600">14</p>
                </div>
                <Package className="h-8 w-8 text-red-600" />
              </div>
            </div>
          </div>

          {/* 批次分析图表区域 */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border p-4">
              <h3 className="mb-4 font-semibold">批次库存分布</h3>
              <div className="flex h-64 items-center justify-center text-muted-foreground">
                图表组件待实现
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <h3 className="mb-4 font-semibold">批次周转分析</h3>
              <div className="flex h-64 items-center justify-center text-muted-foreground">
                图表组件待实现
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 批次设置标签页 */}
        <TabsContent value="settings" className="space-y-4">
          <div className="rounded-lg border p-6">
            <h3 className="mb-4 font-semibold">批次管理设置</h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">自动生成批次号</h4>
                  <p className="text-sm text-muted-foreground">
                    入库时自动生成批次号，格式：YYYYMMDD-XXX
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  配置
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">批次过期提醒</h4>
                  <p className="text-sm text-muted-foreground">
                    根据生产日期自动计算批次过期时间并提醒
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  配置
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">批次合并规则</h4>
                  <p className="text-sm text-muted-foreground">
                    设置相同产品不同批次的合并显示规则
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  配置
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">批次标签打印</h4>
                  <p className="text-sm text-muted-foreground">
                    配置批次标签的打印模板和格式
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  配置
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* 库存详情对话框 */}
      {selectedInventory && (
        <Dialog
          open={!!selectedInventory}
          onOpenChange={() => setSelectedInventory(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>批次详情</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">产品名称:</span>
                  <p className="font-medium">
                    {selectedInventory.product?.name}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">产品编码:</span>
                  <p className="font-medium">
                    {selectedInventory.product?.code}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">批次号:</span>
                  <p className="font-medium">
                    {selectedInventory.batchNumber || '-'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">生产日期:</span>
                  <p className="font-medium">
                    {selectedInventory.productionDate || '-'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">色号:</span>
                  <p className="font-medium">
                    {selectedInventory.colorCode || '-'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">存储位置:</span>
                  <p className="font-medium">
                    {selectedInventory.location || '-'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">库存数量:</span>
                  <p className="font-medium text-blue-600">
                    {selectedInventory.quantity}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">可用数量:</span>
                  <p className="font-medium text-green-600">
                    {selectedInventory.quantity -
                      selectedInventory.reservedQuantity}
                  </p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default BatchManagementPage;
