'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Edit,
  Eye,
  FolderTree,
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { MobileDataTable } from '@/components/ui/mobile-data-table';
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

// API and Types
import { getCategories } from '@/lib/api/categories';
import {
  batchDeleteProducts,
  deleteProduct,
  getProducts,
  productQueryKeys,
} from '@/lib/api/products';
import type { Product, ProductQueryParams } from '@/lib/types/product';
import {
  PRODUCT_STATUS_LABELS,
  PRODUCT_UNIT_LABELS,
  PRODUCT_UNIT_OPTIONS,
} from '@/lib/types/product';

/**
 * 产品管理页面
 * 严格遵循全栈项目统一约定规范
 */
function ProductsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [queryParams, setQueryParams] = React.useState<ProductQueryParams>({
    page: 1,
    limit: 10,
    search: '',
    status: undefined,
    unit: undefined,
    categoryId: undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  // 删除确认对话框状态
  const [deleteDialog, setDeleteDialog] = React.useState<{
    open: boolean;
    productId: string | null;
    productName: string;
  }>({
    open: false,
    productId: null,
    productName: '',
  });

  // 批量选择状态
  const [selectedProductIds, setSelectedProductIds] = React.useState<string[]>(
    []
  );

  // 批量删除确认对话框状态
  const [batchDeleteDialog, setBatchDeleteDialog] = React.useState<{
    open: boolean;
    products: Product[];
  }>({
    open: false,
    products: [],
  });

  // 获取分类列表
  const { data: categoriesResponse, isLoading: isLoadingCategories } = useQuery(
    {
      queryKey: ['categories'],
      queryFn: () => getCategories(),
    }
  );

  const categories = categoriesResponse?.data || [];

  // 获取产品列表数据
  const { data, isLoading, error } = useQuery({
    queryKey: productQueryKeys.list(queryParams),
    queryFn: () => getProducts(queryParams),
  });

  // 批量删除mutation
  const batchDeleteMutation = useMutation({
    mutationFn: batchDeleteProducts,
    onSuccess: result => {
      toast({
        title: result.success ? '批量删除完成' : '批量删除部分失败',
        description: result.message,
        variant: result.success ? 'success' : 'destructive',
      });

      // 如果有失败的产品，显示详细信息
      if (result.failedProducts && result.failedProducts.length > 0) {
        const failedList = result.failedProducts
          .map(p => `${p.name}: ${p.reason}`)
          .join('\n');

        setTimeout(() => {
          toast({
            title: '删除失败详情',
            description: failedList,
            variant: 'destructive',
          });
        }, 1000);
      }

      // 清空选择
      setSelectedProductIds([]);
      setBatchDeleteDialog({ open: false, products: [] });

      // 刷新数据
      queryClient.invalidateQueries({
        queryKey: productQueryKeys.list(queryParams),
      });
    },
    onError: error => {
      toast({
        title: '批量删除失败',
        description:
          error instanceof Error ? error.message : '批量删除时发生错误',
        variant: 'destructive',
      });
    },
  });

  // 搜索处理
  const handleSearch = (value: string) => {
    setQueryParams(prev => ({ ...prev, search: value, page: 1 }));
  };

  // 筛选处理
  const handleFilter = (key: keyof ProductQueryParams, value: any) => {
    setQueryParams(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  // 分页处理
  const handlePageChange = (page: number) => {
    setQueryParams(prev => ({ ...prev, page }));
  };

  // 删除产品处理
  const handleDeleteProduct = (productId: string, productName: string) => {
    setDeleteDialog({
      open: true,
      productId,
      productName,
    });
  };

  // 确认删除产品
  const confirmDeleteProduct = async () => {
    if (!deleteDialog.productId) return;

    try {
      // 调用删除API
      await deleteProduct(deleteDialog.productId);

      toast({
        title: '删除成功',
        description: `产品"${deleteDialog.productName}"已成功删除`,
        variant: 'success',
      });

      // 关闭对话框
      setDeleteDialog({ open: false, productId: null, productName: '' });

      // 刷新数据
      queryClient.invalidateQueries({
        queryKey: productQueryKeys.list(queryParams),
      });
    } catch (error) {
      toast({
        title: '删除失败',
        description:
          error instanceof Error ? error.message : '删除产品时发生错误',
        variant: 'destructive',
      });
    }
  };

  // 批量选择处理
  const handleSelectProduct = (productId: string, checked: boolean) => {
    setSelectedProductIds(prev => {
      if (checked) {
        return [...prev, productId];
      } else {
        return prev.filter(id => id !== productId);
      }
    });
  };

  // 全选/取消全选处理
  const handleSelectAll = (checked: boolean) => {
    if (checked && data?.data) {
      setSelectedProductIds(data.data.map(product => product.id));
    } else {
      setSelectedProductIds([]);
    }
  };

  // 批量删除处理
  const handleBatchDelete = () => {
    if (selectedProductIds.length === 0) return;

    const selectedProducts =
      data?.data?.filter(product => selectedProductIds.includes(product.id)) ||
      [];

    setBatchDeleteDialog({
      open: true,
      products: selectedProducts,
    });
  };

  // 确认批量删除
  const confirmBatchDelete = () => {
    if (selectedProductIds.length === 0) return;

    batchDeleteMutation.mutate({
      productIds: selectedProductIds,
    });
  };

  // 键盘快捷键处理
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+A 全选
      if (event.ctrlKey && event.key === 'a' && data?.data) {
        event.preventDefault();
        handleSelectAll(true);
      }
      // Delete 键删除选中项
      if (event.key === 'Delete' && selectedProductIds.length > 0) {
        event.preventDefault();
        handleBatchDelete();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [data?.data, selectedProductIds]);

  // 清空选择当数据变化时
  React.useEffect(() => {
    setSelectedProductIds([]);
  }, [queryParams]);

  // 状态标签渲染
  const getStatusBadge = (status: string) => {
    const variant = status === 'active' ? 'default' : 'secondary';
    return (
      <Badge variant={variant}>
        {PRODUCT_STATUS_LABELS[status as keyof typeof PRODUCT_STATUS_LABELS] ||
          status}
      </Badge>
    );
  };

  // 移动端表格列配置
  const mobileColumns = [
    { key: 'name', title: '产品名称', mobilePrimary: true },
    { key: 'code', title: '产品编码', mobileLabel: '编码' },
    {
      key: 'category',
      title: '分类',
      render: (item: Product) => (
        <Badge variant="outline">{item?.category?.name || '未分类'}</Badge>
      ),
    },
    {
      key: 'thickness',
      title: '厚度',
      render: (item: Product) =>
        item?.thickness ? `${item.thickness}mm` : '-',
    },
    {
      key: 'weight',
      title: '重量',
      render: (item: Product) => (item?.weight ? `${item.weight}kg` : '-'),
    },
    {
      key: 'status',
      title: '状态',
      render: (item: Product) => getStatusBadge(item?.status || 'active'),
    },
    {
      key: 'unit',
      title: '单位',
      render: (item: Product) =>
        PRODUCT_UNIT_LABELS[item.unit as keyof typeof PRODUCT_UNIT_LABELS] ||
        item.unit,
    },
  ];

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">产品管理</h1>
          <p className="text-muted-foreground">管理所有产品的基本信息和规格</p>
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

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">产品管理</h1>
          <p className="text-muted-foreground">
            管理所有产品的基本信息和规格
            {selectedProductIds.length > 0 && (
              <span className="ml-2 text-blue-600">
                已选择 {selectedProductIds.length} 个产品
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {selectedProductIds.length > 0 && (
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
                  批量删除 ({selectedProductIds.length})
                </>
              )}
            </Button>
          )}
          <Button variant="outline" onClick={() => router.push('/categories')}>
            <FolderTree className="mr-2 h-4 w-4" />
            分类管理
          </Button>
          <Button onClick={() => router.push('/products/create')}>
            <Plus className="mr-2 h-4 w-4" />
            新建产品
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
                  placeholder="搜索产品名称或编码..."
                  value={queryParams.search}
                  onChange={e => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select
                value={queryParams.categoryId || 'all'}
                onValueChange={value =>
                  handleFilter(
                    'categoryId',
                    value === 'all' ? undefined : value
                  )
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部分类</SelectItem>
                  <SelectItem value="none">未分类</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  <SelectItem value="inactive">停用</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={queryParams.unit || 'all'}
                onValueChange={value =>
                  handleFilter('unit', value === 'all' ? undefined : value)
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="单位" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部单位</SelectItem>
                  {PRODUCT_UNIT_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 产品列表 */}
      <Card>
        <CardHeader>
          <CardTitle>产品列表</CardTitle>
          <CardDescription>
            {isLoading || isLoadingCategories
              ? '加载中...'
              : data?.pagination
                ? `共 ${data.pagination.total} 个产品`
                : '暂无数据'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading || isLoadingCategories ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-4 w-[150px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* 桌面端表格 */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={
                            data?.data?.length > 0 &&
                            selectedProductIds.length === data.data.length
                          }
                          onCheckedChange={handleSelectAll}
                          aria-label="全选产品"
                        />
                      </TableHead>
                      <TableHead>产品编码</TableHead>
                      <TableHead>产品名称</TableHead>
                      <TableHead>规格</TableHead>
                      <TableHead>分类</TableHead>
                      <TableHead>厚度</TableHead>
                      <TableHead>重量</TableHead>
                      <TableHead>单位</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead className="w-[120px]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data?.map(product => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedProductIds.includes(product.id)}
                            onCheckedChange={checked =>
                              handleSelectProduct(
                                product.id,
                                checked as boolean
                              )
                            }
                            aria-label={`选择产品 ${product.name}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {product.code}
                        </TableCell>
                        <TableCell>{product.name}</TableCell>
                        <TableCell>{product.specification || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {product.category?.name || '未分类'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {product?.thickness ? `${product.thickness}mm` : '-'}
                        </TableCell>
                        <TableCell>
                          {product?.weight ? `${product.weight}kg` : '-'}
                        </TableCell>
                        <TableCell>
                          {PRODUCT_UNIT_LABELS[
                            product.unit as keyof typeof PRODUCT_UNIT_LABELS
                          ] || product.unit}
                        </TableCell>
                        <TableCell>{getStatusBadge(product.status)}</TableCell>
                        <TableCell>
                          {new Date(product.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(`/products/${product.id}`)
                                }
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                查看详情
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(`/products/${product.id}/edit`)
                                }
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                编辑
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() =>
                                  handleDeleteProduct(product.id, product.name)
                                }
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

              {/* 移动端卡片 */}
              <div className="md:hidden">
                <MobileDataTable
                  data={data?.data?.filter(Boolean) || []}
                  columns={mobileColumns}
                  onItemClick={item => router.push(`/products/${item?.id}`)}
                  renderActions={item => (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => router.push(`/products/${item.id}`)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          查看详情
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            router.push(`/products/${item.id}/edit`)
                          }
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() =>
                            handleDeleteProduct(item.id, item.name)
                          }
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                />
              </div>

              {/* 分页 */}
              {data?.pagination && data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <div className="text-sm text-muted-foreground">
                    显示第{' '}
                    {(data.pagination.page - 1) * data.pagination.limit + 1} -{' '}
                    {Math.min(
                      data.pagination.page * data.pagination.limit,
                      data.pagination.total
                    )}{' '}
                    条，共 {data.pagination.total} 条
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(data.pagination.page - 1)}
                      disabled={data.pagination.page <= 1}
                    >
                      上一页
                    </Button>
                    <div className="text-sm">
                      第 {data.pagination.page} / {data.pagination.totalPages}{' '}
                      页
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(data.pagination.page + 1)}
                      disabled={
                        data.pagination.page >= data.pagination.totalPages
                      }
                    >
                      下一页
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 删除确认对话框 */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={open => setDeleteDialog(prev => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除产品</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除产品 "{deleteDialog.productName}" 吗？
              <br />
              <span className="font-medium text-red-600">
                此操作不可撤销，删除后将无法恢复产品数据。
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteProduct}
              className="bg-red-600 hover:bg-red-700"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 批量删除确认对话框 */}
      <AlertDialog
        open={batchDeleteDialog.open}
        onOpenChange={open => setBatchDeleteDialog(prev => ({ ...prev, open }))}
      >
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量删除产品</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除以下 {batchDeleteDialog.products.length} 个产品吗？
              <br />
              <span className="font-medium text-red-600">
                此操作不可撤销，删除后将无法恢复产品数据。
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* 产品列表 */}
          <div className="max-h-60 overflow-y-auto">
            <div className="space-y-2">
              {batchDeleteDialog.products.map(product => (
                <div
                  key={product.id}
                  className="flex items-center justify-between rounded border p-2"
                >
                  <div>
                    <div className="font-medium">{product.name}</div>
                    <div className="text-sm text-muted-foreground">
                      编码: {product.code}
                      {product.category && (
                        <span className="ml-2">
                          分类: {product.category.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline">
                    {product.category?.name || '未分类'}
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
                `确认删除 ${batchDeleteDialog.products.length} 个产品`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default ProductsPage;
