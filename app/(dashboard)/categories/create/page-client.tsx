'use client';

/**
 * 新建分类页面
 * 严格遵循全栈项目统一约定规范
 */

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FolderTree, Save, ShieldAlert, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import * as React from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  categoryQueryKeys,
  createCategory,
  getCategories,
  type Category,
} from '@/lib/api/categories';
import { can } from '@/lib/auth/permissions';
import { paginationConfig } from '@/lib/config/pagination';
import { queryKeys } from '@/lib/queryKeys';
import { buildCategoryPathMap } from '@/lib/utils/category-utils';
import { getFriendlyErrorMessage } from '@/lib/utils/user-friendly-error';
import { CreateCategorySchema } from '@/lib/validations/category';

// 表单层使用 Zod 输入类型（允许 schema 默认值和可选字段），
// 以便与 standardSchemaResolver 返回的 Resolver 类型完全对齐。
type CreateCategoryData = z.input<typeof CreateCategorySchema>;
type ParentCategoryOption = Category & {
  depth: number;
  fullPath: string;
};

/**
 * 新建分类页面组件
 * 包含权限检查，确保用户有创建分类的权限
 */
export default function CreateCategoryPage() {
  const { data: session, status } = useSession();
  const controller = useCreateCategoryController();

  // 加载中状态
  if (status === 'loading') {
    return <LoadingState />;
  }

  // 未登录状态
  if (status === 'unauthenticated' || !session?.user) {
    return <UnauthorizedState />;
  }

  // 权限检查
  const hasPermission = can(session.user, 'categories:create');

  if (!hasPermission) {
    return <NoPermissionState userRole={session.user.role} />;
  }

  // 有权限，显示创建表单
  return <CreateCategoryView {...controller} />;
}

/**
 * 加载中状态组件
 */
function LoadingState() {
  return (
    <div className="flex h-[50vh] items-center justify-center">
      <div className="text-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
        <p className="text-muted-foreground mt-4 text-sm">加载中...</p>
      </div>
    </div>
  );
}

/**
 * 未登录状态组件
 */
