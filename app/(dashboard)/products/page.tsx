'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import {
    Edit,
    Eye,
    MoreHorizontal,
    Plus,
    Search,
    Trash2
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
import { deleteProduct, getProducts, productQueryKeys } from '@/lib/api/products';
import type { Product, ProductQueryParams } from '@/lib/types/product';
import {
    PRODUCT_STATUS_LABELS,
    PRODUCT_UNIT_LABELS,
} from '@/lib/types/product';

/**
 * 产品管理页面
 * 严格遵循全栈项目统一约定规范
 */
function ProductsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [queryParams, setQueryParams] = React.useState<ProductQueryParams>({
    page: 1,
    limit: 20,
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

  // 获取分类列表
  const {
    data: categoriesResponse,
    isLoading: isLoadingCategories,
  } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getCategories(),
  });

  const categories = categoriesResponse?.data || [];

  // 获取产品列表数据
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: productQueryKeys.list(queryParams),
    queryFn: () => getProducts(queryParams),
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

  // 删除产品的mutation
  const deleteProductMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      toast({
        title: '删除成功',
        description: `产品"${deleteDialog.productName}"已成功删除`,
      });

      // 关闭对话框
      setDeleteDialog({ open: false, productId: null, productName: '' });

      // 刷新产品列表数据
      refetch();
    },
    onError: (error: Error) => {
      console.error('删除产品失败:', error);
      toast({
        title: '删除失败',
        description: error.message || '删除产品时发生错误',
        variant: 'destructive',
      });
    },
  });

  // 确认删除产品
  const confirmDeleteProduct = async () => {
    if (!deleteDialog.productId) return;
    deleteProductMutation.mutate(deleteDialog.productId);
  };

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
        <Badge variant="outline">
          {item?.category?.name || '未分类'}
        </Badge>
      ),
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
          <p className="text-muted-foreground">管理所有产品的基本信息和规格</p>
        </div>
        <Button onClick={() => router.push('/products/create')}>
          <Plus className="mr-2 h-4 w-4" />
          新建产品
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
                  handleFilter('categoryId', value === 'all' ? undefined : value)
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
                  <SelectItem value="piece">片</SelectItem>
                  <SelectItem value="box">箱</SelectItem>
                  <SelectItem value="square_meter">平方米</SelectItem>
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
                      <TableHead>产品编码</TableHead>
                      <TableHead>产品名称</TableHead>
                      <TableHead>规格</TableHead>
                      <TableHead>分类</TableHead>
                      <TableHead>单位</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead className="w-[120px]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data?.map(product => (
                      <TableRow key={product.id}>
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
                                onClick={() => handleDeleteProduct(product.id, product.name)}
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
                          onClick={() => handleDeleteProduct(item.id, item.name)}
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
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) =>
        setDeleteDialog(prev => ({ ...prev, open }))
      }>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除产品</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除产品 "{deleteDialog.productName}" 吗？
              <br />
              <span className="text-red-600 font-medium">
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
    </div>
  );
}

export default ProductsPage;
