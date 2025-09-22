'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { getCategories } from '@/lib/api/categories';
import {
  createProduct,
  productQueryKeys,
  updateProduct,
} from '@/lib/api/products';
import {
  PRODUCT_STATUS_OPTIONS,
  PRODUCT_UNIT_OPTIONS,
} from '@/lib/types/product';
import {
  productCreateSchema,
  productUpdateSchema,
  type ProductCreateFormData,
  type ProductUpdateFormData,
} from '@/lib/validations/product';

interface ERPProductFormProps {
  mode?: 'create' | 'edit';
  productId?: string;
  initialData?: Partial<ProductCreateFormData>;
  onSuccess?: () => void;
}

/**
 * ERP风格产品表单组件
 * 符合中国ERP系统的界面标准和用户习惯
 */
export function ERPProductForm({
  mode = 'create',
  productId,
  initialData,
  onSuccess,
}: ERPProductFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // 获取分类数据
  const { data: categoriesResponse, isLoading: isCategoriesLoading } = useQuery(
    {
      queryKey: ['categories'],
      queryFn: () => getCategories(),
    }
  );

  // 扁平化分类数据
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

  // 表单配置
  const form = useForm<ProductCreateFormData | ProductUpdateFormData>({
    resolver: zodResolver(
      mode === 'create' ? productCreateSchema : productUpdateSchema
    ),
    defaultValues:
      mode === 'create'
        ? {
            code: initialData?.code || '',
            name: initialData?.name || '',
            specification: initialData?.specification || '',
            unit: initialData?.unit || 'piece',
            piecesPerUnit: initialData?.piecesPerUnit || undefined,
            weight: initialData?.weight || undefined,
            thickness: initialData?.thickness || undefined,
            status: initialData?.status || 'active',
            categoryId: initialData?.categoryId || 'uncategorized',
            specifications: initialData?.specifications || {},
          }
        : {
            id: productId || '',
            code: initialData?.code || '',
            name: initialData?.name || '',
            specification: initialData?.specification || '',
            unit: initialData?.unit || 'piece',
            piecesPerUnit: initialData?.piecesPerUnit || 1,
            weight: initialData?.weight || 0,
            thickness: initialData?.thickness || 0,
            status: initialData?.status || 'active',
            categoryId: initialData?.categoryId || 'uncategorized',
          },
  });

  // 创建产品Mutation
  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: data => {
      toast({
        title: '创建成功',
        description: `产品 [${data.code}] 创建成功！`,
        variant: 'success',
      });

      queryClient.invalidateQueries({ queryKey: productQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['categories'] });

      if (onSuccess) {
        onSuccess();
      } else {
        setTimeout(() => {
          router.push('/products');
        }, 1500);
      }
    },
    onError: error => {
      const errorMessage =
        error instanceof Error ? error.message : '创建产品失败';
      toast({
        title: '创建失败',
        description: `创建产品失败：${errorMessage}。请检查输入信息是否正确。`,
        variant: 'destructive',
      });
    },
  });

  // 更新产品Mutation
  const updateMutation = useMutation({
    mutationFn: (data: UpdateProductData) => {
      if (!productId) throw new Error('产品ID不能为空');
      return updateProduct(productId, data);
    },
    onSuccess: data => {
      toast({
        title: '更新成功',
        description: `产品 [${data.code}] 更新成功！`,
        variant: 'success',
      });

      queryClient.invalidateQueries({ queryKey: productQueryKeys.all });
      if (productId) {
        queryClient.invalidateQueries({
          queryKey: productQueryKeys.detail(productId),
        });
      }
      queryClient.invalidateQueries({ queryKey: productQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['categories'] });

      if (onSuccess) {
        onSuccess();
      } else {
        setTimeout(() => {
          router.push('/products');
        }, 1500);
      }
    },
    onError: error => {
      const errorMessage =
        error instanceof Error ? error.message : '更新产品失败';
      toast({
        title: '更新失败',
        description: `更新产品失败：${errorMessage}。请检查输入信息是否正确。`,
        variant: 'destructive',
      });
    },
  });

  // 表单提交处理
  const onSubmit = (data: CreateProductData | UpdateProductData) => {
    const processedData = {
      ...data,
      categoryId: data.categoryId === 'uncategorized' ? null : data.categoryId,
    };

    if (mode === 'create') {
      createMutation.mutate(processedData as CreateProductData);
    } else {
      updateMutation.mutate(processedData as UpdateProductData);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      {/* ERP标准工具栏 */}
      <div className="rounded border bg-card">
        <div className="border-b bg-muted/30 px-3 py-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              {mode === 'create' ? '新建产品' : '编辑产品'}
            </h3>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() => router.back()}
                disabled={isLoading}
              >
                <ArrowLeft className="mr-1 h-3 w-3" />
                返回
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ERP标准表单 */}
      <div className="rounded border bg-card">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-0">
            {/* 基本信息区域 */}
            <div className="border-b bg-muted/10 px-3 py-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                基本信息
              </h4>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2 lg:grid-cols-4">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">
                        产品编码 *
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="请输入产品编码"
                          className="h-8 text-xs"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">
                        产品名称 *
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="请输入产品名称"
                          className="h-8 text-xs"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="specification"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">
                        规格
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="如：600x600mm"
                          className="h-8 text-xs"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">
                        计量单位 *
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="选择单位" />
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
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">
                        产品分类
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isCategoriesLoading}
                      >
                        <FormControl>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="选择分类" />
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
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">
                        状态 *
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="选择状态" />
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
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* 详细参数区域 */}
            <div className="border-b bg-muted/10 px-3 py-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                详细参数
              </h4>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2 lg:grid-cols-4">
                <FormField
                  control={form.control}
                  name="piecesPerUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">
                        每单位片数
                      </FormLabel>
                      <FormControl>
                        <NumberInput
                          value={field.value}
                          onChange={field.onChange}
                          min={1}
                          defaultValue={1}
                          allowEmpty={true}
                          placeholder="片数"
                          className="h-8 text-xs"
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="weight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">
                        重量 (kg)
                      </FormLabel>
                      <FormControl>
                        <NumberInput
                          value={field.value}
                          onChange={field.onChange}
                          min={0}
                          step={0.01}
                          precision={2}
                          allowEmpty={true}
                          placeholder="重量"
                          className="h-8 text-xs"
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="thickness"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">
                        厚度 (mm)
                      </FormLabel>
                      <FormControl>
                        <NumberInput
                          value={field.value}
                          onChange={field.onChange}
                          min={0}
                          max={100}
                          step={0.1}
                          precision={1}
                          allowEmpty={true}
                          placeholder="厚度"
                          className="h-8 text-xs"
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <div className="md:col-span-2 lg:col-span-4">
                  <FormLabel className="text-xs text-muted-foreground">
                    产品描述
                  </FormLabel>
                  <Textarea
                    placeholder="请输入产品描述（可选）"
                    className="mt-1 min-h-[60px] text-xs"
                  />
                </div>
              </div>
            </div>

            {/* 操作按钮区域 */}
            <div className="border-t bg-muted/10 px-4 py-3">
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7"
                  onClick={() => router.back()}
                  disabled={isLoading}
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="h-7"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      {mode === 'create' ? '创建中...' : '更新中...'}
                    </>
                  ) : (
                    <>
                      <Save className="mr-1 h-3 w-3" />
                      {mode === 'create' ? '创建产品' : '保存修改'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </div>
    </>
  );
}
