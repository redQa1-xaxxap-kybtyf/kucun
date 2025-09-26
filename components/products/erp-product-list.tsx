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
import { categoryQueryKeys, getCategories } from '@/lib/api/categories';
import {
  batchDeleteProducts,
  deleteProduct,
  getProducts,
  productQueryKeys,
} from '@/lib/api/products';
import {
  PRODUCT_STATUS_LABELS,
  PRODUCT_UNIT_LABELS,
  type Product,
  type ProductQueryParams,
} from '@/lib/types/product';

interface ERPProductListProps {
  onProductSelect?: (productId: string) => void;
}

/**
 * ERP风格产品管理列表组件
 * 符合中国ERP系统的界面标准和用户习惯
 */
export function ERPProductList({ onProductSelect }: ERPProductListProps) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [queryParams, setQueryParams] = React.useState<ProductQueryParams>({
    page: 1,
    limit: 50, // ERP标准：更多记录显示
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
      queryKey: categoryQueryKeys.lists(),
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
  const handleFilter = (
    key: keyof ProductQueryParams,
    value: string | number | boolean
  ) => {
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
    if (checked && Array.isArray(data?.data)) {
      setSelectedProductIds(data.data.map(product => product.id));
    } else {
      setSelectedProductIds([]);
    }
  };

  // 批量删除处理
  const handleBatchDelete = () => {
    if (selectedProductIds.length === 0) return;

    const selectedProducts = Array.isArray(data?.data)
      ? data.data.filter(product => selectedProductIds.includes(product.id))
      : [];

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

  // 状态标签渲染
  const getStatusBadge = (status: string) => {
    const variant = status === 'active' ? 'default' : 'secondary';
    return (
      <Badge variant={variant} className="text-xs">
        {PRODUCT_STATUS_LABELS[status as keyof typeof PRODUCT_STATUS_LABELS] ||
          status}
      </Badge>
    );
  };

  if (error) {
    return (
      <div className="rounded border bg-card">
        <div className="border-b bg-muted/30 px-3 py-2">
          <h3 className="text-sm font-medium text-red-600">加载失败</h3>
        </div>
        <div className="p-3">
          <div className="text-center text-sm text-red-600">
            {error instanceof Error ? error.message : '未知错误'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ERP标准工具栏 */}
      <div className="rounded border bg-card">
        <div className="border-b bg-muted/30 px-3 py-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">产品管理</h3>
            <div className="text-xs text-muted-foreground">
              {data?.pagination ? `共 ${data.pagination.total} 条记录` : ''}
              {selectedProductIds.length > 0 && (
                <span className="ml-2 text-blue-600">
                  已选择 {selectedProductIds.length} 个产品
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="p-3">
          <div className="flex items-center gap-2">
            {/* 操作按钮 */}
            <Button
              size="sm"
              className="h-7"
              onClick={() => router.push('/products/create')}
            >
              <Plus className="mr-1 h-3 w-3" />
              新建
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() => router.push('/categories')}
            >
              <FolderTree className="mr-1 h-3 w-3" />
              分类管理
            </Button>
            {selectedProductIds.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="h-7"
                onClick={handleBatchDelete}
                disabled={batchDeleteMutation.isPending}
              >
                {batchDeleteMutation.isPending ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    删除中...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-1 h-3 w-3" />
                    批量删除 ({selectedProductIds.length})
                  </>
                )}
              </Button>
            )}

            <div className="flex-1" />

            {/* 搜索和筛选 */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="产品名称/编码"
                  value={queryParams.search}
                  onChange={e => handleSearch(e.target.value)}
                  className="h-7 w-40 pl-7 text-xs"
                />
              </div>
              <Select
                value={queryParams.categoryId || 'all'}
                onValueChange={value =>
                  handleFilter(
                    'categoryId',
                    value === 'all' ? undefined : value
                  )
                }
              >
                <SelectTrigger className="h-7 w-24 text-xs">
                  <SelectValue placeholder="分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
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
                <SelectTrigger className="h-7 w-24 text-xs">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="active">启用</SelectItem>
                  <SelectItem value="inactive">停用</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* ERP标准数据表格 */}
      <div className="rounded border bg-card">
        {isLoading || isLoadingCategories ? (
          <div className="p-3">
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-6 w-6 rounded" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <div className="text-sm text-red-600">
              加载产品列表失败: {error.message}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() =>
                queryClient.invalidateQueries({
                  queryKey: productQueryKeys.list(queryParams),
                })
              }
            >
              重试
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20">
                <TableHead className="h-8 w-12 text-xs font-medium">
                  <Checkbox
                    checked={
                      Array.isArray(data?.data) &&
                      data.data.length > 0 &&
                      selectedProductIds.length === data.data.length
                    }
                    onCheckedChange={handleSelectAll}
                    aria-label="全选产品"
                  />
                </TableHead>
                <TableHead className="h-8 text-xs font-medium">序号</TableHead>
                <TableHead className="h-8 text-xs font-medium">
                  产品编码
                </TableHead>
                <TableHead className="h-8 text-xs font-medium">
                  产品名称
                </TableHead>
                <TableHead className="h-8 text-xs font-medium">规格</TableHead>
                <TableHead className="h-8 text-xs font-medium">分类</TableHead>
                <TableHead className="h-8 text-xs font-medium">厚度</TableHead>
                <TableHead className="h-8 text-xs font-medium">重量</TableHead>
                <TableHead className="h-8 text-xs font-medium">单位</TableHead>
                <TableHead className="h-8 text-xs font-medium">状态</TableHead>
                <TableHead className="h-8 text-xs font-medium">
                  创建日期
                </TableHead>
                <TableHead className="h-8 w-16 text-xs font-medium">
                  操作
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.isArray(data?.data) ? (
                data.data.map((product, index) => (
                  <TableRow
                    key={product.id}
                    className="h-8 cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      if (onProductSelect) {
                        onProductSelect(product.id);
                      } else {
                        router.push(`/products/${product.id}`);
                      }
                    }}
                  >
                    <TableCell className="py-1">
                      <Checkbox
                        checked={selectedProductIds.includes(product.id)}
                        onCheckedChange={checked =>
                          handleSelectProduct(product.id, checked as boolean)
                        }
                        onClick={e => e.stopPropagation()}
                        aria-label={`选择产品 ${product.name}`}
                      />
                    </TableCell>
                    <TableCell className="py-1 text-xs text-muted-foreground">
                      {(queryParams.page - 1) * queryParams.limit + index + 1}
                    </TableCell>
                    <TableCell className="py-1 text-xs font-medium">
                      {product.code}
                    </TableCell>
                    <TableCell className="py-1 text-xs">
                      {product.name}
                    </TableCell>
                    <TableCell className="py-1 text-xs">
                      {product.specification || '-'}
                    </TableCell>
                    <TableCell className="py-1">
                      <Badge variant="outline" className="text-xs">
                        {product.category?.name || '未分类'}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-1 text-xs">
                      {product?.thickness ? `${product.thickness}mm` : '-'}
                    </TableCell>
                    <TableCell className="py-1 text-xs">
                      {product?.weight ? `${product.weight}kg` : '-'}
                    </TableCell>
                    <TableCell className="py-1 text-xs">
                      {PRODUCT_UNIT_LABELS[
                        product.unit as keyof typeof PRODUCT_UNIT_LABELS
                      ] || product.unit}
                    </TableCell>
                    <TableCell className="py-1">
                      {getStatusBadge(product.status)}
                    </TableCell>
                    <TableCell className="py-1 text-xs">
                      {new Date(product.createdAt).toLocaleDateString('zh-CN')}
                    </TableCell>
                    <TableCell className="py-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={e => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={e => {
                              e.stopPropagation();
                              router.push(`/products/${product.id}`);
                            }}
                          >
                            <Eye className="mr-2 h-3 w-3" />
                            查看
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={e => {
                              e.stopPropagation();
                              router.push(`/products/${product.id}/edit`);
                            }}
                          >
                            <Edit className="mr-2 h-3 w-3" />
                            编辑
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={e => {
                              e.stopPropagation();
                              handleDeleteProduct(product.id, product.name);
                            }}
                          >
                            <Trash2 className="mr-2 h-3 w-3" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="text-sm text-muted-foreground">
                        {isLoading ? '加载中...' : '暂无数据'}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}

        {/* 分页 */}
        {data?.pagination && data.pagination.totalPages > 1 && (
          <div className="border-t px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                显示第 {(data.pagination.page - 1) * data.pagination.limit + 1}{' '}
                -{' '}
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
                  className="h-7 text-xs"
                  onClick={() => handlePageChange(data.pagination.page - 1)}
                  disabled={data.pagination.page <= 1}
                >
                  上一页
                </Button>
                <div className="text-xs">
                  第 {data.pagination.page} / {data.pagination.totalPages} 页
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handlePageChange(data.pagination.page + 1)}
                  disabled={data.pagination.page >= data.pagination.totalPages}
                >
                  下一页
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 删除确认对话框 */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={open => setDeleteDialog(prev => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除产品</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除产品 &ldquo;{deleteDialog.productName}&rdquo; 吗？
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
                    <div className="text-sm font-medium">{product.name}</div>
                    <div className="text-xs text-muted-foreground">
                      编码: {product.code}
                      {product.category && (
                        <span className="ml-2">
                          分类: {product.category.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
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
    </>
  );
}
