'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';

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
import { NumberInput } from '@/components/ui/number-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
// Hooks
import { useToast } from '@/hooks/use-toast';
// API and Types
import { getCategories } from '@/lib/api/categories';
import {
  getProduct,
  productQueryKeys,
  updateProduct,
} from '@/lib/api/products';
import {
  UpdateProductSchema,
  type UpdateProductData,
} from '@/lib/schemas/product';
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
  const { toast } = useToast();

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
    // 确保每次进入编辑页面都获取最新数据
    staleTime: 0,
    gcTime: 0,
  });

  // 获取分类数据
  const { data: categoriesResponse, isLoading: isCategoriesLoading } = useQuery(
    {
      queryKey: ['categories'],
      queryFn: () => getCategories(),
    }
  );

  // 扁平化分类数据，包含所有子分类，避免重复 - 使用useMemo避免重复计算
  const allCategories = React.useMemo(() => {
    const categories = categoriesResponse?.data || [];

    const flattenCategories = (cats: typeof categories): typeof categories => {
      const result: typeof categories = [];
      const seenIds = new Set<string>();

      const addCategory = (category: (typeof categories)[0]) => {
        if (!seenIds.has(category.id)) {
          seenIds.add(category.id);
          result.push(category);
        }
      };

      const processCategories = (categories: typeof cats) => {
        categories.forEach(category => {
          addCategory(category);
          if (category.children && category.children.length > 0) {
            processCategories(category.children);
          }
        });
      };

      processCategories(cats);
      return result;
    };

    return flattenCategories(categories);
  }, [categoriesResponse?.data]);

  // 表单配置 - 使用固定的默认值，数据加载后通过useEffect设置
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
      thickness: 0,
      status: 'active',
      categoryId: 'uncategorized',
    },
  });

  // 当产品数据加载完成时，填充表单
  React.useEffect(() => {
    if (product && !isProductLoading && allCategories.length > 0) {
      // 验证分类ID是否存在于分类列表中
      // 如果product.categoryId为null，表示未分类，应该设置为'uncategorized'
      // 如果product.categoryId有值，检查是否在分类列表中存在
      const categoryExists =
        product.categoryId &&
        allCategories.some(cat => cat.id === product.categoryId);

      const categoryIdToSet = product.categoryId
        ? categoryExists
          ? product.categoryId
          : 'uncategorized'
        : 'uncategorized';

      // 使用 reset 方法一次性设置所有字段
      form.reset({
        id: product.id,
        code: product.code,
        name: product.name,
        specification: product.specification || '',
        unit: product.unit,
        piecesPerUnit: product.piecesPerUnit,
        weight: product.weight || 0,
        thickness: product.thickness || 0,
        status: product.status,
        categoryId: categoryIdToSet,
      });
    }
  }, [product, isProductLoading, allCategories]);

  // 更新产品 Mutation
  const updateProductMutation = useMutation({
    mutationFn: (data: UpdateProductData) => updateProduct(productId, data),
    onSuccess: async updatedProduct => {
      toast({
        title: '更新成功',
        description: `产品 "${updatedProduct.name}" 更新成功！`,
        variant: 'success',
      });

      // 彻底失效所有相关查询缓存
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: productQueryKeys.all }),
        queryClient.invalidateQueries({
          queryKey: productQueryKeys.detail(productId),
        }),
        queryClient.invalidateQueries({
          queryKey: productQueryKeys.lists(),
        }),
        queryClient.invalidateQueries({
          queryKey: productQueryKeys.details(),
        }),
        // 同时失效分类查询缓存，因为产品分类可能发生变化
        queryClient.invalidateQueries({ queryKey: ['categories'] }),
      ]);

      // 强制重新获取当前产品数据，确保表单显示最新数据
      await queryClient.refetchQueries({
        queryKey: productQueryKeys.detail(productId),
      });

      // 延迟跳转到产品列表页，让用户看到成功提示
      setTimeout(() => {
        router.push('/products');
      }, 1500);
    },
    onError: (error: Error) => {
      toast({
        title: '更新失败',
        description: error?.message || '更新产品失败，请重试',
        variant: 'destructive',
      });
    },
  });

  // 表单提交处理
  const onSubmit = (data: UpdateProductData) => {
    // 处理分类ID：如果选择了"未分类"，则设置为null
    const processedData = {
      ...data,
      categoryId: data.categoryId === 'uncategorized' ? null : data.categoryId,
    };
    updateProductMutation.mutate(processedData);
  };

  // 加载状态
  if (isProductLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex min-h-[400px] items-center justify-center">
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
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center">
            <h2 className="mb-2 text-lg font-semibold text-red-600">
              加载产品信息失败
            </h2>
            <p className="mb-4 text-gray-600">
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
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center">
            <h2 className="mb-2 text-lg font-semibold text-gray-600">
              产品不存在
            </h2>
            <p className="mb-4 text-gray-500">请检查产品ID是否正确</p>
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
    <div className="container mx-auto space-y-6 py-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          <div>
            <h1 className="text-2xl font-bold">编辑产品</h1>
            <p className="text-gray-600">修改产品信息 - {product.name}</p>
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
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
                      <FormDescription>产品的唯一标识编码</FormDescription>
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

                {/* 产品规格 */}
                <FormField
                  control={form.control}
                  name="specification"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>产品规格</FormLabel>
                      <FormControl>
                        <Input placeholder="请输入产品规格" {...field} />
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
                          {PRODUCT_UNIT_OPTIONS.map(option => (
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
                        <NumberInput
                          value={field.value}
                          onChange={field.onChange}
                          min={1}
                          defaultValue={1}
                          allowEmpty={false}
                          placeholder="请输入每单位片数"
                        />
                      </FormControl>
                      <FormDescription>每个计量单位包含的片数</FormDescription>
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
                        <NumberInput
                          value={field.value}
                          onChange={field.onChange}
                          min={0}
                          step={0.01}
                          precision={2}
                          defaultValue={0}
                          allowEmpty={true}
                          placeholder="请输入重量"
                        />
                      </FormControl>
                      <FormDescription>单个产品的重量（千克）</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 厚度 */}
                <FormField
                  control={form.control}
                  name="thickness"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>厚度 (mm)</FormLabel>
                      <FormControl>
                        <NumberInput
                          value={field.value}
                          onChange={field.onChange}
                          min={0}
                          max={100}
                          step={0.1}
                          precision={1}
                          defaultValue={0}
                          allowEmpty={true}
                          placeholder="请输入厚度"
                        />
                      </FormControl>
                      <FormDescription>产品的厚度（毫米）</FormDescription>
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
                          {PRODUCT_STATUS_OPTIONS.map(option => (
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
                        key={`category-select-${product?.id}-${field.value}`}
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
                          {allCategories.map(category => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.parent
                                ? `${category.parent.name} > ${category.name}`
                                : category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>选择产品所属的分类</FormDescription>
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
