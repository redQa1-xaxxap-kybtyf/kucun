'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
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
import { Textarea } from '@/components/ui/textarea';

// API and Types
import { categoryQueryKeys, getCategories } from '@/lib/api/categories';
import { getProduct, productQueryKeys, updateProduct } from '@/lib/api/products';
import type { UpdateProductData } from '@/lib/schemas/product';
import { UpdateProductSchema } from '@/lib/schemas/product';
import {
    PRODUCT_STATUS_OPTIONS,
    PRODUCT_UNIT_OPTIONS,
} from '@/lib/types/product';

/**
 * 编辑产品页面
 * 严格遵循全栈项目统一约定规范
 */
export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const productId = params.id as string;

  // 获取产品数据
  const {
    data: product,
    isLoading: isLoadingProduct,
    error: productError,
  } = useQuery({
    queryKey: productQueryKeys.detail(productId),
    queryFn: () => getProduct(productId),
    enabled: !!productId,
  });

  // 获取分类数据
  const {
    data: categories,
    isLoading: isLoadingCategories,
    error: categoriesError,
  } = useQuery({
    queryKey: categoryQueryKeys.all,
    queryFn: getCategories,
  });

  // 表单配置
  const form = useForm<UpdateProductData>({
    resolver: zodResolver(UpdateProductSchema),
    defaultValues: {
      id: productId,
      code: '',
      name: '',
      specification: '',
      unit: 'piece',
      piecesPerUnit: undefined,
      weight: undefined,
      status: 'active',
      categoryId: '',
      specifications: {},
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
        piecesPerUnit: product.piecesPerUnit || undefined,
        weight: product.weight || undefined,
        status: product.status,
        categoryId: product.categoryId || '',
        specifications: product.specifications || {},
      });
    }
  }, [product, form]);

  // 更新产品Mutation
  const updateProductMutation = useMutation({
    mutationFn: (data: UpdateProductData) => updateProduct(productId, data),
    onSuccess: (updatedProduct) => {
      toast.success('产品更新成功', {
        description: `产品"${updatedProduct.name}"已成功更新`,
      });

      // 失效相关查询缓存
      queryClient.invalidateQueries({ queryKey: productQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: productQueryKeys.detail(productId) });

      // 跳转回产品详情页面
      router.push(`/products/${productId}`);
    },
    onError: (error) => {
      console.error('更新产品失败:', error);
      toast.error('更新产品失败', {
        description: error instanceof Error ? error.message : '请稍后重试',
      });
    },
  });

  // 表单提交处理
  const onSubmit = (data: UpdateProductData) => {
    console.log('表单提交数据:', data);

    // 处理数据转换
    const processedData = {
      ...data,
      piecesPerUnit: data.piecesPerUnit || undefined,
      weight: data.weight || undefined,
      specification: data.specification || '',
      categoryId: data.categoryId || undefined,
    };

    console.log('处理后数据:', processedData);
    updateProductMutation.mutate(processedData);
  };

  // 返回按钮处理
  const handleBack = () => {
    router.push(`/products/${productId}`);
  };

  // 加载状态
  if (isLoadingProduct || isLoadingCategories) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>正在加载产品信息...</span>
        </div>
      </div>
    );
  }

  // 错误状态
  if (productError || categoriesError) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-red-600 mb-2">加载失败</h2>
          <p className="text-gray-600 mb-4">
            {productError?.message || categoriesError?.message || '加载产品信息失败'}
          </p>
          <Button onClick={() => router.push('/products')}>
            返回产品列表
          </Button>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-red-600 mb-2">产品不存在</h2>
          <p className="text-gray-600 mb-4">未找到指定的产品信息</p>
          <Button onClick={() => router.push('/products')}>
            返回产品列表
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="flex items-center space-x-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>返回</span>
        </Button>

        <div>
          <h1 className="text-2xl font-bold">编辑产品</h1>
          <p className="text-gray-600">修改产品的基本信息和规格</p>
        </div>
      </div>

      {/* 表单内容 */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 基本信息卡片 */}
            <Card>
              <CardHeader>
                <CardTitle>基本信息</CardTitle>
                <CardDescription>修改产品的基本信息</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 产品编码 */}
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>产品编码 *</FormLabel>
                      <FormControl>
                        <Input placeholder="请输入产品编码" {...field} />
                      </FormControl>
                      <FormDescription>
                        产品的唯一标识码，不可重复
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
                        <Input placeholder="请输入产品名称" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 规格 */}
                <FormField
                  control={form.control}
                  name="specification"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>规格</FormLabel>
                      <FormControl>
                        <Input placeholder="请输入产品规格" {...field} />
                      </FormControl>
                      <FormDescription>
                        例如：600x600mm、800x800mm等
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
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择计量单位" />
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

                {/* 状态 */}
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>状态 *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择状态" />
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
                        onValueChange={(value) => {
                          console.log('分类选择器值变化:', value);
                          field.onChange(value === 'uncategorized' ? '' : value);
                        }}
                        value={field.value || 'uncategorized'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择产品分类（可选）" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="uncategorized">未分类</SelectItem>
                          {categories?.data?.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        选择产品所属的分类，留空则为未分类
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* 详细信息卡片 */}
            <Card>
              <CardHeader>
                <CardTitle>详细信息</CardTitle>
                <CardDescription>修改产品的详细参数</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                          placeholder="请输入每单位片数"
                          {...field}
                          onChange={(e) => {
                            const value = e.target.value;
                            field.onChange(value ? parseInt(value, 10) : undefined);
                          }}
                          value={field.value || ''}
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
                          step="0.01"
                          placeholder="请输入重量"
                          {...field}
                          onChange={(e) => {
                            const value = e.target.value;
                            field.onChange(value ? parseFloat(value) : undefined);
                          }}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormDescription>
                        单个产品的重量（千克）
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 产品描述 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">产品描述</label>
                  <Textarea
                    placeholder="请输入产品描述（可选）"
                    className="min-h-[100px]"
                    value={form.watch('specification') || ''}
                    onChange={(e) => form.setValue('specification', e.target.value)}
                  />
                  <p className="text-sm text-gray-600">
                    详细描述产品的特点和用途
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 提交按钮 */}
          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={updateProductMutation.isPending}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={updateProductMutation.isPending}
              className="flex items-center space-x-2"
            >
              {updateProductMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>
                {updateProductMutation.isPending ? '保存中...' : '保存更改'}
              </span>
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
