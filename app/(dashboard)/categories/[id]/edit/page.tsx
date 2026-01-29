'use client';

/**
 * 编辑分类页面
 * 严格遵循全栈项目统一约定规范
 */

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FolderTree } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import React, { use } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import type { ParentCategory } from '@/components/categories/category-edit-form-card';
import { ContentLoading } from '@/components/common/loading';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import {
  categoryQueryKeys,
  getCategories,
  getCategory,
  updateCategory,
} from '@/lib/api/categories';
import { paginationConfig } from '@/lib/env';
import { queryKeys } from '@/lib/queryKeys';
import { UpdateCategorySchema } from '@/lib/validations/category';

type UpdateCategoryData = z.infer<typeof UpdateCategorySchema>;

const CategoryEditFormCard = dynamic(
  () =>
    import('@/components/categories/category-edit-form-card').then(
      mod => mod.CategoryEditFormCard
    ),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
        表单加载中...
      </div>
    ),
  }
);

interface CategoryEditPageProps {
  params: Promise<{ id: string }>;
}

type CategoryDetail = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  parent?: {
    id: string;
    name: string;
  } | null;
};

interface CategoryEditContentProps {
  categoryId: string;
}

interface UpdateMutationOptions {
  categoryId: string;
  router: ReturnType<typeof useRouter>;
  queryClient: ReturnType<typeof useQueryClient>;
  toast: ReturnType<typeof useToast>['toast'];
}

/**
 * 编辑分类页面组件
 */
export default function CategoryEditPage({ params }: CategoryEditPageProps) {
  const { id: categoryId } = use(params);

  return <CategoryEditContent categoryId={categoryId} />;
}

function CategoryEditContent({ categoryId }: CategoryEditContentProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [parentSearchTerm, setParentSearchTerm] = React.useState('');
  const deferredParentSearchTerm = React.useDeferredValue(parentSearchTerm);

  const {
    categoryData,
    isCategoryLoading,
    categoryError,
    parentCategories,
    areParentOptionsLoading,
  } = useCategoryData(categoryId, deferredParentSearchTerm);

  const form = useCategoryForm(categoryData);

  const updateMutation = useUpdateCategoryMutation({
    categoryId,
    router,
    queryClient,
    toast,
  });

  const handleSubmit = React.useCallback(
    (data: UpdateCategoryData) => {
      const submitData = {
        ...data,
        parentId: data.parentId === 'none' ? null : data.parentId,
      };
      updateMutation.mutate(submitData);
    },
    [updateMutation]
  );

  if (isCategoryLoading) {
    return <CategoryEditLoadingState />;
  }

  if (categoryError) {
    const errorMessage =
      categoryError instanceof Error ? categoryError.message : '未知错误';
    return (
      <CategoryEditErrorState
        onBack={() => router.back()}
        errorMessage={errorMessage}
      />
    );
  }

  if (!categoryData) {
    return null;
  }

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        <CategoryEditHeader onBack={() => router.back()} />
        <CategoryEditFormCard
          form={form}
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
          parentCategories={parentCategories}
          isParentOptionsLoading={
            areParentOptionsLoading ||
            parentSearchTerm !== deferredParentSearchTerm
          }
          isSubmitting={updateMutation.isPending}
          parentSearchTerm={parentSearchTerm}
          onParentSearchChange={setParentSearchTerm}
        />
      </div>
    </div>
  );
}

