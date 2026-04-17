'use client';

import { FolderTree, Save, X } from 'lucide-react';
import * as React from 'react';
import type { UseFormReturn } from 'react-hook-form';

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
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import type { UpdateCategoryData } from '@/lib/validations/category';

export type ParentCategory = {
  id: string;
  name: string;
  code?: string;
  fullPath?: string;
  depth?: number;
  parent?: { name: string } | null;
};

export type CategoryCurrentInfo = {
  code?: string;
  fullPath?: string;
};

interface CategoryEditFormCardProps {
  form: UseFormReturn<UpdateCategoryData>;
  onSubmit: (data: UpdateCategoryData) => void;
  onCancel: () => void;
  parentCategories: ParentCategory[];
  currentParentCategory?: ParentCategory;
  currentCategoryInfo?: CategoryCurrentInfo;
  isParentOptionsLoading: boolean;
  isSubmitting: boolean;
  parentSearchTerm: string;
  onParentSearchChange: React.Dispatch<React.SetStateAction<string>>;
}

export function CategoryEditFormCard({
  form,
  onSubmit,
  onCancel,
  parentCategories,
  currentParentCategory,
  currentCategoryInfo,
  isParentOptionsLoading,
  isSubmitting,
  parentSearchTerm,
  onParentSearchChange,
}: CategoryEditFormCardProps) {
  return (
    <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
      <CategoryFormCardHeader />
      <CategoryFormGuidance />
      <CardContent className="p-6">
        <CategoryEditFormBody
          form={form}
          onSubmit={onSubmit}
          onCancel={onCancel}
          parentCategories={parentCategories}
          currentParentCategory={currentParentCategory}
          currentCategoryInfo={currentCategoryInfo}
          isParentOptionsLoading={isParentOptionsLoading}
          isSubmitting={isSubmitting}
          parentSearchTerm={parentSearchTerm}
          onParentSearchChange={onParentSearchChange}
        />
      </CardContent>
    </Card>
  );
}

function CategoryFormCardHeader() {
  return (
    <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50">
      <CardTitle className="flex items-center text-gray-900">
        <FolderTree className="mr-2 h-5 w-5 text-[hsl(var(--color-primary))]" />
        分类信息
      </CardTitle>
      <CardDescription>
        修改分类的基本信息，包括名称、父级分类和排序顺序
      </CardDescription>
    </CardHeader>
  );
}

