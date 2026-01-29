'use client';

import { ArrowLeft, PackagePlus, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { InventoryAdjustTable } from './components/InventoryAdjustTable';
import { useInventoryAdjustPage } from './hooks/useInventoryAdjustPage';

const InventoryOperationForm = dynamic(
  () =>
    import('@/components/inventory/inventory-operation-form').then(
      mod => mod.InventoryOperationForm
    ),
  { ssr: false, loading: () => null }
);

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
    handleAdjustSuccess,
    openAdjustDialog,
    closeAdjustDialog,
  } = useInventoryAdjustPage();

  // 处理返回操作
  const handleBack = () => {
    router.push('/inventory');
  };

  return (
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <div className="space-y-6">
        {/* 页面标题 */}
        <PageHeader
          title="库存调整"
          description="查看当前库存状态并进行调整操作"
          icon={<PackagePlus className="h-6 w-6 text-white" />}
          iconBgColor="hsl(var(--color-success))"
          actions={
            <>
              <Button
                variant="outline"
                size="lg"
                className="h-11 gap-2"
                onClick={handleBack}
              >
                <ArrowLeft className="h-4 w-4" />
                返回
              </Button>
              <Button
                size="lg"
                className="h-11 gap-2 shadow-[var(--shadow-light)] transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-medium)]"
                onClick={openAdjustDialog}
              >
                <Plus className="h-4 w-4" />
                新增调整
              </Button>
            </>
          }
        />

        {/* 调整对话框 */}
        <Dialog open={showAdjustDialog} onOpenChange={closeAdjustDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>库存调整</DialogTitle>
            </DialogHeader>
            {showAdjustDialog && (
              <InventoryOperationForm
                mode="adjust"
                onSuccess={handleAdjustSuccess}
                onCancel={closeAdjustDialog}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* 当前库存列表 */}
        <div className="card-shadow-medium overflow-hidden rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))]">
          <div className="border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] px-4 py-3">
            <h2 className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
              当前库存状态
            </h2>
          </div>
          <InventoryAdjustTable
            inventoryRecords={inventoryRecords}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
