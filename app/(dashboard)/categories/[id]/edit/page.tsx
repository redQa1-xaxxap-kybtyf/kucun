'use client';

/**
 * 编辑分类页面
 * 严格遵循全栈项目统一约定规范
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React from 'react';
import { useForm } from 'react-hook-form';

// UI Components
import type { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
// API and Types
import {
  getCategories,
  getCategory,
  updateCategory,
} from '@/lib/api/categories';
import { UpdateCategorySchema } from '@/lib/schemas/category';

type UpdateCategoryData = z.infer<typeof UpdateCategorySchema>;

interface CategoryEditPageProps {
  params: Promise<{ id: string }>;
}

/**
 * 编辑分类页面组件
 */
export default function CategoryEditPage({ params }: CategoryEditPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // 解析动态路由参数 (Next.js 15.4 要求)
  const { id: categoryId } = React.use(params);

  // 获取分类数据
  const {
    data: category,
    isLoading: isCategoryLoading,
    error: categoryError,
  } = useQuery({
    queryKey: ['categories', categoryId],
    queryFn: () => getCategory(categoryId),
  });

  // 获取父级分类列表（排除当前分类）
  const { data: categoriesResponse, isLoading: isCategoriesLoading } = useQuery(
    {
      queryKey: ['categories', { status: 'active', exclude: categoryId }],
      queryFn: () => getCategories({ status: 'active', limit: 100 }),
      enabled: !!categoryId,
    }
  );

  const parentCategories = (categoriesResponse?.data || []).filter(
    cat => cat.id !== categoryId
  );

  // 表单配置
  const form = useForm<UpdateCategoryData>({
    resolver: zodResolver(UpdateCategorySchema),
    defaultValues: {
      id: '',
      name: '',
      parentId: undefined,
      sortOrder: 0,
    },
  });

  // 当分类数据加载完成时，填充表单
  React.useEffect(() => {
    if (category?.data) {
      const categoryData = category.data;
      form.reset({
        id: categoryData.id,
        name: categoryData.name,
        parentId: categoryData.parentId ?? 'none',
        sortOrder: categoryData.sortOrder,
      });
    }
  }, [category, form]);

  // 更新分类Mutation
  const updateMutation = useMutation({
    mutationFn: updateCategory,
    onSuccess: async data => {
      // 先显示成功提示
      toast({
        title: '更新成功',
        description: `分类 "${data.data.name}" 更新成功！所有修改已保存。`,
        variant: 'success',
      });

      // 精确刷新缓存
      await Promise.all([
        // 失效所有分类列表查询
        queryClient.invalidateQueries({ queryKey: ['categories'] }),
        // 强制重新获取当前分类的详情数据
        queryClient.refetchQueries({ queryKey: ['categories', categoryId] }),
      ]);

      // 延迟跳转，让用户看到成功提示
      setTimeout(() => {
        router.push('/categories');
      }, 1500);
    },
    onError: error => {
      const errorMessage = error instanceof Error ? error.message : '更新失败';
      toast({
        title: '更新失败',
        description: `更新分类失败：${errorMessage}。请检查输入信息是否正确或网络连接是否正常。`,
        variant: 'destructive',
      });
    },
  });

  // 表单提交处理
  const onSubmit = (data: UpdateCategoryData) => {
    // 将 "none" 转换为 undefined
    const submitData = {
      ...data,
      parentId: data.parentId === 'none' ? undefined : data.parentId,
    };
    updateMutation.mutate(submitData);
  };

  // 加载状态
  if (isCategoryLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <div>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="mt-2 h-4 w-48" />
          </div>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-24" />
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 错误状态
  if (categoryError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">编辑分类</h1>
            <p className="text-muted-foreground">修改分类信息</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              加载失败:{' '}
              {categoryError instanceof Error
                ? categoryError.message
                : '未知错误'}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!category?.data) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">编辑分类</h1>
          <p className="text-muted-foreground">修改分类信息</p>
        </div>
      </div>

      {/* 表单 */}
      <Card>
        <CardHeader>
          <CardTitle>分类信息</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* 分类名称 */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>分类名称 *</FormLabel>
                      <FormControl>
                        <Input placeholder="请输入分类名称" {...field} />
                      </FormControl>
                      <FormDescription>
                        分类的显示名称，最多50个字符
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 父级分类 */}
                <FormField
                  control={form.control}
                  name="parentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>父级分类</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || 'none'}
                        disabled={isCategoriesLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="请选择父级分类" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">无（顶级分类）</SelectItem>
                          {parentCategories.map(category => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        选择父级分类以创建层级结构
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 排序顺序 */}
                <FormField
                  control={form.control}
                  name="sortOrder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>排序顺序</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          onChange={e =>
                            field.onChange(parseInt(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormDescription>数字越小排序越靠前</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* 提交按钮 */}
              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className={
                    updateMutation.isPending ? 'cursor-not-allowed' : ''
                  }
                >
                  {updateMutation.isPending ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      正在保存修改...
                    </>
                  ) : (
                    <>
                      <span>保存修改</span>
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
