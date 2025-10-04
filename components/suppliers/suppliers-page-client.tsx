'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit, MoreHorizontal, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  batchUpdateSupplierStatus,
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

/**
 * 供应商管理页面客户端组件
 * 职责：处理用户交互、状态管理、TanStack Query 数据管理
 */
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
  const [status, setStatus] = useState<string>(initialParams.status || 'all');
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
      // 刷新服务器组件数据
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

  // 批量更新状态
  const batchUpdateStatusMutation = useMutation({
    mutationFn: batchUpdateSupplierStatus,
    onSuccess: result => {
      toast({
        title: '更新成功',
        description: result.message,
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: supplierQueryKeys.lists() });
      setSelectedSuppliers([]);
      router.refresh();
    },
    onError: error => {
      toast({
        title: '更新失败',
        description: error.message || '批量更新状态失败',
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
      if (status !== 'all') {
        params.set('status', status);
      }
      router.push(`/suppliers?${params.toString()}`);
    });
  };

  // 处理状态筛选
  const handleStatusFilter = (value: string) => {
    setStatus(value);
    startTransition(() => {
      const params = new URLSearchParams();
      if (search) {
        params.set('search', search);
      }
      if (value !== 'all') {
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
      if (status !== 'all') {
        params.set('status', status);
      }
      router.push(`/suppliers?${params.toString()}`);
    });
  };

  // 处理全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSuppliers(suppliers.map(s => s.id));
    } else {
      setSelectedSuppliers([]);
    }
  };

  // 处理单选
  const handleSelectSupplier = (supplierId: string, checked: boolean) => {
    if (checked) {
      setSelectedSuppliers(prev => [...prev, supplierId]);
    } else {
      setSelectedSuppliers(prev => prev.filter(id => id !== supplierId));
    }
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

  // 处理批量状态更新
  const handleBatchStatusUpdate = (statusValue: 'active' | 'inactive') => {
    batchUpdateStatusMutation.mutate({
      supplierIds: selectedSuppliers,
      status: statusValue,
    });
  };

  const isAllSelected =
    selectedSuppliers.length === suppliers.length && suppliers.length > 0;

  return (
    <div className="space-y-4">
      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder="搜索供应商名称或电话..."
                  value={search}
                  onChange={e => handleSearch(e.target.value)}
                  className="pl-10"
                  disabled={isPending}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={status} onValueChange={handleStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="active">活跃</SelectItem>
                  <SelectItem value="inactive">停用</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 批量操作 */}
      {selectedSuppliers.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground text-sm">
                已选择 {selectedSuppliers.length} 个供应商
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBatchStatusUpdate('active')}
                  disabled={batchUpdateStatusMutation.isPending}
                >
                  批量启用
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBatchStatusUpdate('inactive')}
                  disabled={batchUpdateStatusMutation.isPending}
                >
                  批量停用
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBatchDelete}
                  disabled={batchDeleteMutation.isPending}
                >
                  批量删除
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 供应商列表 */}
      <Card>
        <CardHeader>
          <CardTitle>供应商列表</CardTitle>
        </CardHeader>
        <CardContent>
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
                  <TableCell colSpan={7} className="py-8 text-center">
                    暂无供应商数据
                  </TableCell>
                </TableRow>
              ) : (
                suppliers.map(supplier => (
                  <TableRow key={supplier.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedSuppliers.includes(supplier.id)}
                        onCheckedChange={checked =>
                          handleSelectSupplier(supplier.id, checked as boolean)
                        }
                        aria-label={`选择 ${supplier.name}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {supplier.name}
                    </TableCell>
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

          {/* 分页 */}
          {pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-muted-foreground text-sm">
                共 {pagination.total} 条记录，第 {pagination.page} /{' '}
                {pagination.totalPages} 页
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1 || isPending}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={
                    pagination.page >= pagination.totalPages || isPending
                  }
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
