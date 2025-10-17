'use client';

/**
 * 供应商管理页面客户端组件
 * 严格遵循全栈项目统一约定规范
 * 职责：处理用户交互、状态管理、TanStack Query 数据管理
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, MoreHorizontal, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { SupplierPageHeader } from '@/components/suppliers/supplier-page-header';
import { SupplierSearchFilters } from '@/components/suppliers/supplier-search-filters';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Pagination } from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import {
  deleteSupplier,
  getSuppliers,
  supplierQueryKeys,
} from '@/lib/api/suppliers';
import type { Supplier, SupplierQueryParams } from '@/lib/types/supplier';
import { getCommonStatusBadgeVariant } from '@/lib/utils/badge-helpers';
import { formatSupplierStatus } from '@/lib/utils/supplier-display';

interface SuppliersPageClientProps {
  initialParams: {
    page: number;
    limit: number;
    search?: string;
    status?: 'active' | 'inactive';
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };
}

export function SuppliersPageClient({
  initialParams,
}: SuppliersPageClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [_isPending, startTransition] = useTransition();

  // 本地状态
  const [search, setSearch] = useState(initialParams.search || '');
  const [status, setStatus] = useState<'active' | 'inactive' | undefined>(
    initialParams.status
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(
    null
  );

  useEffect(() => {
    setSearch(initialParams.search || '');
    setStatus(initialParams.status);
  }, [initialParams]);

  const queryParams = useMemo(() => {
    const normalizedSearch =
      typeof initialParams.search === 'string' && initialParams.search.trim()
        ? initialParams.search.trim()
        : undefined;

    const allowedSortFields: SupplierQueryParams['sortBy'][] = [
      'name',
      'createdAt',
      'updatedAt',
    ];

    const safeSortBy = allowedSortFields.includes(
      initialParams.sortBy as SupplierQueryParams['sortBy']
    )
      ? (initialParams.sortBy as SupplierQueryParams['sortBy'])
      : 'createdAt';

    return {
      page: initialParams.page ?? 1,
      limit: initialParams.limit ?? 20,
      search: normalizedSearch,
      status: initialParams.status,
      sortBy: safeSortBy,
      sortOrder: initialParams.sortOrder === 'asc' ? 'asc' : 'desc',
    } satisfies SupplierQueryParams;
  }, [initialParams]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: supplierQueryKeys.list(queryParams),
    queryFn: () => getSuppliers(queryParams),
  });

  const suppliers = data?.data ?? [];
  const pagination = data?.pagination;

  // 删除供应商
  const deleteMutation = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: data => {
      toast({
        title: '删除成功',
        description: data.message || '供应商删除成功',
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: supplierQueryKeys.lists() });
      setDeleteDialogOpen(false);
      setSupplierToDelete(null);
    },
    onError: error => {
      toast({
        title: '删除失败',
        description: error.message || '删除供应商失败',
        variant: 'destructive',
      });
    },
  });

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearch(value);
    startTransition(() => {
      const params = new URLSearchParams();
      if (value) {
        params.set('search', value);
      }
      if (status) {
        params.set('status', status);
      }
      router.push(`/suppliers?${params.toString()}`);
    });
  };

  // 处理状态筛选
  const handleStatusChange = (value: 'active' | 'inactive' | undefined) => {
    setStatus(value);
    startTransition(() => {
      const params = new URLSearchParams();
      if (search) {
        params.set('search', search);
      }
      if (value) {
        params.set('status', value);
      }
      router.push(`/suppliers?${params.toString()}`);
    });
  };

  // 处理分页
  const handlePageChange = (page: number) => {
    startTransition(() => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      if (search) {
        params.set('search', search);
      }
      if (status) {
        params.set('status', status);
      }
      router.push(`/suppliers?${params.toString()}`);
    });
  };

  // 处理删除
  const handleDelete = (supplier: Supplier) => {
    setSupplierToDelete(supplier);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        {/* 页面标题 */}
        <SupplierPageHeader />

        {/* 搜索和筛选 */}
        <SupplierSearchFilters
          searchValue={search}
          statusFilter={status}
          onSearchChange={handleSearch}
          onStatusChange={handleStatusChange}
        />

        {isError && (
          <div className="border-destructive/50 bg-destructive/5 text-destructive rounded border px-4 py-3 text-sm">
            加载供应商数据失败：
            {error instanceof Error ? error.message : '发生未知错误'}
          </div>
        )}

        {/* 供应商列表表格 */}
        <div className="rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>供应商名称</TableHead>
                <TableHead>联系电话</TableHead>
                <TableHead>地址</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="w-20">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm">
                    正在加载供应商数据...
                  </TableCell>
                </TableRow>
              ) : suppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-8">
                    <EmptyState title="暂无供应商数据" compact />
                  </TableCell>
                </TableRow>
              ) : (
                suppliers.map(supplier => (
                  <TableRow
                    key={supplier.id}
                    className="cursor-pointer transition-colors hover:bg-[hsl(var(--color-primary-light))]"
                    onClick={() => router.push(`/suppliers/${supplier.id}`)}
                  >
                    <TableCell className="font-medium text-[hsl(var(--color-text-primary))]">
                      {supplier.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {supplier.phone || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {supplier.address || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={getCommonStatusBadgeVariant(supplier.status)}
                      >
                        {formatSupplierStatus(supplier.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(supplier.createdAt).toLocaleDateString('zh-CN')}
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/suppliers/${supplier.id}/edit`}>
                              <Edit className="mr-2 h-4 w-4" />
                              编辑
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(supplier)}
                            className="text-[hsl(var(--color-error))]"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* 分页组件 */}
          {pagination && pagination.total > 0 && (
            <div className="border-t border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-tertiary))] px-4 py-3">
              <Pagination
                pagination={pagination}
                onPageChange={handlePageChange}
                showRange
                showTotal
              />
            </div>
          )}
        </div>
      </div>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除供应商 &quot;{supplierToDelete?.name}&quot;
              吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (supplierToDelete) {
                  deleteMutation.mutate(supplierToDelete.id);
                }
              }}
              disabled={deleteMutation.isPending}
              className="bg-[hsl(var(--color-error))] hover:bg-[hsl(var(--color-error-hover))] focus-visible:ring-[hsl(var(--color-error))]"
            >
              {deleteMutation.isPending ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
