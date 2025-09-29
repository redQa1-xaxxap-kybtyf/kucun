'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { InventoryOperationForm } from '@/components/inventory/inventory-operation-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { AdjustmentDetailDialog } from './components/AdjustmentDetailDialog';
import { AdjustmentRecordsFilters } from './components/AdjustmentRecordsFilters';
import { AdjustmentRecordsTable } from './components/AdjustmentRecordsTable';
import { AdjustmentRecordsToolbar } from './components/AdjustmentRecordsToolbar';
import { useAdjustmentRecords } from './hooks/useAdjustmentRecords';

/**
 * 库存调整记录页面
 * 使用ERP风格的紧凑布局，符合中国用户习惯
 */
export default function AdjustmentRecordsPage() {
  const router = useRouter();
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);

  const {
    adjustments,
    isLoading,
    error,
    queryParams,
    selectedAdjustment,
    showDetailDialog,
    updateQueryParams,
    resetFilters,
    viewDetail,
    closeDetailDialog,
    refetch,
  } = useAdjustmentRecords();

  const handleGoBack = () => {
    router.push('/inventory');
  };

  const handleOpenAdjust = () => {
    setShowAdjustDialog(true);
  };

  const handleCloseAdjust = () => {
    setShowAdjustDialog(false);
  };

  const handleAdjustSuccess = () => {
    setShowAdjustDialog(false);
    refetch();
  };

  if (error) {
    return (
      <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="rounded border bg-card">
          <AdjustmentRecordsToolbar
            onGoBack={handleGoBack}
            onAdjust={handleOpenAdjust}
          />
          <div className="p-6 text-center">
            <div className="text-sm text-destructive">
              加载调整记录失败，请稍后重试
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
      {/* ERP标准工具栏 */}
      <div className="rounded border bg-card">
        <AdjustmentRecordsToolbar
          onGoBack={handleGoBack}
          onAdjust={handleOpenAdjust}
        />
      </div>

      {/* 筛选条件 */}
      <AdjustmentRecordsFilters
        filters={queryParams}
        onFiltersChange={updateQueryParams}
        onReset={resetFilters}
      />

      {/* 调整记录表格 */}
      <AdjustmentRecordsTable
        adjustments={adjustments}
        isLoading={isLoading}
        onViewDetail={viewDetail}
      />

      {/* 调整对话框 */}
      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>库存调整</DialogTitle>
          </DialogHeader>
          <InventoryOperationForm
            mode="adjust"
            onSuccess={handleAdjustSuccess}
            onCancel={handleCloseAdjust}
          />
        </DialogContent>
      </Dialog>

      {/* 详情对话框 */}
      <AdjustmentDetailDialog
        adjustment={selectedAdjustment}
        open={showDetailDialog}
        onOpenChange={open => {
          if (!open) closeDetailDialog();
        }}
      />
    </div>
  );
}
