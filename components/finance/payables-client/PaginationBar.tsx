'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';

interface Props {
  page: number;
  totalPages: number;
  total: number;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
}

export function PaginationBar({
  page,
  totalPages,
  total,
  isLoading,
  onPageChange,
}: Props) {
  return (
    <div className="mt-6 flex items-center justify-between">
      <p className="text-muted-foreground text-sm">共 {total || 0} 条记录</p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || isLoading}
          onClick={() => onPageChange(page - 1)}
        >
          上一页
        </Button>
        <span className="text-muted-foreground text-sm">
          第 {page} / {Math.max(1, totalPages)} 页
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= Math.max(1, totalPages) || isLoading}
          onClick={() => onPageChange(page + 1)}
        >
          下一页
        </Button>
      </div>
    </div>
  );
}
