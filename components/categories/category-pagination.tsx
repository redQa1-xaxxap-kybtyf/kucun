'use client';

/**
 * 分类分页组件
 * 严格遵循全栈项目统一约定规范
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface CategoryPaginationProps {
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
}

export function CategoryPagination({
  pagination,
  onPageChange,
}: CategoryPaginationProps) {
  if (pagination.totalPages <= 1) {
    return null;
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            显示第 {(pagination.page - 1) * pagination.limit + 1} -{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)}{' '}
            条，共 {pagination.total} 条
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              上一页
            </Button>
            <div className="text-sm">
              第 {pagination.page} / {pagination.totalPages} 页
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
            >
              下一页
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
