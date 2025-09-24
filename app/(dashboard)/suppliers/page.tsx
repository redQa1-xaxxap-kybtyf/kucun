'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

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
import {
  batchDeleteSuppliers,
  batchUpdateSupplierStatus,
  deleteSupplier,
  getSuppliers,
  supplierQueryKeys,
} from '@/lib/api/suppliers';
import { formatSupplierStatus } from '@/lib/schemas/supplier';
import type { Supplier, SupplierQueryParams } from '@/lib/types/supplier';

export default function SuppliersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // 查询参数状态
  const [queryParams, setQueryParams] = useState<SupplierQueryParams>({
    page: 1,
    limit: 10,
    search: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  // 选中的供应商
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);

  // 删除确认对话框
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(
    null
  );

  // 批量删除确认对话框
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);

  // 获取供应商列表
  const { data, isLoading, error } = useQuery({
    queryKey: supplierQueryKeys.list(queryParams),
    queryFn: () => getSuppliers(queryParams),
  });

  // 删除供应商
  const deleteMutation = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: data => {
      toast.success(data.message || '供应商删除成功');
      queryClient.invalidateQueries({ queryKey: supplierQueryKeys.lists() });
      setDeleteDialogOpen(false);
      setSupplierToDelete(null);
    },
    onError: error => {
      toast.error(error.message || '删除供应商失败');
    },
  });

  // 批量删除供应商
  const batchDeleteMutation = useMutation({
    mutationFn: batchDeleteSuppliers,
    onSuccess: result => {
      toast.success(result.message);
      queryClient.invalidateQueries({ queryKey: supplierQueryKeys.lists() });
      setBatchDeleteDialogOpen(false);
      setSelectedSuppliers([]);
    },
    onError: error => {
      toast.error(error.message || '批量删除失败');
    },
  });

  // 批量更新状态
  const batchUpdateStatusMutation = useMutation({
    mutationFn: batchUpdateSupplierStatus,
    onSuccess: result => {
      toast.success(result.message);
      queryClient.invalidateQueries({ queryKey: supplierQueryKeys.lists() });
      setSelectedSuppliers([]);
    },
    onError: error => {
      toast.error(error.message || '批量更新状态失败');
    },
  });

  // 处理搜索
  const handleSearch = (value: string) => {
    setQueryParams(prev => ({ ...prev, search: value, page: 1 }));
  };

  // 处理状态筛选
  const handleStatusFilter = (status: string) => {
    setQueryParams(prev => ({
      ...prev,
      status: status === 'all' ? undefined : (status as 'active' | 'inactive'),
      page: 1,
    }));
  };

  // 处理分页
  const handlePageChange = (page: number) => {
    setQueryParams(prev => ({ ...prev, page }));
  };

  // 处理全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSuppliers(data?.data.map(s => s.id) || []);
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
  const handleDelete = (supplier: Supplier) => {
    setSupplierToDelete(supplier);
    setDeleteDialogOpen(true);
  };

  // 处理批量删除
  const handleBatchDelete = () => {
    setBatchDeleteDialogOpen(true);
  };

  // 处理批量状态更新
  const handleBatchStatusUpdate = (status: 'active' | 'inactive') => {
    batchUpdateStatusMutation.mutate({
      supplierIds: selectedSuppliers,
      status,
    });
  };

  const suppliers = data?.data || [];
  const pagination = data?.pagination;
  const isAllSelected =
    selectedSuppliers.length === suppliers.length && suppliers.length > 0;
  const isPartialSelected =
    selectedSuppliers.length > 0 && selectedSuppliers.length < suppliers.length;

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center text-red-600">
          加载供应商列表失败: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">供应商管理</h1>
          <p className="text-muted-foreground">管理供应商信息</p>
        </div>
        <Button asChild>
          <Link href="/suppliers/create">
            <Plus className="mr-2 h-4 w-4" />
            新建供应商
          </Link>
        </Button>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索供应商名称或电话..."
                  value={queryParams.search || ''}
                  onChange={e => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select
                value={queryParams.status || 'all'}
                onValueChange={handleStatusFilter}
              >
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
              <span className="text-sm text-muted-foreground">
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
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : suppliers.length === 0 ? (
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
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                共 {pagination.total} 条记录，第 {pagination.page} /{' '}
                {pagination.totalPages} 页
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
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
              确定要删除供应商 "{supplierToDelete?.name}" 吗？此操作无法撤销。
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
