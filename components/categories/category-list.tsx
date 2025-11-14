'use client';

/**
 * 分类列表组件
 * 严格遵循全栈项目统一约定规范
 *
 * 优化说明:
 * - 基于 parentId 预计算层级关系
 * - 通过缩进和视觉指示器清晰展示分类层级
 * - 支持多级嵌套(最多3级)的友好显示
 * - 增强信息展示:编码、排序、描述、更新时间
 * - 优化操作交互:状态切换改为Switch,常用操作独立显示
 */

import { Edit, MoreHorizontal, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Category } from '@/lib/api/categories';
import { formatDateTime } from '@/lib/utils/datetime';

interface CategoryListProps {
  categories: Category[];
  updatingStatusId: string | null;
  onToggleStatus: (category: Category) => void;
  onDeleteCategory: (categoryId: string, categoryName: string) => void;
}

/**
 * 带层级信息的分类类型
 */
interface CategoryWithLevel extends Category {
  level: number;
}

type LevelStyle = { color: string; bg: string; badge: string };

const LEVEL_STYLES: LevelStyle[] = [
  { color: 'text-gray-900', bg: 'bg-blue-50/30', badge: 'L1' },
  { color: 'text-blue-700', bg: 'bg-blue-50/50', badge: 'L2' },
  { color: 'text-purple-600', bg: 'bg-purple-50/50', badge: 'L3' },
];

function buildCategoriesWithLevel(categories: Category[]): CategoryWithLevel[] {
  const byId = new Map<string, Category>();
  const levelCache = new Map<string, number>();

  categories.forEach(category => {
    byId.set(category.id, category);
  });

  const computeLevel = (
    category: Category,
    ancestry = new Set<string>()
  ): number => {
    const cached = levelCache.get(category.id);
    if (cached !== undefined) {
      return cached;
    }

    if (!category.parentId) {
      levelCache.set(category.id, 0);
      return 0;
    }

    if (ancestry.has(category.id)) {
      levelCache.set(category.id, 0);
      return 0;
    }

    ancestry.add(category.id);
    const parent = byId.get(category.parentId);

    if (!parent) {
      levelCache.set(category.id, 1);
      ancestry.delete(category.id);
      return 1;
    }

    const level = Math.min(computeLevel(parent, ancestry) + 1, 10);
    levelCache.set(category.id, level);
    ancestry.delete(category.id);
    return level;
  };

  return categories.map(category => ({
    ...category,
    level: computeLevel(category),
  }));
}

