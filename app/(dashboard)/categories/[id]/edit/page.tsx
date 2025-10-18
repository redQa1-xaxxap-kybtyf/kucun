'use client';

/**
 * 编辑分类页面
 * 严格遵循全栈项目统一约定规范
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FolderTree } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { use } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import {
  CategoryEditFormCard,
  type ParentCategory,
} from '@/components/categories/category-edit-form-card';
import { ContentLoading } from '@/components/common/loading';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
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

type CategoryDetail = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
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

  const {
    category,
    isCategoryLoading,
    categoryError,
    parentCategories,
    isCategoriesLoading,
  } = useCategoryData(categoryId);

  const categoryData = category?.data as CategoryDetail | undefined;
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
        parentId: data.parentId === 'none' ? undefined : data.parentId,
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
          isCategoriesLoading={isCategoriesLoading}
          isSubmitting={updateMutation.isPending}
        />
      </div>
    </div>
  );
}

function useCategoryData(categoryId: string) {
  const categoryQuery = useQuery({
    queryKey: queryKeys.categories.detail(categoryId),
    queryFn: () => getCategory(categoryId),
  });

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories.list({
      status: 'active',
      exclude: categoryId,
    }),
    queryFn: () => getCategories({ status: 'active', limit: 100 }),
    enabled: !!categoryId,
  });

  const parentCategories = React.useMemo(() => {
    const categories = (categoriesQuery.data?.data || []) as ParentCategory[];
    return categories.filter(cat => cat.id !== categoryId);
  }, [categoriesQuery.data, categoryId]);

  return {
    category: categoryQuery.data,
    isCategoryLoading: categoryQuery.isLoading,
    categoryError: categoryQuery.error,
    parentCategories,
    isCategoriesLoading: categoriesQuery.isLoading,
  };
}

function useCategoryForm(categoryData?: CategoryDetail) {
  const form = useForm<UpdateCategoryData>({
    resolver: zodResolver(UpdateCategorySchema),
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

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.categories.all }),
        queryClient.refetchQueries({
          queryKey: queryKeys.categories.detail(categoryId),
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
