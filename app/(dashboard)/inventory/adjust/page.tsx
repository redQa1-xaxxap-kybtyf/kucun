'use client';

import { useRouter } from 'next/navigation';

import { InventoryOperationForm } from '@/components/inventory/inventory-operation-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { AdjustmentDetailDialog } from './components/AdjustmentDetailDialog';
import { AdjustmentRecordsFilters } from './components/AdjustmentRecordsFilters';
import { AdjustmentRecordsTable } from './components/AdjustmentRecordsTable';
import { InventoryAdjustHeader } from './components/InventoryAdjustHeader';
import { InventoryAdjustTable } from './components/InventoryAdjustTable';
import { useAdjustmentRecords } from './hooks/useAdjustmentRecords';
import { useInventoryAdjustPage } from './hooks/useInventoryAdjustPage';

/**
 * 库存调整页面
 * 显示当前库存状态和调整记录，并提供新增调整功能
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

  // 调整记录管理
  const {
    adjustments,
    pagination,
    isLoading: isLoadingAdjustments,
    queryParams,
    selectedAdjustment,
    showDetailDialog,
    updateQueryParams,
    resetFilters,
    viewDetail,
    closeDetailDialog,
    refetch: refetchAdjustments,
  } = useAdjustmentRecords();

  // 处理返回操作
  const handleBack = () => {
    router.push('/inventory');
  };

  // 处理调整成功后的操作
  const handleAdjustSuccessWithRefresh = () => {
    handleAdjustSuccess();
    refetchAdjustments(); // 刷新调整记录
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
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
            onSuccess={handleAdjustSuccessWithRefresh}
            onCancel={closeAdjustDialog}
          />
        </DialogContent>
      </Dialog>

      {/* 调整记录详情对话框 */}
      <AdjustmentDetailDialog
        adjustment={selectedAdjustment}
        open={showDetailDialog}
        onOpenChange={closeDetailDialog}
      />

      {/* 当前库存列表 */}
      <Card>
        <CardHeader>
          <CardTitle>当前库存状态</CardTitle>
        </CardHeader>
        <CardContent>
          <InventoryAdjustTable
            inventoryRecords={inventoryRecords}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* 调整记录列表 */}
      <Card>
        <CardHeader>
          <CardTitle>调整记录</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 筛选条件 */}
          <AdjustmentRecordsFilters
            filters={queryParams}
            onFiltersChange={updateQueryParams}
            onReset={resetFilters}
          />

          {/* 调整记录表格 */}
          <AdjustmentRecordsTable
            adjustments={adjustments}
            isLoading={isLoadingAdjustments}
            onViewDetail={viewDetail}
          />

          {/* 分页 */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                共 {pagination.total} 条记录，第 {pagination.page} /{' '}
                {pagination.totalPages} 页
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() =>
                    updateQueryParams({ page: pagination.page - 1 })
                  }
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() =>
                    updateQueryParams({ page: pagination.page + 1 })
                  }
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
