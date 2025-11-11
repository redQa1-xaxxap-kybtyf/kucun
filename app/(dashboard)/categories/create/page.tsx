'use client';

/**
 * 新建分类页面
 * 严格遵循全栈项目统一约定规范
 */

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FolderTree, Save, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';

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
import {
  categoryQueryKeys,
  createCategory,
  getCategories,
  type Category,
} from '@/lib/api/categories';
import { paginationConfig } from '@/lib/env';
import { queryKeys } from '@/lib/queryKeys';
import { CreateCategorySchema } from '@/lib/validations/category';

type CreateCategoryData = z.infer<typeof CreateCategorySchema>;

/**
 * 新建分类页面组件
 */
export default function CreateCategoryPage() {
  const controller = useCreateCategoryController();
  return <CreateCategoryView {...controller} />;
}

interface CreateCategoryController {
  form: UseFormReturn<CreateCategoryData>;
  isCreating: boolean;
  parentSearchTerm: string;
  onParentSearchChange: (value: string) => void;
  parentOptions: Category[];
  isParentOptionsLoading: boolean;
  disableParentSelect: boolean;
  onSubmit: (data: CreateCategoryData) => void;
  onCancel: () => void;
  onBack: () => void;
}

function useCreateCategoryController(): CreateCategoryController {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [parentSearchTerm, setParentSearchTerm] = React.useState('');
  const deferredSearchTerm = React.useDeferredValue(parentSearchTerm);

  const form = useForm<CreateCategoryData>({
    resolver: standardSchemaResolver(CreateCategorySchema),
    defaultValues: {
      name: '',
      parentId: undefined,
      sortOrder: 0,
    },
  });

  const {
    data: categoriesResponse,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: queryKeys.categories.list({
      status: 'active',
      search: deferredSearchTerm || undefined,
      limit: paginationConfig.maxPageSize,
    }),
    queryFn: () =>
      getCategories({
        status: 'active',
        limit: paginationConfig.maxPageSize,
        search: deferredSearchTerm || undefined,
      }),
  });

  const parentOptions = React.useMemo(
    () =>
      (categoriesResponse?.data ?? []).slice().sort((a, b) => {
        const levelA = a.parent ? 1 : 0;
        const levelB = b.parent ? 1 : 0;
        if (levelA !== levelB) {
          return levelA - levelB;
        }

        const sortOrderA =
          typeof a.sortOrder === 'number'
            ? a.sortOrder
            : Number.MAX_SAFE_INTEGER;
        const sortOrderB =
          typeof b.sortOrder === 'number'
            ? b.sortOrder
            : Number.MAX_SAFE_INTEGER;

        if (sortOrderA !== sortOrderB) {
          return sortOrderA - sortOrderB;
        }

        return a.name.localeCompare(b.name, 'zh-Hans-CN');
      }),
    [categoriesResponse?.data]
  );

  const isParentOptionsLoading =
    isLoading || isFetching || parentSearchTerm !== deferredSearchTerm;
  const disableParentSelect =
    isParentOptionsLoading && parentOptions.length === 0;

  const handleParentSearchChange = React.useCallback((value: string) => {
    setParentSearchTerm(value);
  }, []);

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: async data => {
      toast({
        title: '创建成功',
        description: `分类 "${data.data?.name || '未知分类'}" 创建成功！`,
        variant: 'success',
        duration: 1500,
      });

      // 先移除旧缓存，再重新获取，确保数据是最新的
      await queryClient.removeQueries({
        queryKey: categoryQueryKeys.options(),
      });

      // ✅ 使用 refetchQueries 强制立即刷新，确保用户创建分类后立即看到新记录
      Promise.all([
        queryClient.refetchQueries({
          queryKey: categoryQueryKeys.lists(),
          type: 'active',
        }),
        queryClient.refetchQueries({
          queryKey: queryKeys.categories.lists(),
          type: 'active',
        }),
        // 主动重新获取分类选项数据，确保产品表单能立即看到新分类
        queryClient.refetchQueries({
          queryKey: categoryQueryKeys.options(),
          type: 'active',
        }),
      ]).catch(() => {
        // ignore cache invalidation errors
      });

      router.push('/categories');
      router.refresh();
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

  const handleSubmit = React.useCallback(
    (data: CreateCategoryData) => {
      const submitData = {
        ...data,
        parentId: data.parentId === 'none' ? undefined : data.parentId,
      };
      createMutation.mutate(submitData);
    },
    [createMutation]
  );

  const handleCancel = React.useCallback(() => {
    router.back();
  }, [router]);

  return {
    form,
    isCreating: createMutation.isPending,
    parentSearchTerm,
    onParentSearchChange: handleParentSearchChange,
    parentOptions,
    isParentOptionsLoading,
    disableParentSelect,
    onSubmit: handleSubmit,
    onCancel: handleCancel,
    onBack: handleCancel,
  };
}

