'use client';

import { useRouter } from 'next/navigation';

import { InventoryOperationForm } from '@/components/inventory/inventory-operation-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { InventoryAdjustHeader } from './components/InventoryAdjustHeader';
import { InventoryAdjustTable } from './components/InventoryAdjustTable';
import { useInventoryAdjustPage } from './hooks/useInventoryAdjustPage';

/**
 * 库存调整页面
 * 显示当前库存状态并提供新增调整功能
 */
export default function InventoryAdjustPage() {
  const router = useRouter();
  const {
    showAdjustDialog,
    inventoryRecords,
    isLoading,
    error: _error,
    handleAdjustSuccess,
    openAdjustDialog,
    closeAdjustDialog,
  } = useInventoryAdjustPage();

  // 处理返回操作
  const handleBack = () => {
    router.push('/inventory');
  };

  return (
    <div className="mx-auto max-w-none px-4 py-4 sm:px-6 lg:px-8">
      <div className="space-y-4">
        {/* 页面标题卡片 */}
        <InventoryAdjustHeader
          onBack={handleBack}
          onNewAdjust={openAdjustDialog}
        />

        {/* 调整对话框 */}
        <Dialog open={showAdjustDialog} onOpenChange={closeAdjustDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>库存调整</DialogTitle>
            </DialogHeader>
            <InventoryOperationForm
              mode="adjust"
              onSuccess={handleAdjustSuccess}
              onCancel={closeAdjustDialog}
            />
          </DialogContent>
        </Dialog>

        {/* 当前库存列表 */}
        <Card className="shadow-md shadow-gray-200/50">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50">
            <CardTitle>当前库存状态</CardTitle>
          </CardHeader>
          <CardContent>
            <InventoryAdjustTable
              inventoryRecords={inventoryRecords}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
