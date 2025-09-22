'use client';

/**
 * 新建分类页面
 * 严格遵循全栈项目统一约定规范
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
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
import { useToast } from '@/hooks/use-toast';
import { createCategory, getCategories } from '@/lib/api/categories';
import { CreateCategorySchema } from '@/lib/schemas/category';

type CreateCategoryData = z.infer<typeof CreateCategorySchema>;

/**
 * 新建分类页面组件
 */
export default function CreateCategoryPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // 表单配置
  const form = useForm<CreateCategoryData>({
    resolver: zodResolver(CreateCategorySchema),
    defaultValues: {
      name: '',
      parentId: undefined,
      sortOrder: 0,
    },
  });

  // 获取父级分类列表
  const { data: categoriesResponse, isLoading: isCategoriesLoading } = useQuery(
    {
      queryKey: ['categories', { status: 'active' }],
      queryFn: () => getCategories({ status: 'active', limit: 100 }),
    }
  );

  const parentCategories = categoriesResponse?.data || [];

  // 创建分类Mutation
  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: data => {
      // 先显示成功提示
      toast({
        title: '创建成功',
        description: `分类 "${data.data.name}" 创建成功！系统已自动生成编码：${data.data.code}`,
        variant: 'success',
      });

      // 刷新缓存
      queryClient.invalidateQueries({ queryKey: ['categories'] });

      // 延迟跳转，让用户看到成功提示
      setTimeout(() => {
        router.push('/categories');
      }, 1500);
    },
    onError: error => {
      const errorMessage = error instanceof Error ? error.message : '创建失败';
      toast({
        title: '创建失败',
        description: `创建分类失败：${errorMessage}。请检查分类名称是否重复或网络连接是否正常。`,
        variant: 'destructive',
      });
    },
  });

  // 表单提交处理
  const onSubmit = (data: CreateCategoryData) => {
    // 将 "none" 转换为 undefined
    const submitData = {
      ...data,
      parentId: data.parentId === 'none' ? undefined : data.parentId,
    };
    createMutation.mutate(submitData);
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">新建分类</h1>
          <p className="text-muted-foreground">创建新的产品分类</p>
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
                        value={field.value}
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
                  disabled={createMutation.isPending}
                  className={
                    createMutation.isPending ? 'cursor-not-allowed' : ''
                  }
                >
                  {createMutation.isPending ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      正在创建分类...
                    </>
                  ) : (
                    <>
                      <span>创建分类</span>
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