function useCategoryData(categoryId: string, parentSearch: string) {
  const categoryQuery = useQuery({
    queryKey: queryKeys.categories.detail(categoryId),
    queryFn: () => getCategory(categoryId),
  });

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories.list({
      status: 'active',
      exclude: categoryId,
      search: parentSearch || undefined,
      limit: paginationConfig.maxPageSize,
    }),
    queryFn: () =>
      getCategories({
        status: 'active',
        limit: paginationConfig.maxPageSize,
        search: parentSearch || undefined,
      }),
    enabled: !!categoryId,
  });

  const categoryData = categoryQuery.data?.data as CategoryDetail | undefined;

  const parentCategories = React.useMemo(() => {
    type ParentWithParentId = ParentCategory & { parentId?: string | null };

    const categories = (categoriesQuery.data?.data ||
      []) as ParentWithParentId[];

    if (!categories.length) {
      return [] as ParentCategory[];
    }

    const byId = new Map<string, ParentWithParentId>();
    const depthCache = new Map<string, number>();

    categories.forEach(cat => {
      byId.set(cat.id, cat);
    });

    const computeDepth = (
      category: ParentWithParentId,
      ancestry = new Set<string>()
    ): number => {
      const cached = depthCache.get(category.id);
      if (cached !== undefined) {
        return cached;
      }

      if (!category.parentId) {
        depthCache.set(category.id, 1);
        return 1;
      }

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

    // 过滤掉自身以及深度已达 3 级的分类（避免选择为父级后变成第4级）
    let filtered: ParentCategory[] = categories
      .filter(cat => cat.id !== categoryId)
      .filter(cat => computeDepth(cat) < MAX_DEPTH);

    // 确保当前父级始终在列表中（即便它是因筛选被过滤的旧数据）
    if (
      categoryData?.parent &&
      !filtered.some(cat => cat.id === categoryData.parent?.id)
    ) {
      filtered = [
        {
          id: categoryData.parent.id,
          name: categoryData.parent.name,
          parent: null,
        },
        ...filtered,
      ];
    }

    return filtered;
  }, [categoriesQuery.data, categoryId, categoryData?.parent]);

  return {
    categoryData,
    isCategoryLoading: categoryQuery.isLoading,
    categoryError: categoryQuery.error,
    parentCategories,
    areParentOptionsLoading: categoriesQuery.isFetching,
  };
}

function useCategoryForm(categoryData?: CategoryDetail) {
  const form = useForm<UpdateCategoryData>({
    resolver: standardSchemaResolver(UpdateCategorySchema),
    defaultValues: {
      id: '',
      name: '',
      parentId: undefined,
      sortOrder: 0,
    },
  });

  React.useEffect(() => {
    if (!categoryData) {
      return;
    }

    form.reset({
      id: categoryData.id,
      name: categoryData.name,
      parentId: categoryData.parentId ?? 'none',
      sortOrder: categoryData.sortOrder,
    });
  }, [categoryData, form]);

  return form;
}

function useUpdateCategoryMutation({
  categoryId,
  router,
  queryClient,
  toast,
}: UpdateMutationOptions) {
  return useMutation({
    mutationFn: updateCategory,
    onSuccess: async data => {
      toast({
        title: '更新成功',
        description: `分类 "${data.data?.name || '未知分类'}" 更新成功！所有修改已保存。`,
        variant: 'success',
        duration: 1500,
      });

      // 先移除旧缓存，再重新获取，确保数据是最新的
      await queryClient.removeQueries({
        queryKey: categoryQueryKeys.options(),
      });

      // ✅ 使用 refetchQueries 强制立即刷新，确保用户更新分类后立即看到变化
      await Promise.all([
        queryClient.refetchQueries({
          queryKey: queryKeys.categories.all,
          type: 'active',
        }),
        queryClient.refetchQueries({
          queryKey: queryKeys.categories.detail(categoryId),
          type: 'active',
        }),
        // 主动重新获取分类选项数据，确保产品表单能立即看到更新后的分类
        queryClient.refetchQueries({
          queryKey: categoryQueryKeys.options(),
          type: 'active',
        }),
      ]);

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
}

function CategoryEditHeader({ onBack }: { onBack: () => void }) {
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
                编辑分类
              </h1>
              <p className="text-sm text-gray-600">修改分类信息</p>
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

function CategoryEditLoadingState() {
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

interface CategoryEditErrorStateProps {
  onBack: () => void;
  errorMessage: string;
}

function CategoryEditErrorState({
  onBack,
  errorMessage,
}: CategoryEditErrorStateProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
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
            加载失败: {errorMessage}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