function CategoryFormGuidance() {
  return (
    <div className="border-b bg-[hsl(var(--color-info-light))] px-6 py-3">
      <div className="flex items-start gap-2 text-sm">
        <span className="text-[hsl(var(--color-info))]">ℹ️</span>
        <div className="flex-1 text-[hsl(var(--color-info))]">
          <strong>分类层级规则：</strong>
          <ul className="mt-1 ml-4 list-disc space-y-1 text-xs">
            <li>支持最多3级分类（例如：抛光砖 → 系列A → 款式1）</li>
            <li>不同父分类下可以创建相同名称的子分类</li>
            <li>编码会自动生成，并可在列表或编辑页直接查看</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

type CategoryFormControl = UseFormReturn<UpdateCategoryData>['control'];

interface CategoryEditFormBodyProps {
  form: UseFormReturn<UpdateCategoryData>;
  onSubmit: (data: UpdateCategoryData) => void;
  onCancel: () => void;
  parentCategories: ParentCategory[];
  currentParentCategory?: ParentCategory;
  currentCategoryInfo?: CategoryCurrentInfo;
  isParentOptionsLoading: boolean;
  isSubmitting: boolean;
  parentSearchTerm: string;
  onParentSearchChange: React.Dispatch<React.SetStateAction<string>>;
}

function CategoryEditFormBody({
  form,
  onSubmit,
  onCancel,
  parentCategories,
  currentParentCategory,
  currentCategoryInfo,
  isParentOptionsLoading,
  isSubmitting,
  parentSearchTerm,
  onParentSearchChange,
}: CategoryEditFormBodyProps) {
  const hasUnsavedChanges = form.formState.isDirty && !isSubmitting;
  const { confirmLeavePage } = useUnsavedChangesGuard({
    enabled: hasUnsavedChanges,
    message: '当前分类内容尚未保存，确定要离开吗？',
  });

  React.useEffect(() => {
    if (!currentParentCategory || form.formState.isDirty) {
      return;
    }

    const currentParentId = form.getValues('parentId');
    if (currentParentId && currentParentId !== 'none') {
      return;
    }

    form.setValue('parentId', currentParentCategory.id, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
  }, [currentParentCategory, form, form.formState.isDirty]);

  const handleCancel = () => {
    if (!confirmLeavePage()) {
      return;
    }

    onCancel();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <CategoryCurrentInfoPanel currentCategoryInfo={currentCategoryInfo} />
        <CategoryFormFieldGrid
          control={form.control}
          parentCategories={parentCategories}
          currentParentCategory={currentParentCategory}
          isParentOptionsLoading={isParentOptionsLoading}
          parentSearchTerm={parentSearchTerm}
          onParentSearchChange={onParentSearchChange}
        />
        <CategoryFormActions
          onCancel={handleCancel}
          isSubmitting={isSubmitting}
        />
      </form>
    </Form>
  );
}

function CategoryCurrentInfoPanel({
  currentCategoryInfo,
}: {
  currentCategoryInfo?: CategoryCurrentInfo;
}) {
  if (!currentCategoryInfo?.code && !currentCategoryInfo?.fullPath) {
    return null;
  }

  return (
    <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
      <div className="space-y-1">
        <div className="text-xs font-medium tracking-wide text-slate-500">
          当前分类路径
        </div>
        <div className="text-sm font-medium text-slate-900">
          {currentCategoryInfo.fullPath ?? '-'}
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-xs font-medium tracking-wide text-slate-500">
          当前分类编码
        </div>
        <div className="text-sm font-medium text-slate-900">
          {currentCategoryInfo.code ?? '-'}
        </div>
      </div>
    </div>
  );
}

interface CategoryFormFieldGridProps {
  control: CategoryFormControl;
  parentCategories: ParentCategory[];
  currentParentCategory?: ParentCategory;
  isParentOptionsLoading: boolean;
  parentSearchTerm: string;
  onParentSearchChange: React.Dispatch<React.SetStateAction<string>>;
}

function CategoryFormFieldGrid({
  control,
  parentCategories,
  currentParentCategory,
  isParentOptionsLoading,
  parentSearchTerm,
  onParentSearchChange,
}: CategoryFormFieldGridProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <CategoryNameField control={control} />
      <CategoryParentField
        control={control}
        parentCategories={parentCategories}
        currentParentCategory={currentParentCategory}
        isLoading={isParentOptionsLoading}
        parentSearchTerm={parentSearchTerm}
        onParentSearchChange={onParentSearchChange}
      />
      <CategorySortOrderField control={control} />
    </div>
  );
}

function CategoryNameField({ control }: { control: CategoryFormControl }) {
  return (
    <FormField
      control={control}
      name="name"
      render={({ field }) => (
        <FormItem>
          <FormLabel>分类名称 *</FormLabel>
          <FormControl>
            <Input placeholder="请输入分类名称" {...field} />
          </FormControl>
          <FormDescription>分类的显示名称，最多50个字符</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

interface CategoryParentFieldProps {
  control: CategoryFormControl;
  parentCategories: ParentCategory[];
  currentParentCategory?: ParentCategory;
  isLoading: boolean;
  parentSearchTerm: string;
  onParentSearchChange: React.Dispatch<React.SetStateAction<string>>;
}

function CategoryParentField({
  control,
  parentCategories,
  currentParentCategory,
  isLoading,
  parentSearchTerm,
  onParentSearchChange,
}: CategoryParentFieldProps) {
  const disableSelect = isLoading && parentCategories.length === 0;
  const availableParentCategories = React.useMemo(() => {
    if (!currentParentCategory) {
      return parentCategories;
    }

    if (parentCategories.some(category => category.id === currentParentCategory.id)) {
      return parentCategories;
    }

    return [currentParentCategory, ...parentCategories];
  }, [currentParentCategory, parentCategories]);

  return (
    <FormField
      control={control}
      name="parentId"
      render={({ field }) => {
        const selectedParent =
          availableParentCategories.find(category => category.id === field.value) ??
          (currentParentCategory?.id === field.value
            ? currentParentCategory
            : undefined);
        const displayParentPath =
          selectedParent?.fullPath ?? selectedParent?.name ?? '请选择父级分类';

        return (
          <FormItem>
            <FormLabel>父级分类</FormLabel>
            <div className="space-y-3">
              <Input
                type="search"
                value={parentSearchTerm}
                onChange={event => onParentSearchChange(event.target.value)}
                placeholder="输入分类名称或编码搜索父级分类"
                autoComplete="off"
                aria-label="搜索父级分类"
              />
              <Select
                onValueChange={field.onChange}
                value={field.value || 'none'}
                disabled={disableSelect}
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
                        ? displayParentPath
                        : '请选择父级分类'}
                    </span>
                    {isLoading && (
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                        <div className="border-muted-foreground h-3.5 w-3.5 animate-spin rounded-full border-2 border-t-transparent" />
                      </span>
                    )}
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">
                    <div className="flex items-center gap-2">
                      <span className="text-[hsl(var(--color-primary))]">
                        🏠
                      </span>
                      <span>无（顶级分类）</span>
                    </div>
                  </SelectItem>
                  {availableParentCategories.length === 0 ? (
                    <SelectItem value="__empty" disabled>
                      <span className="text-muted-foreground">
                        无匹配的分类
                      </span>
                    </SelectItem>
                  ) : (
                    availableParentCategories
                      .slice()
                      .sort((a, b) =>
                        (a.fullPath ?? a.name).localeCompare(
                          b.fullPath ?? b.name,
                          'zh-Hans-CN'
                        )
                      )
                      .map(category => (
                        <SelectItem key={category.id} value={category.id}>
                          <div className="min-w-0 py-1">
                            <div className="flex items-center gap-2">
                              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                                {(category.depth ?? 1) === 1
                                  ? '一级'
                                  : (category.depth ?? 1) === 2
                                    ? '二级'
                                    : '三级'}
                              </span>
                              <span className="truncate font-medium">
                                {category.name}
                              </span>
                              {category.code && (
                                <span className="truncate text-xs text-gray-400">
                                  {category.code}
                                </span>
                              )}
                            </div>
                            <div className="truncate text-xs text-gray-500">
                              {category.fullPath ?? category.name}
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
              <span className="mt-1 block text-xs text-[hsl(var(--color-info))]">
                提示：可输入分类名称或编码搜索，编码自动生成并可在列表或当前页面查看
              </span>
            </FormDescription>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

function CategorySortOrderField({ control }: { control: CategoryFormControl }) {
  return (
    <FormField
      control={control}
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
  );
}

interface CategoryFormActionsProps {
  onCancel: () => void;
  isSubmitting: boolean;
}

function CategoryFormActions({
  onCancel,
  isSubmitting,
}: CategoryFormActionsProps) {
  return (
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
        disabled={isSubmitting}
        className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
      >
        {isSubmitting ? (
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
  );
}
