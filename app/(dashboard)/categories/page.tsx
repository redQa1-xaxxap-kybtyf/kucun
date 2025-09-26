'use client';

/**
 * 分类管理页面
 * 严格遵循全栈项目统一约定规范
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Edit,
  Eye,
  EyeOff,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import React from 'react';

// UI Components
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
import {
  batchDeleteCategories,
  deleteCategory,
  getCategories,
  updateCategoryStatus,
  type Category,
  type CategoryQueryParams,
} from '@/lib/api/categories';
import { formatDateTimeCN } from '@/lib/utils/datetime';

/**
 * 分类管理页面组件
 */
function CategoriesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [queryParams, setQueryParams] = React.useState<CategoryQueryParams>({
    page: 1,
    limit: 10,
    search: '',
    status: undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  // 批量选择状态
  const [selectedCategoryIds, setSelectedCategoryIds] = React.useState<
    string[]
  >([]);

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

  // 批量删除确认对话框状态
  const [batchDeleteDialog, setBatchDeleteDialog] = React.useState<{
    open: boolean;
    categories: Category[];
  }>({
    open: false,
    categories: [],
  });

  // 状态更新加载状态
  const [updatingStatusId, setUpdatingStatusId] = React.useState<string | null>(
    null
  );

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
    onError: error => {
      const errorMessage =
        error instanceof Error ? error.message : '删除操作失败';
      toast({
        title: '删除失败',
        description: `删除失败：${errorMessage}。请检查该分类是否还有关联的产品或子分类。`,
        variant: 'destructive',
      });

      // 删除失败时也关闭对话框
      setDeleteDialog({ open: false, categoryId: null, categoryName: '' });
    },
  });

  // 批量删除mutation
  const batchDeleteMutation = useMutation({
    mutationFn: batchDeleteCategories,
    onSuccess: result => {
      toast({
        title: result.success ? '批量删除完成' : '批量删除部分失败',
        description: result.message,
        variant: result.success ? 'success' : 'destructive',
      });

      // 显示失败详情
      if (result.failedCategories && result.failedCategories.length > 0) {
        setTimeout(() => {
          result.failedCategories?.forEach(failed => {
            toast({
              title: `分类"${failed.name}"删除失败`,
              description: failed.reason,
              variant: 'destructive',
            });
          });
        }, 1000);
      }

      // 清空选择
      setSelectedCategoryIds([]);
      setBatchDeleteDialog({ open: false, categories: [] });

      // 刷新数据
      queryClient.invalidateQueries({
        queryKey: ['categories'],
      });
    },
    onError: error => {
      const errorMessage =
        error instanceof Error ? error.message : '批量删除操作失败';
      toast({
        title: '批量删除失败',
        description: `批量删除失败：${errorMessage}`,
        variant: 'destructive',
      });

      // 删除失败时也关闭对话框
      setBatchDeleteDialog({ open: false, categories: [] });
    },
  });

  // 更新分类状态Mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: 'active' | 'inactive';
    }) => updateCategoryStatus(id, status),
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
          description: `分类 "${data.data?.name || '未知分类'}" 已成功${statusText}！`,
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
  const handleFilter = <K extends keyof CategoryQueryParams>(
    key: K,
    value: CategoryQueryParams[K]
  ) => {
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

  // 批量选择处理
  const handleSelectCategory = (categoryId: string, checked: boolean) => {
    setSelectedCategoryIds(prev => {
      if (checked) {
        return [...prev, categoryId];
      } else {
        return prev.filter(id => id !== categoryId);
      }
    });
  };

  // 全选/取消全选处理
  const handleSelectAll = (checked: boolean) => {
    if (checked && data?.data) {
      setSelectedCategoryIds(data.data.map(category => category.id));
    } else {
      setSelectedCategoryIds([]);
    }
  };

  // 批量删除处理
  const handleBatchDelete = () => {
    if (selectedCategoryIds.length === 0) return;

    const selectedCategories =
      data?.data?.filter(category =>
        selectedCategoryIds.includes(category.id)
      ) || [];

    setBatchDeleteDialog({
      open: true,
      categories: selectedCategories,
    });
  };

  // 确认批量删除
  const confirmBatchDelete = () => {
    if (selectedCategoryIds.length === 0) return;

    batchDeleteMutation.mutate({
      categoryIds: selectedCategoryIds,
    });
  };

  // 键盘快捷键处理
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+A 全选
      if (event.ctrlKey && event.key === 'a') {
        event.preventDefault();
        handleSelectAll(true);
      }
      // Delete 键删除选中项
      if (event.key === 'Delete' && selectedCategoryIds.length > 0) {
        event.preventDefault();
        handleBatchDelete();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedCategoryIds, data?.data]);

  // 切换分类状态
  const toggleCategoryStatus = (category: Category) => {
    const newStatus = category.status === 'active' ? 'inactive' : 'active';
    updateStatusMutation.mutate({ id: category.id, status: newStatus });
  };

  // 格式化日期 - 使用统一的时间格式化函数
  const formatDate = (dateString: string) => formatDateTimeCN(dateString);

  // 加载状态
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="mt-2 h-4 w-48" />
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
          <p className="text-muted-foreground">
            管理产品分类和层级结构
            {selectedCategoryIds.length > 0 && (
              <span className="ml-2 text-blue-600">
                已选择 {selectedCategoryIds.length} 个分类
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {selectedCategoryIds.length > 0 && (
            <Button
              variant="destructive"
              onClick={handleBatchDelete}
              disabled={batchDeleteMutation.isPending}
            >
              {batchDeleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  删除中...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  批量删除 ({selectedCategoryIds.length})
                </>
              )}
            </Button>
          )}
          <Button onClick={() => router.push('/categories/create')}>
            <Plus className="mr-2 h-4 w-4" />
            新建分类
          </Button>
        </div>
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
                onValueChange={value => {
                  const statusValue =
                    value === 'all'
                      ? undefined
                      : (value as 'active' | 'inactive');
                  handleFilter('status', statusValue);
                }}
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
            <div className="py-8 text-center text-muted-foreground">
              暂无分类数据
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          (data?.data?.length ?? 0) > 0 &&
                          selectedCategoryIds.length ===
                            (data?.data?.length ?? 0)
                        }
                        onCheckedChange={handleSelectAll}
                        aria-label="全选分类"
                      />
                    </TableHead>
                    <TableHead>分类名称</TableHead>
                    <TableHead>产品数量</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map(category => (
                    <TableRow key={category.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedCategoryIds.includes(category.id)}
                          onCheckedChange={checked =>
                            handleSelectCategory(
                              category.id,
                              checked as boolean
                            )
                          }
                          aria-label={`选择分类 ${category.name}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {category.name}
                      </TableCell>
                      <TableCell>{category.productCount || 0}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            category.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {category.status === 'active' ? '启用' : '禁用'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(category.createdAt)}
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
                              onClick={() =>
                                router.push(`/categories/${category.id}/edit`)
                              }
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
                                  {category.status === 'active'
                                    ? '禁用中...'
                                    : '启用中...'}
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
                              onClick={() =>
                                handleDeleteCategory(category.id, category.name)
                              }
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
                显示第 {(pagination.page - 1) * pagination.limit + 1} -{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)}{' '}
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
      <Dialog
        open={deleteDialog.open}
        onOpenChange={open => setDeleteDialog(prev => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除分类</DialogTitle>
            <DialogDescription>
              您确定要删除分类{' '}
              <strong>&quot;{deleteDialog.categoryName}&quot;</strong> 吗？
              <br />
              <span className="font-medium text-red-600">
                注意：此操作不可撤销，删除后该分类下的所有子分类和产品关联也将被清除。
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setDeleteDialog(prev => ({ ...prev, open: false }))
              }
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

      {/* 批量删除确认对话框 */}
      <AlertDialog
        open={batchDeleteDialog.open}
        onOpenChange={open => setBatchDeleteDialog(prev => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量删除分类</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除以下 {batchDeleteDialog.categories.length} 个分类吗？
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="max-h-60 overflow-y-auto">
            <div className="space-y-2">
              {batchDeleteDialog.categories.map(category => (
                <div
                  key={category.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <div className="font-medium">{category.name}</div>
                    <div className="text-sm text-muted-foreground">
                      产品数量: {category.productCount || 0}
                    </div>
                  </div>
                  <Badge
                    variant={
                      category.status === 'active' ? 'default' : 'secondary'
                    }
                  >
                    {category.status === 'active' ? '启用' : '禁用'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBatchDelete}
              disabled={batchDeleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {batchDeleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  删除中...
                </>
              ) : (
                `确认删除 ${batchDeleteDialog.categories.length} 个分类`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default CategoriesPage;
