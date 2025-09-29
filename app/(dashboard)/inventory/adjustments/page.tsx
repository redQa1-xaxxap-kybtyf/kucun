'use client';

import { ArrowLeft, FileText } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

import { Button } from '@/components/ui/button';

import { AdjustmentDetailDialog } from './components/AdjustmentDetailDialog';
import { AdjustmentRecordsFilters } from './components/AdjustmentRecordsFilters';
import { AdjustmentRecordsTable } from './components/AdjustmentRecordsTable';
import { useAdjustmentRecords } from './hooks/useAdjustmentRecords';

/**
 * 库存调整记录页面
 * 显示所有库存调整的历史记录，支持筛选、搜索、分页等功能
 */
export default function AdjustmentRecordsPage() {
  const {
    records,
    loading,
    error,
    pagination,
    filters,
    selectedRecord,
    detailDialogOpen,
    updateFilters,
    resetFilters,
    handlePageChange,
    handleSortChange,
    handleViewDetail,
    handleCloseDetail,
  } = useAdjustmentRecords();

  return (
    <div className="container mx-auto space-y-6 p-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/inventory">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回库存管理
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center text-2xl font-bold">
              <FileText className="mr-2 h-6 w-6" />
              库存调整记录
            </h1>
            <p className="text-muted-foreground">
              查看和管理所有库存调整的历史记录
            </p>
          </div>
        </div>
      </div>

      {/* 筛选条件 */}
      <AdjustmentRecordsFilters
        filters={filters}
        onFiltersChange={updateFilters}
        onReset={resetFilters}
      />

      {/* 调整记录表格 */}
      <AdjustmentRecordsTable
        records={records}
        loading={loading}
        error={error}
        pagination={pagination}
        onPageChange={handlePageChange}
        onSortChange={handleSortChange}
        onViewDetail={handleViewDetail}
      />

      {/* 详情对话框 */}
      <AdjustmentDetailDialog
        record={selectedRecord}
        open={detailDialogOpen}
        onClose={handleCloseDetail}
      />
    </div>
  );
}
