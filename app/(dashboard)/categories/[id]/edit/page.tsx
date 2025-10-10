'use client';

/**
 * 编辑分类页面
 * 严格遵循全栈项目统一约定规范
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { use } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { FolderTree, Save, X } from 'lucide-react';

import { ContentLoading } from '@/components/common/loading';
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
import { useToast } from '@/components/ui/use-toast';
// API and Types
import {
  getCategories,
  getCategory,
  updateCategory,
} from '@/lib/api/categories';
import { queryKeys } from '@/lib/queryKeys';
import { UpdateCategorySchema } from '@/lib/validations/category';

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
  const { id: categoryId } = use(params);

  // 获取分类数据
  const {
    data: category,
    isLoading: isCategoryLoading,
    error: categoryError,
  } = useQuery({
    queryKey: queryKeys.categories.detail(categoryId),
    queryFn: () => getCategory(categoryId),
  });

  // 获取父级分类列表（排除当前分类）
  const { data: categoriesResponse, isLoading: isCategoriesLoading } = useQuery(
    {
      queryKey: queryKeys.categories.list({
        status: 'active',
        exclude: categoryId,
      }),
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
        description: `分类 "${data.data?.name || '未知分类'}" 更新成功！所有修改已保存。`,
        variant: 'success',
        duration: 1500,
      });

      // 精确刷新缓存
      await Promise.all([
        // 失效所有分类列表查询
        queryClient.invalidateQueries({ queryKey: queryKeys.categories.all }),
        // 强制重新获取当前分类的详情数据
        queryClient.refetchQueries({
          queryKey: queryKeys.categories.detail(categoryId),
        }),
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
        <Card>
          <CardContent className="p-6">
            <ContentLoading text="加载分类数据..." />
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
          >
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
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        {/* 页面标题卡片 */}
        <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
          <CardContent className="bg-gradient-to-r from-slate-50 to-gray-50 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
                  <FolderTree className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                    编辑分类
                  </h1>
                  <p className="text-sm text-gray-600">修改分类信息</p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => router.back()}
                className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 表单 */}
        <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
          <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50">
            <CardTitle className="flex items-center text-gray-900">
              <FolderTree className="mr-2 h-5 w-5 text-blue-600" />
              分类信息
            </CardTitle>
            <CardDescription>
              修改分类的基本信息，包括名称、父级分类和排序顺序
            </CardDescription>
          </CardHeader>
          <div className="border-b bg-blue-50 px-6 py-3">
            <div className="flex items-start gap-2 text-sm">
              <span className="text-blue-600">ℹ️</span>
              <div className="flex-1 text-blue-800">
                <strong>分类层级规则：</strong>
                <ul className="mt-1 ml-4 list-disc space-y-1 text-xs">
                  <li>支持最多3级分类（例如：抛光砖 → 系列A → 款式1）</li>
                  <li>不同父分类下可以创建相同名称的子分类</li>
                  <li>每个分类会自动生成唯一的编码</li>
                </ul>
              </div>
            </div>
          </div>
          <CardContent className="p-6">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
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
                            <SelectItem value="none">
                              <div className="flex items-center gap-2">
                                <span className="text-blue-600">🏠</span>
                                <span>无（顶级分类）</span>
                              </div>
                            </SelectItem>
                            {parentCategories.map(category => (
                              <SelectItem key={category.id} value={category.id}>
                                <div className="flex items-center gap-2">
                                  {category.parent ? (
                                    <span className="ml-4 text-gray-400">↳</span>
                                  ) : (
                                    <span className="text-green-600">📁</span>
                                  )}
                                  <span>{category.name}</span>
                                  {category.parent && (
                                    <span className="text-xs text-gray-400">
                                      ({category.parent.name})
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          <div className="flex flex-col gap-1">
                            <span>选择父级分类以创建层级结构（最多支持3级）</span>
                            <span className="text-xs text-blue-600">
                              💡 提示：不同父分类下可以有相同名称的子分类
                            </span>
                          </div>
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
                    size="lg"
                    onClick={() => router.back()}
                    className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
                  >
                    <X className="mr-2 h-4 w-4" />
                    取消
                  </Button>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={updateMutation.isPending}
                    className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
                  >
                    {updateMutation.isPending ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        正在保存修改...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        保存修改
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
