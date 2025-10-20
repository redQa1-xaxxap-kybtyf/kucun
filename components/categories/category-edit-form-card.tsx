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
  SelectValue,
} from '@/components/ui/select';
import type { UpdateCategoryData } from '@/lib/validations/category';

export type ParentCategory = {
  id: string;
  name: string;
  parent?: { name: string } | null;
};

interface CategoryEditFormCardProps {
  form: UseFormReturn<UpdateCategoryData>;
  onSubmit: (data: UpdateCategoryData) => void;
  onCancel: () => void;
  parentCategories: ParentCategory[];
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
        <FolderTree className="mr-2 h-5 w-5 text-blue-600" />
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
  );
}

type CategoryFormControl = UseFormReturn<UpdateCategoryData>['control'];

interface CategoryEditFormBodyProps {
  form: UseFormReturn<UpdateCategoryData>;
  onSubmit: (data: UpdateCategoryData) => void;
  onCancel: () => void;
  parentCategories: ParentCategory[];
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
  isParentOptionsLoading,
  isSubmitting,
  parentSearchTerm,
  onParentSearchChange,
}: CategoryEditFormBodyProps) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <CategoryFormFieldGrid
          control={form.control}
          parentCategories={parentCategories}
          isParentOptionsLoading={isParentOptionsLoading}
          parentSearchTerm={parentSearchTerm}
          onParentSearchChange={onParentSearchChange}
        />
        <CategoryFormActions onCancel={onCancel} isSubmitting={isSubmitting} />
      </form>
    </Form>
  );
}

interface CategoryFormFieldGridProps {
  control: CategoryFormControl;
  parentCategories: ParentCategory[];
  isParentOptionsLoading: boolean;
  parentSearchTerm: string;
  onParentSearchChange: React.Dispatch<React.SetStateAction<string>>;
}

function CategoryFormFieldGrid({
  control,
  parentCategories,
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
  isLoading: boolean;
  parentSearchTerm: string;
  onParentSearchChange: React.Dispatch<React.SetStateAction<string>>;
}

function CategoryParentField({
  control,
  parentCategories,
  isLoading,
  parentSearchTerm,
  onParentSearchChange,
}: CategoryParentFieldProps) {
  const disableSelect = isLoading && parentCategories.length === 0;

  return (
    <FormField
      control={control}
      name="parentId"
      render={({ field }) => (
        <FormItem>
          <FormLabel>父级分类</FormLabel>
          <div className="space-y-3">
            <Input
              type="search"
              value={parentSearchTerm}
              onChange={event => onParentSearchChange(event.target.value)}
              placeholder="输入关键字搜索父级分类"
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
                  <SelectValue placeholder="请选择父级分类" />
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
                    <span className="text-blue-600">🏠</span>
                    <span>无（顶级分类）</span>
                  </div>
                </SelectItem>
                {parentCategories.length === 0 ? (
                  <SelectItem value="__empty" disabled>
                    <span className="text-muted-foreground">无匹配的分类</span>
                  </SelectItem>
                ) : (
                  parentCategories
                    .slice()
                    .sort((a, b) => {
                      const levelA = a.parent ? 1 : 0;
                      const levelB = b.parent ? 1 : 0;
                      if (levelA !== levelB) {
                        return levelA - levelB;
                      }
                      return a.name.localeCompare(b.name, 'zh-Hans-CN');
                    })
                    .map(category => (
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