function UnauthorizedState() {
  return (
    <div className="container mx-auto max-w-4xl py-8">
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>需要登录</AlertTitle>
        <AlertDescription>
          请先登录后再创建分类。
          <Link
            href="/auth/signin?callbackUrl=/categories/create"
            className="ml-2 underline"
          >
            前往登录
          </Link>
        </AlertDescription>
      </Alert>
      <div className="mt-6 flex gap-4">
        <Button variant="outline" asChild>
          <Link href="/categories">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回分类列表
          </Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * 权限不足状态组件
 */
function NoPermissionState({ userRole }: { userRole: string }) {
  const roleDisplayName =
    userRole === 'admin'
      ? '管理员'
      : userRole === 'sales'
        ? '销售员'
        : userRole === 'warehouse'
          ? '仓库员'
          : userRole === 'finance'
            ? '财务员'
            : userRole;

  return (
    <div className="container mx-auto max-w-4xl py-8">
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>权限不足</AlertTitle>
        <AlertDescription>
          您没有创建分类的权限，请联系管理员。
          <div className="mt-2 text-sm">
            <p>
              当前角色：<span className="font-medium">{roleDisplayName}</span>
            </p>
            <p className="text-muted-foreground mt-1">
              所需权限：创建分类（categories:create）
            </p>
          </div>
        </AlertDescription>
      </Alert>
      <div className="mt-6 flex gap-4">
        <Button variant="outline" asChild>
          <Link href="/categories">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回分类列表
          </Link>
        </Button>
      </div>
    </div>
  );
}

interface CreateCategoryController {
  form: UseFormReturn<CreateCategoryData>;
  isCreating: boolean;
  parentSearchTerm: string;
  onParentSearchChange: (value: string) => void;
  parentOptions: ParentCategoryOption[];
  isParentOptionsLoading: boolean;
  disableParentSelect: boolean;
  onSubmit: (data: CreateCategoryData) => void;
  onCancel: () => void;
  onBack: () => void;
}

function useCreateCategoryController(): CreateCategoryController {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [parentSearchTerm, setParentSearchTerm] = React.useState('');
  const deferredSearchTerm = React.useDeferredValue(parentSearchTerm);
  const presetParentId = searchParams.get('parentId');
  const presetAppliedRef = React.useRef(false);

  const form = useForm<CreateCategoryData, any, CreateCategoryData>({
    resolver: standardSchemaResolver(CreateCategorySchema),
    defaultValues: {
      name: '',
      status: 'active',
      parentId: 'none',
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
      limit: paginationConfig.maxPageSize,
    }),
    queryFn: () =>
      getCategories({
        status: 'active',
        limit: paginationConfig.maxPageSize,
      }),
  });

  /**
   * 构建父级分类下拉选项
   *
   * 规则：
   * - 允许选择的父级分类最多为第2级（这样新建分类最多到第3级）
   * - 第3级分类不能再作为父级，避免出现第4级分类
   * - 按层级 + 排序值 + 名称排序，方便选择
   */
  const parentOptions = React.useMemo(() => {
    const categories = (categoriesResponse?.data ?? []) as Category[];
    if (!categories.length) return [];

    const byId = new Map<string, Category>();
    const depthCache = new Map<string, number>();

    categories.forEach(category => {
      byId.set(category.id, category);
    });

    const computeDepth = (
      category: Category,
      ancestry = new Set<string>()
    ): number => {
      const cached = depthCache.get(category.id);
      if (cached !== undefined) {
        return cached;
      }

      // 顶级分类：深度为 1
      if (!category.parentId) {
        depthCache.set(category.id, 1);
        return 1;
      }

      // 防止循环引用
      if (ancestry.has(category.id)) {
        depthCache.set(category.id, 1);
        return 1;
      }

      ancestry.add(category.id);
      const parent = category.parentId
        ? byId.get(category.parentId)
        : undefined;

      if (!parent) {
        depthCache.set(category.id, 2);
        ancestry.delete(category.id);
        return 2;
      }

      const depth = computeDepth(parent, ancestry) + 1;
      depthCache.set(category.id, depth);
      ancestry.delete(category.id);
      return depth;
    };

    const MAX_DEPTH = 3;
    const pathById = buildCategoryPathMap(categories);
    const normalizedSearch = deferredSearchTerm.trim().toLowerCase();

    // 计算每个分类的深度，并只保留可作为父级的分类（最多到第 2 级）
    const withDepth = categories
      .map(category => ({
        ...category,
        depth: computeDepth(category),
        fullPath: pathById.get(category.id) ?? category.name,
      }))
      // 只允许选择深度小于 3 的分类作为父级（顶级 / 二级）
      .filter(category => category.depth < MAX_DEPTH)
      .filter(category => {
        if (!normalizedSearch) {
          return true;
        }

        const searchText =
          `${category.name} ${category.code} ${category.fullPath}`.toLowerCase();
        return searchText.includes(normalizedSearch);
      });

    /**
     * 为了让 2 级分类“挂在”对应的 1 级分类下面显示，
     * 我们在排序时优先按顶级父分类分组，然后在组内按层级和排序值排列。
     */
    const getRootCategory = (category: Category & { depth: number }) => {
      let current: Category | undefined = category;
      const visited = new Set<string>();

      while (current?.parentId) {
        if (visited.has(current.id)) break;
        visited.add(current.id);
        const parent = byId.get(current.parentId);
        if (!parent) break;
        current = parent;
      }

      return current ?? category;
    };

    return withDepth.sort((a, b) => {
      const rootA = getRootCategory(a);
      const rootB = getRootCategory(b);

      // 1) 先按顶级父分类分组：同一个 1 级分类的所有子分类挨在一起
      if (rootA.id !== rootB.id) {
        const rootSortA =
          typeof rootA.sortOrder === 'number'
            ? rootA.sortOrder
            : Number.MAX_SAFE_INTEGER;
        const rootSortB =
          typeof rootB.sortOrder === 'number'
            ? rootB.sortOrder
            : Number.MAX_SAFE_INTEGER;

        if (rootSortA !== rootSortB) {
          return rootSortA - rootSortB;
        }

        return rootA.name.localeCompare(rootB.name, 'zh-Hans-CN');
      }

      // 2) 同一棵树内部：1 级在前，2 级紧跟其后
      if (a.depth !== b.depth) {
        return a.depth - b.depth;
      }

      // 3) 同层级内部：按 sortOrder + 名称排序
      const sortOrderA =
        typeof a.sortOrder === 'number' ? a.sortOrder : Number.MAX_SAFE_INTEGER;
      const sortOrderB =
        typeof b.sortOrder === 'number' ? b.sortOrder : Number.MAX_SAFE_INTEGER;

      if (sortOrderA !== sortOrderB) {
        return sortOrderA - sortOrderB;
      }

      return a.name.localeCompare(b.name, 'zh-Hans-CN');
    });
  }, [categoriesResponse?.data, deferredSearchTerm]);

  const isParentOptionsLoading =
    isLoading || isFetching || parentSearchTerm !== deferredSearchTerm;
  const disableParentSelect =
    isParentOptionsLoading && parentOptions.length === 0;

  React.useEffect(() => {
    if (presetAppliedRef.current) return;
    if (!presetParentId) return;
    if (!parentOptions.some(category => category.id === presetParentId)) return;

    form.setValue('parentId', presetParentId, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: true,
    });
    presetAppliedRef.current = true;
  }, [form, parentOptions, presetParentId]);

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
      const errorMessage = getFriendlyErrorMessage(
        error,
        '创建分类失败，请稍后重试'
      );
      const title = errorMessage.includes('登录')
        ? '需要登录'
        : errorMessage.includes('权限')
          ? '权限不足'
          : errorMessage.includes('网络')
            ? '网络连接失败'
            : errorMessage.includes('服务器') || errorMessage.includes('服务')
              ? '服务器错误'
              : errorMessage.includes('已存在') ||
                  errorMessage.includes('不能为空') ||
                  errorMessage.includes('不能超过') ||
                  errorMessage.includes('校验') ||
                  errorMessage.includes('层级')
                ? '数据验证失败'
                : '创建失败';

      toast({
        title,
        description: errorMessage,
        variant: 'destructive',
        duration: title === '数据验证失败' ? 4000 : 3000,
      });
    },
  });

  const handleSubmit = React.useCallback(
    (data: CreateCategoryData) => {
      const normalizedCode =
        data.code && data.code.trim().length > 0 ? data.code.trim() : undefined;
      const submitData = {
        ...data,
        code: normalizedCode,
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
  parentOptions: ParentCategoryOption[];
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
              <li>编码会自动生成，创建后可在分类列表查看，无需手动记忆</li>
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
                render={({ field }) => {
                  const selectedParent = parentOptions.find(
                    category => category.id === field.value
                  );

                  return (
                    <FormItem>
                      <FormLabel>父级分类</FormLabel>
                      <div className="space-y-3">
                        <Input
                          type="search"
                          value={parentSearchTerm}
                          onChange={event =>
                            onParentSearchChange(event.target.value)
                          }
                          placeholder="输入分类名称或编码搜索父级分类"
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
                              <span
                                className={`block truncate pr-6 text-left ${
                                  field.value && field.value !== 'none'
                                    ? 'text-foreground'
                                    : 'text-muted-foreground'
                                }`}
                              >
                                {field.value && field.value !== 'none'
                                  ? (selectedParent?.fullPath ??
                                    '请选择父级分类')
                                  : '请选择父级分类'}
                              </span>
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
                                <SelectItem
                                  key={category.id}
                                  value={category.id}
                                >
                                  <div className="min-w-0 py-1">
                                    <div className="flex items-center gap-2">
                                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                                        {category.depth === 1
                                          ? '一级'
                                          : category.depth === 2
                                            ? '二级'
                                            : '三级'}
                                      </span>
                                      <span className="truncate font-medium">
                                        {category.name}
                                      </span>
                                      <span className="truncate text-xs text-gray-400">
                                        {category.code}
                                      </span>
                                    </div>
                                    <div className="truncate text-xs text-gray-500">
                                      {category.fullPath}
                                    </div>
                                  </div>
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <FormDescription>
                        选择父级分类以创建层级结构（最多支持3级），系统会显示完整路径，避免同名分类选错
                        <span className="mt-1 block text-xs text-blue-600">
                          提示：可输入分类名称或编码搜索，编码会自动生成，创建后可在分类列表查看
                        </span>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  );
                }}
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
