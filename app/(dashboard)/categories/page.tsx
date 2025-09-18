'use client';

/**
 * 分类管理页面
 * 严格遵循全栈项目统一约定规范
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, Eye, EyeOff, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React from 'react';

// UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { formatDateTime } from '@/lib/utils';

// API and Types
import type { Category, CategoryQueryParams } from '@/lib/api/categories';
import { deleteCategory, getCategories, updateCategoryStatus } from '@/lib/api/categories';

/**
 * 分类管理页面组件
 */
function CategoriesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [queryParams, setQueryParams] = React.useState<CategoryQueryParams>({
    page: 1,
    limit: 20,
    search: '',
    status: undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  // 删除确认对话框状态
  const [deleteDialog, setDeleteDialog] = React.useState<{
    open: boolean;
    categoryId: string | null;
    categoryName: string;
  }>({
    open: false,
    categoryId: null,
    categoryName: '',
  });

  // 状态更新加载状态
  const [updatingStatusId, setUpdatingStatusId] = React.useState<string | null>(null);

  // 获取分类列表数据
  const { data, isLoading, error } = useQuery({
    queryKey: ['categories', queryParams],
    queryFn: () => getCategories(queryParams),
  });

  // 删除分类Mutation
  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      // 先关闭对话框，再显示成功提示
      setDeleteDialog({ open: false, categoryId: null, categoryName: '' });

      // 延迟显示成功提示，确保对话框已关闭
      setTimeout(() => {
        toast({
          title: '删除成功',
          description: '分类删除成功！相关数据已清理完毕。',
          variant: 'success',
        });
      }, 100);

      // 刷新数据
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : '删除操作失败';
      toast({
        title: '删除失败',
        description: `删除失败：${errorMessage}。请检查该分类是否还有关联的产品或子分类。`,
        variant: 'destructive',
      });

      // 删除失败时也关闭对话框
      setDeleteDialog({ open: false, categoryId: null, categoryName: '' });
    },
  });

  // 更新分类状态Mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'inactive' }) =>
      updateCategoryStatus(id, status),
    onMutate: ({ id }) => {
      // 设置加载状态
      setUpdatingStatusId(id);
    },
    onSuccess: (data, variables) => {
      const statusText = variables.status === 'active' ? '启用' : '禁用';

      // 清除加载状态
      setUpdatingStatusId(null);

      // 先刷新数据，确保UI立即更新
      queryClient.invalidateQueries({ queryKey: ['categories'] });

      // 延迟显示成功提示，让用户看到状态变化
      setTimeout(() => {
        toast({
          title: '状态更新成功',
          description: `分类 "${data.data?.name || '未知'}" 已成功${statusText}！`,
          variant: 'success',
        });
      }, 200);
    },
    onError: (error, variables) => {
      // 清除加载状态
      setUpdatingStatusId(null);

      const statusText = variables.status === 'active' ? '启用' : '禁用';
      const errorMessage = error instanceof Error ? error.message : '操作失败';
      toast({
        title: '状态更新失败',
        description: `${statusText}分类失败：${errorMessage}。请稍后重试。`,
        variant: 'destructive',
      });
    },
  });

  // 搜索处理
  const handleSearch = (value: string) => {
    setQueryParams(prev => ({ ...prev, search: value, page: 1 }));
  };

  // 筛选处理
  const handleFilter = (key: keyof CategoryQueryParams, value: any) => {
    setQueryParams(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  // 分页处理
  const handlePageChange = (page: number) => {
    setQueryParams(prev => ({ ...prev, page }));
  };

  // 删除分类处理
  const handleDeleteCategory = (categoryId: string, categoryName: string) => {
    setDeleteDialog({
      open: true,
      categoryId,
      categoryName,
    });
  };

  // 确认删除
  const confirmDelete = () => {
    if (deleteDialog.categoryId) {
      deleteMutation.mutate(deleteDialog.categoryId);
    }
  };

  // 切换分类状态
  const toggleCategoryStatus = (category: Category) => {
    const newStatus = category.status === 'active' ? 'inactive' : 'active';
    updateStatusMutation.mutate({ id: category.id, status: newStatus });
  };

  // 使用统一的日期格式化函数

  // 加载状态
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-48 mt-2" />
          </div>
          <Skeleton className="h-10 w-24" />
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">分类管理</h1>
          <p className="text-muted-foreground">管理产品分类和层级结构</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              加载失败: {error instanceof Error ? error.message : '未知错误'}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const categories = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">分类管理</h1>
          <p className="text-muted-foreground">管理产品分类和层级结构</p>
        </div>
        <Button onClick={() => router.push('/categories/create')}>
          <Plus className="mr-2 h-4 w-4" />
          新建分类
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
                  placeholder="搜索分类名称..."
                  value={queryParams.search}
                  onChange={e => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select
                value={queryParams.status || 'all'}
                onValueChange={value =>
                  handleFilter('status', value === 'all' ? undefined : value)
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="active">启用</SelectItem>
                  <SelectItem value="inactive">禁用</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 分类列表 */}
      <Card>
        <CardHeader>
          <CardTitle>分类列表</CardTitle>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无分类数据
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>分类名称</TableHead>
                    <TableHead>产品数量</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">
                        {category.name}
                      </TableCell>
                      <TableCell>
                        {category.productCount || 0}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            category.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {category.status === 'active' ? '启用' : '禁用'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(category.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => router.push(`/categories/${category.id}/edit`)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => toggleCategoryStatus(category)}
                              disabled={updatingStatusId === category.id}
                            >
                              {updatingStatusId === category.id ? (
                                <>
                                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                                  {category.status === 'active' ? '禁用中...' : '启用中...'}
                                </>
                              ) : category.status === 'active' ? (
                                <>
                                  <EyeOff className="mr-2 h-4 w-4" />
                                  禁用
                                </>
                              ) : (
                                <>
                                  <Eye className="mr-2 h-4 w-4" />
                                  启用
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteCategory(category.id, category.name)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 分页 */}
      {pagination && pagination.totalPages > 1 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                显示第{' '}
                {(pagination.page - 1) * pagination.limit + 1} -{' '}
                {Math.min(
                  pagination.page * pagination.limit,
                  pagination.total
                )}{' '}
                条，共 {pagination.total} 条
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page - 1)}
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
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  下一页
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) =>
        setDeleteDialog(prev => ({ ...prev, open }))
      }>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除分类</DialogTitle>
            <DialogDescription>
              您确定要删除分类 <strong>"{deleteDialog.categoryName}"</strong> 吗？
              <br />
              <span className="text-red-600 font-medium">
                注意：此操作不可撤销，删除后该分类下的所有子分类和产品关联也将被清除。
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog(prev => ({ ...prev, open: false }))}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className={deleteMutation.isPending ? 'cursor-not-allowed' : ''}
            >
              {deleteMutation.isPending ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  正在删除...
                </>
              ) : (
                '确认删除'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CategoriesPage;
