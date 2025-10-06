'use client';

/**
 * 供应商管理页面客户端组件
 * 严格遵循全栈项目统一约定规范
 * 职责：处理用户交互、状态管理、TanStack Query 数据管理
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit, MoreHorizontal, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

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
import { Checkbox } from '@/components/ui/checkbox';
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
  batchDeleteSuppliers,
  deleteSupplier,
  supplierQueryKeys,
} from '@/lib/api/suppliers';
import type {
  SupplierItem,
  SupplierListResult,
} from '@/lib/services/supplier-service';
import { formatSupplierStatus } from '@/lib/utils/supplier-utils';

interface SuppliersPageClientProps {
  initialData: SupplierListResult;
  initialParams: {
    page: number;
    limit: number;
    search: string;
    status?: 'active' | 'inactive';
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  };
}

export function SuppliersPageClient({
  initialData,
  initialParams,
}: SuppliersPageClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // 本地状态
  const [search, setSearch] = useState(initialParams.search);
  const [status, setStatus] = useState<'active' | 'inactive' | undefined>(
    initialParams.status
  );
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<SupplierItem | null>(
    null
  );
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);

  // 使用服务器传递的初始数据
  const { suppliers, pagination } = initialData;

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
      setSelectedSuppliers([]);
      router.refresh();
    },
    onError: error => {
      toast({
        title: '删除失败',
        description: error.message || '删除供应商失败',
        variant: 'destructive',
      });
    },
  });

  // 批量删除供应商
  const batchDeleteMutation = useMutation({
    mutationFn: batchDeleteSuppliers,
    onSuccess: result => {
      toast({
        title: '批量删除成功',
        description: result.message,
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: supplierQueryKeys.lists() });
      setBatchDeleteDialogOpen(false);
      setSelectedSuppliers([]);
      router.refresh();
    },
    onError: error => {
      toast({
        title: '批量删除失败',
        description: error.message || '批量删除失败',
        variant: 'destructive',
      });
    },
  });

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearch(value);
    startTransition(() => {
      const params = new URLSearchParams();
      if (value) params.set('search', value);
      if (status) params.set('status', status);
      router.push(`/suppliers?${params.toString()}`);
    });
  };

  // 处理状态筛选
  const handleStatusChange = (value: 'active' | 'inactive' | undefined) => {
    setStatus(value);
    startTransition(() => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (value) params.set('status', value);
      router.push(`/suppliers?${params.toString()}`);
    });
  };

  // 处理分页
  const handlePageChange = (page: number) => {
    startTransition(() => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      router.push(`/suppliers?${params.toString()}`);
    });
  };

  // 处理全选
  const handleSelectAll = (checked: boolean) => {
    setSelectedSuppliers(checked ? suppliers.map(s => s.id) : []);
  };

  // 处理单选
  const handleSelectSupplier = (supplierId: string, checked: boolean) => {
    setSelectedSuppliers(prev =>
      checked ? [...prev, supplierId] : prev.filter(id => id !== supplierId)
    );
  };

  // 处理删除
  const handleDelete = (supplier: SupplierItem) => {
    setSupplierToDelete(supplier);
    setDeleteDialogOpen(true);
  };

  // 处理批量删除
  const handleBatchDelete = () => {
    setBatchDeleteDialogOpen(true);
  };

  const isAllSelected =
    selectedSuppliers.length === suppliers.length && suppliers.length > 0;

  return (
    <div className="space-y-4">
      {/* 页面标题 */}
      <SupplierPageHeader
        selectedSupplierIds={selectedSuppliers}
        onBatchDelete={handleBatchDelete}
        isBatchDeleting={batchDeleteMutation.isPending}
      />

      {/* 搜索和筛选 */}
      <SupplierSearchFilters
        searchValue={search}
        statusFilter={status}
        onSearchChange={handleSearch}
        onStatusChange={handleStatusChange}
      />

      {/* 供应商列表表格 */}
      <div className="overflow-hidden rounded-lg border bg-white shadow-lg shadow-gray-200/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="全选"
                />
              </TableHead>
              <TableHead>供应商名称</TableHead>
              <TableHead>联系电话</TableHead>
              <TableHead>地址</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="w-20">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-gray-500"
                >
                  暂无供应商数据
                </TableCell>
              </TableRow>
            ) : (
              suppliers.map(supplier => (
                <TableRow key={supplier.id} className="hover:bg-blue-50/50">
                  <TableCell>
                    <Checkbox
                      checked={selectedSuppliers.includes(supplier.id)}
                      onCheckedChange={checked =>
                        handleSelectSupplier(supplier.id, checked as boolean)
                      }
                      aria-label={`选择 ${supplier.name}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell>{supplier.phone || '-'}</TableCell>
                  <TableCell>{supplier.address || '-'}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        supplier.status === 'active' ? 'default' : 'secondary'
                      }
                    >
                      {formatSupplierStatus(supplier.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(supplier.createdAt).toLocaleDateString('zh-CN')}
                  </TableCell>
                  <TableCell>
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
                          className="text-red-600"
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
        <div className="border-t bg-gray-50/50 px-4 py-3">
          <Pagination
            pagination={pagination}
            onPageChange={handlePageChange}
            showRange
            showTotal
          />
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
            >
              {deleteMutation.isPending ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 批量删除确认对话框 */}
      <AlertDialog
        open={batchDeleteDialogOpen}
        onOpenChange={setBatchDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除选中的 {selectedSuppliers.length}{' '}
              个供应商吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                batchDeleteMutation.mutate({ supplierIds: selectedSuppliers });
              }}
              disabled={batchDeleteMutation.isPending}
            >
              {batchDeleteMutation.isPending ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