function CreateCategoryView({
  form,
  isCreating,
  parentSearchTerm,
  onParentSearchChange,
  parentOptions,
  isParentOptionsLoading,
  disableParentSelect,
  onSubmit,
  onCancel,
  onBack,
}: CreateCategoryController) {
  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="space-y-6">
        <CreateCategoryHeader onBack={onBack} />
        <CreateCategoryForm
          form={form}
          isCreating={isCreating}
          parentSearchTerm={parentSearchTerm}
          onParentSearchChange={onParentSearchChange}
          parentOptions={parentOptions}
          isParentOptionsLoading={isParentOptionsLoading}
          disableParentSelect={disableParentSelect}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      </div>
    </div>
  );
}

function CreateCategoryHeader({ onBack }: { onBack: () => void }) {
  return (
    <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
      <CardContent className="bg-gradient-to-r from-slate-50 to-gray-50 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
              <FolderTree className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                新建分类
              </h1>
              <p className="text-sm text-gray-600">创建新的产品分类</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onBack}
            className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface CreateCategoryFormProps {
  form: UseFormReturn<CreateCategoryData>;
  isCreating: boolean;
  parentSearchTerm: string;
  onParentSearchChange: (value: string) => void;
  parentOptions: Category[];
  isParentOptionsLoading: boolean;
  disableParentSelect: boolean;
  onSubmit: (data: CreateCategoryData) => void;
  onCancel: () => void;
}

function CreateCategoryForm({
  form,
  isCreating,
  parentSearchTerm,
  onParentSearchChange,
  parentOptions,
  isParentOptionsLoading,
  disableParentSelect,
  onSubmit,
  onCancel,
}: CreateCategoryFormProps) {
  return (
    <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
      <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50">
        <CardTitle className="flex items-center text-gray-900">
          <FolderTree className="mr-2 h-5 w-5 text-blue-600" />
          分类信息
        </CardTitle>
        <CardDescription>
          填写分类的基本信息，包括名称、父级分类和排序顺序
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
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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

              <FormField
                control={form.control}
                name="parentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>父级分类</FormLabel>
                    <div className="space-y-3">
                      <Input
                        type="search"
                        value={parentSearchTerm}
                        onChange={event =>
                          onParentSearchChange(event.target.value)
                        }
                        placeholder="输入关键字搜索父级分类"
                        autoComplete="off"
                        aria-label="搜索父级分类"
                      />
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || 'none'}
                        disabled={disableParentSelect}
                      >
                        <FormControl>
                          <SelectTrigger className="relative">
                            <SelectValue placeholder="请选择父级分类" />
                            {isParentOptionsLoading && (
                              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                                <div className="border-muted-foreground h-3.5 w-3.5 animate-spin rounded-full border-2 border-t-transparent" />
                              </span>
                            )}
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">
                            <div className="flex items-center gap-2">
                              <span className="text-blue-600">🏠</span>
                              <span>无（顶级分类）</span>
                            </div>
                          </SelectItem>
                          {parentOptions.length === 0 ? (
                            <SelectItem value="__empty" disabled>
                              <span className="text-muted-foreground">
                                无匹配的分类
                              </span>
                            </SelectItem>
                          ) : (
                            parentOptions.map(category => (
                              <SelectItem key={category.id} value={category.id}>
                                <div className="flex items-center gap-2">
                                  {category.parent ? (
                                    <span className="ml-4 text-gray-400">
                                      ↳
                                    </span>
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
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <FormDescription>
                      选择父级分类以创建层级结构（最多支持3级）
                      <span className="mt-1 block text-xs text-blue-600">
                        💡 提示：不同父分类下可以有相同名称的子分类
                      </span>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                        onChange={event =>
                          field.onChange(parseInt(event.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormDescription>数字越小排序越靠前</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={onCancel}
                className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
              >
                <X className="mr-2 h-4 w-4" />
                取消
              </Button>
              <Button
                type="submit"
                size="lg"
                disabled={isCreating}
                className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
              >
                {isCreating ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    正在创建分类...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    创建分类
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
