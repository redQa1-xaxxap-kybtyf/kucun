'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';

interface InventoryPaginationProps {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  onPrevPage: () => void;
  onNextPage: () => void;
}

export function InventoryPagination({
  pagination,
  onPrevPage,
  onNextPage,
}: InventoryPaginationProps) {
  if (!pagination || pagination.totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-between border-t bg-muted/30 px-3 py-2">
      <div className="text-sm text-muted-foreground">
        第 {pagination.page} 页，共 {pagination.totalPages} 页 （总计{' '}
        {pagination.total} 条记录）
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7"
          onClick={onPrevPage}
          disabled={pagination.page <= 1}
        >
          <ChevronLeft className="h-3 w-3" />
          上一页
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7"
          onClick={onNextPage}
          disabled={pagination.page >= pagination.totalPages}
        >
          下一页
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