export function CategoryList({
  categories,
  updatingStatusId,
  onToggleStatus,
  onDeleteCategory,
}: CategoryListProps) {
  const router = useRouter();

  const categoriesWithLevel = useMemo<CategoryWithLevel[]>(() => {
    const withLevel = buildCategoriesWithLevel(categories);
    return withLevel.slice().sort((a, b) => {
      if (a.level !== b.level) {
        return a.level - b.level;
      }

      const sortOrderA =
        typeof a.sortOrder === 'number' ? a.sortOrder : Number.MAX_SAFE_INTEGER;
      const sortOrderB =
        typeof b.sortOrder === 'number' ? b.sortOrder : Number.MAX_SAFE_INTEGER;

      if (sortOrderA !== sortOrderB) {
        return sortOrderA - sortOrderB;
      }

      return a.name.localeCompare(b.name, 'zh-Hans-CN');
    });
  }, [categories]);

  const handleEdit = useMemo(
    () => (categoryId: string) => router.push(`/categories/${categoryId}/edit`),
    [router]
  );

  if (categories.length === 0) {
    return (
      <Card className="shadow-lg shadow-gray-200/50">
        <CardHeader>
          <CardTitle>分类列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground py-8 text-center">
            暂无分类数据
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-white shadow-lg shadow-gray-200/50">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50/50">
            <TableHead className="w-[280px]">分类名称</TableHead>
            <TableHead className="w-[80px]">排序</TableHead>
            <TableHead className="w-[100px]">产品数量</TableHead>
            <TableHead className="w-[120px]">状态</TableHead>
            <TableHead className="w-[150px]">创建时间</TableHead>
            <TableHead className="w-[150px]">更新时间</TableHead>
            <TableHead className="w-[120px] text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categoriesWithLevel.map(category => (
            <CategoryRow
              key={category.id}
              category={category}
              updatingStatusId={updatingStatusId}
              onToggleStatus={onToggleStatus}
              onDeleteCategory={onDeleteCategory}
              onEditCategory={handleEdit}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

interface CategoryRowProps {
  category: CategoryWithLevel;
  updatingStatusId: string | null;
  onToggleStatus: (category: Category) => void;
  onDeleteCategory: (categoryId: string, categoryName: string) => void;
  onEditCategory: (categoryId: string) => void;
}

function CategoryRow({
  category,
  updatingStatusId,
  onToggleStatus,
  onDeleteCategory,
  onEditCategory,
}: CategoryRowProps) {
  // 计算缩进距离: 每级20px
  const indentPx = category.level * 20;

  // 根据层级选择不同的视觉样式
  const style =
    LEVEL_STYLES[category.level] || LEVEL_STYLES[LEVEL_STYLES.length - 1];

  return (
    <TableRow className={`transition-colors hover:${style.bg}`}>
      <CategoryNameCell category={category} indentPx={indentPx} style={style} />

      {/* 排序顺序 */}
      <TableCell className="text-center text-sm text-gray-600">
        {category.sortOrder ?? '-'}
      </TableCell>

      {/* 产品数量 */}
      <TableCell className="text-center">
        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
          {category.productCount || 0}
        </span>
      </TableCell>

      {/* 状态 - 使用Switch */}
      <CategoryStatusCell
        category={category}
        updatingStatusId={updatingStatusId}
        onToggleStatus={onToggleStatus}
      />

      {/* 创建时间 */}
      <TableCell className="text-sm text-gray-500">
        {formatDateTime(category.createdAt)}
      </TableCell>

      {/* 更新时间 */}
      <TableCell className="text-sm text-gray-500">
        {formatDateTime(category.updatedAt)}
      </TableCell>

      {/* 操作按钮 */}
      <CategoryActionCell
        category={category}
        onEditCategory={onEditCategory}
        onDeleteCategory={onDeleteCategory}
      />
    </TableRow>
  );
}

interface CategoryNameCellProps {
  category: CategoryWithLevel;
  indentPx: number;
  style: LevelStyle;
}

function CategoryNameCell({
  category,
  indentPx,
  style,
}: CategoryNameCellProps) {
  return (
    <TableCell className="font-medium">
      <div
        className="flex items-center gap-2"
        style={{ paddingLeft: `${indentPx}px` }}
      >
        {category.level > 0 && (
          <div className="flex items-center">
            <div className="h-px w-3 bg-gray-300" />
            <div className="h-3 w-px bg-gray-300" />
          </div>
        )}
        {category.level > 0 && (
          <span className="rounded bg-gray-100 px-1 py-0.5 text-[10px] font-semibold text-gray-400">
            {style.badge}
          </span>
        )}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={`font-medium ${style.color} cursor-help`}>
                {category.name}
              </span>
            </TooltipTrigger>
            {category.description && (
              <TooltipContent>
                <p className="max-w-xs">{category.description}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
    </TableCell>
  );
}

interface CategoryStatusCellProps {
  category: CategoryWithLevel;
  updatingStatusId: string | null;
  onToggleStatus: (category: Category) => void;
}

function CategoryStatusCell({
  category,
  updatingStatusId,
  onToggleStatus,
}: CategoryStatusCellProps) {
  return (
    <TableCell>
      <div className="flex items-center gap-2">
        <Switch
          checked={category.status === 'active'}
          onCheckedChange={() => onToggleStatus(category)}
          disabled={updatingStatusId === category.id}
          className="data-[state=checked]:bg-green-500"
        />
        <span
          className={`text-xs font-medium ${
            category.status === 'active' ? 'text-green-700' : 'text-gray-500'
          }`}
        >
          {updatingStatusId === category.id
            ? '更新中...'
            : category.status === 'active'
              ? '启用'
              : '禁用'}
        </span>
      </div>
    </TableCell>
  );
}

interface CategoryActionCellProps {
  category: CategoryWithLevel;
  onEditCategory: (categoryId: string) => void;
  onDeleteCategory: (categoryId: string, categoryName: string) => void;
}

function CategoryActionCell({
  category,
  onEditCategory,
  onDeleteCategory,
}: CategoryActionCellProps) {
  return (
    <TableCell className="text-right">
      <div className="flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
          onClick={() => onEditCategory(category.id)}
        >
          <Edit className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => onDeleteCategory(category.id, category.name)}
              className="text-[hsl(var(--color-error))] focus:bg-[hsl(var(--color-error-light))] focus:text-[hsl(var(--color-error))]"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TableCell>
  );
}
