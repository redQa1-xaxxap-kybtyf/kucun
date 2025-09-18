'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

// UI Components
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
// API and Types
import { getCategories } from '@/lib/api/categories';
import { getProduct, productQueryKeys, updateProduct } from '@/lib/api/products';
import { UpdateProductSchema, type UpdateProductData } from '@/lib/schemas/product';
import {
    PRODUCT_STATUS_OPTIONS,
    PRODUCT_UNIT_OPTIONS,
} from '@/lib/types/product';

/**
 * 产品编辑页面
 * 严格遵循全栈项目统一约定规范
 */

interface ProductEditPageProps {
  params: Promise<{ id: string }>;
}

export default function ProductEditPage({ params }: ProductEditPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // 解析动态路由参数 (Next.js 15.4 要求)
  const { id: productId } = React.use(params);

  // 获取产品数据
  const {
    data: product,
    isLoading: isProductLoading,
    error: productError,
  } = useQuery({
    queryKey: productQueryKeys.detail(productId),
    queryFn: () => getProduct(productId),
  });

  // 获取分类数据
  const {
    data: categoriesResponse,
    isLoading: isCategoriesLoading,
  } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getCategories(),
  });

  const categories = categoriesResponse?.data || [];

  // 表单配置
  const form = useForm<UpdateProductData>({
    resolver: zodResolver(UpdateProductSchema),
    defaultValues: {
      id: '',
      code: '',
      name: '',
      specification: '',
      unit: 'piece',
      piecesPerUnit: 1,
      weight: 0,
      status: 'active',
      categoryId: '',
    },
  });

  // 当产品数据加载完成时，填充表单
  React.useEffect(() => {
    if (product) {
      form.reset({
        id: product.id,
        code: product.code,
        name: product.name,
        specification: product.specification || '',
        unit: product.unit,
        piecesPerUnit: product.piecesPerUnit,
        weight: product.weight || 0,
        status: product.status,
        categoryId: product.categoryId || 'uncategorized',
      });
    }
  }, [product, form]);

  // 更新产品 Mutation
  const updateProductMutation = useMutation({
    mutationFn: (data: UpdateProductData) => updateProduct(productId, data),
    onSuccess: (updatedProduct) => {
      toast.success('产品更新成功');

      // 失效相关查询缓存
      queryClient.invalidateQueries({ queryKey: productQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: productQueryKeys.detail(productId) });

      // 跳转到产品详情页面
      router.push(`/products/${updatedProduct.id}`);
    },
    onError: (error: any) => {
      console.error('更新产品失败:', error);
      toast.error(error?.message || '更新产品失败，请重试');
    },
  });

  // 表单提交处理
  const onSubmit = (data: UpdateProductData) => {
    // 处理分类ID：如果选择了"未分类"，则设置为undefined
    const processedData = {
      ...data,
      categoryId: data.categoryId === 'uncategorized' ? undefined : data.categoryId,
    };
    updateProductMutation.mutate(processedData);
  };

  // 加载状态
  if (isProductLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>正在加载产品信息...</span>
          </div>
        </div>
      </div>
    );
  }

  // 错误状态
  if (productError) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-red-600 mb-2">
              加载产品信息失败
            </h2>
            <p className="text-gray-600 mb-4">
              {productError?.message || '请检查网络连接后重试'}
            </p>
            <Button onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-600 mb-2">
              产品不存在
            </h2>
            <p className="text-gray-500 mb-4">
              请检查产品ID是否正确
            </p>
            <Button onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          <div>
            <h1 className="text-2xl font-bold">编辑产品</h1>
            <p className="text-gray-600">
              修改产品信息 - {product.name}
            </p>
          </div>
        </div>
      </div>

      {/* 编辑表单 */}
      <Card>
        <CardHeader>
          <CardTitle>产品信息</CardTitle>
          <CardDescription>
            请填写完整的产品信息，带 * 的字段为必填项
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 产品编码 */}
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>产品编码 *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="请输入产品编码"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        产品的唯一标识编码
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 产品名称 */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>产品名称 *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="请输入产品名称"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 产品规格 */}
                <FormField
                  control={form.control}
                  name="specification"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>产品规格</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="请输入产品规格"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        例如：800x800mm、600x1200mm等
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 计量单位 */}
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>计量单位 *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="请选择计量单位" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PRODUCT_UNIT_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 每单位片数 */}
                <FormField
                  control={form.control}
                  name="piecesPerUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>每单位片数</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          placeholder="请输入每单位片数"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        每个计量单位包含的片数
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 重量 */}
                <FormField
                  control={form.control}
                  name="weight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>重量 (kg)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="请输入重量"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        单个产品的重量（千克）
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 产品状态 */}
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>产品状态 *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="请选择产品状态" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PRODUCT_STATUS_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 产品分类 */}
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>产品分类</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isCategoriesLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="请选择产品分类" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="uncategorized">未分类</SelectItem>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        选择产品所属的分类
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>



              {/* 提交按钮 */}
              <div className="flex items-center justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={updateProductMutation.isPending}
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  disabled={updateProductMutation.isPending}
                >
                  {updateProductMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      更新中...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      更新产品
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
