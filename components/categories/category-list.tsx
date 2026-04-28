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

import { Edit, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import {
  CategoryQuickCreateDialog,
  type CategoryQuickCreateParent,
} from '@/components/categories/category-quick-create-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { buildCategoryPathMap } from '@/lib/utils/category-utils';
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
  fullPath: string;
}

type LevelStyle = { color: string; bg: string; badge: string };

const LEVEL_STYLES: LevelStyle[] = [
  {
    color: 'text-[hsl(var(--color-text-primary))]',
    bg: 'bg-[hsl(var(--color-primary-lighter))]',
    badge: 'L1',
  },
  {
    color: 'text-[hsl(var(--color-primary))]',
    bg: 'bg-[hsl(var(--color-primary-light))]',
    badge: 'L2',
  },
  {
    color: 'text-[hsl(var(--color-purple))]',
    bg: 'bg-[hsl(var(--color-purple-light))]',
    badge: 'L3',
  },
];

/**
 * 构建带层级的分类列表（严格按父子关系展开）
 *
 * 设计目标：
 * - 确保“子分类始终显示在所选父分类下面”
 * - 避免之前那种按 level 单独排序导致所有二级分类挤在一起、
 *   视觉上好像都挂在第一个顶级分类下的错觉
 */
function buildCategoriesWithLevel(
  categories: Category[],
  pathById: Map<string, string>
): CategoryWithLevel[] {
  if (!categories.length) return [];

  // 1) 按 parentId 分组，构建父 -> 子的映射
  const childrenMap = new Map<string | null, Category[]>();
  const allIds = new Set<string>();

  categories.forEach(category => {
    const parentKey = category.parentId ?? null;
    const bucket = childrenMap.get(parentKey);
    if (bucket) {
      bucket.push(category);
    } else {
      childrenMap.set(parentKey, [category]);
    }
    allIds.add(category.id);
  });

  // 通用排序：先按 sortOrder，再按名称
  const sortCategories = (a: Category, b: Category) => {
    const sortOrderA =
      typeof a.sortOrder === 'number' ? a.sortOrder : Number.MAX_SAFE_INTEGER;
    const sortOrderB =
      typeof b.sortOrder === 'number' ? b.sortOrder : Number.MAX_SAFE_INTEGER;

    if (sortOrderA !== sortOrderB) {
      return sortOrderA - sortOrderB;
    }

    return a.name.localeCompare(b.name, 'zh-Hans-CN');
  };

  const result: CategoryWithLevel[] = [];
  const visited = new Set<string>();

  // 2) 递归展开层级结构
  const walk = (parentId: string | null, level: number) => {
    const children = childrenMap.get(parentId);
    if (!children || children.length === 0) return;

    children
      .slice()
      .sort(sortCategories)
      .forEach(child => {
        if (visited.has(child.id)) return;
        visited.add(child.id);

        result.push({
          ...child,
          level: Math.min(child.level ?? level, LEVEL_STYLES.length - 1),
          fullPath: child.fullPath ?? pathById.get(child.id) ?? child.name,
        });

        // 最多显示到 L3，超过的层级依然按 L3 样式展示
        const nextLevel = Math.min(level + 1, LEVEL_STYLES.length - 1);
        walk(child.id, nextLevel);
      });
  };

  // 3) 先从所有“顶级分类”（parentId 为 null）开始
  walk(null, 0);

  // 4) 兜底：如果存在 parentId 指向缺失父级的“孤儿分类”，
  //    也要保证它们能显示出来（按顶级处理）
  if (visited.size < allIds.size) {
    const orphanIds = [...allIds].filter(id => !visited.has(id));
    const orphans = categories.filter(cat => orphanIds.includes(cat.id));

    orphans.sort(sortCategories).forEach(orphan => {
      if (visited.has(orphan.id)) return;
      visited.add(orphan.id);

      result.push({
        ...orphan,
        level: Math.min(orphan.level ?? 0, LEVEL_STYLES.length - 1),
        fullPath: orphan.fullPath ?? pathById.get(orphan.id) ?? orphan.name,
      });

      walk(orphan.id, 1);
    });
  }

  return result;
}

export function CategoryList({
  categories,
  updatingStatusId,
  onToggleStatus,
  onDeleteCategory,
}: CategoryListProps) {
  const router = useRouter();
  const [createDialog, setCreateDialog] = useState<{
    open: boolean;
    parent: CategoryQuickCreateParent | null;
  }>({ open: false, parent: null });

  const categoriesWithLevel = useMemo<CategoryWithLevel[]>(() => {
    const pathById = buildCategoryPathMap(categories);

    // 按父子层级顺序展开，避免所有二级分类挤在一起
    return buildCategoriesWithLevel(categories, pathById);
  }, [categories]);

  const handleEdit = useMemo(
    () => (categoryId: string) => router.push(`/categories/${categoryId}/edit`),
    [router]
  );

  const openCreateRoot = useMemo(
    () => () => setCreateDialog({ open: true, parent: null }),
    []
  );

  const openCreateChild = useMemo(
    () => (category: CategoryWithLevel) =>
      setCreateDialog({
        open: true,
        parent: {
          id: category.id,
          name: category.name,
          code: category.code,
          fullPath: category.fullPath,
          level: category.level,
        },
      }),
    []
  );

  if (categories.length === 0) {
    return (
      <Card className="rounded-md border border-[hsl(var(--color-border-primary))] shadow-sm">
        <CardHeader>
          <CardTitle>分类列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            <div className="text-muted-foreground text-center">
              暂无分类数据
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openCreateRoot}
              className="h-8"
            >
              <Plus className="h-4 w-4" />
              新增一级分类
            </Button>
          </div>

          <CategoryQuickCreateDialog
            open={createDialog.open}
            parent={createDialog.parent}
            onOpenChange={open =>
              setCreateDialog(prev =>
                open ? { ...prev, open } : { open: false, parent: null }
              )
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b bg-gray-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm font-medium text-gray-700">分类列表</div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openCreateRoot}
          className="h-9 w-full sm:h-8 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          新增一级分类
        </Button>
      </div>

      <div className="space-y-3 p-4 md:hidden">
        {categoriesWithLevel.map(category => (
          <CategoryMobileCard
            key={category.id}
            category={category}
            updatingStatusId={updatingStatusId}
            onToggleStatus={onToggleStatus}
            onDeleteCategory={onDeleteCategory}
            onEditCategory={handleEdit}
            onAddChildCategory={openCreateChild}
          />
        ))}
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/50">
              <TableHead className="w-[360px]">分类信息</TableHead>
              <TableHead className="w-[80px]">排序</TableHead>
              <TableHead className="w-[100px] whitespace-nowrap">
                产品数量
              </TableHead>
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
                onAddChildCategory={openCreateChild}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <CategoryQuickCreateDialog
        open={createDialog.open}
        parent={createDialog.parent}
        onOpenChange={open =>
          setCreateDialog(prev =>
            open ? { ...prev, open } : { open: false, parent: null }
          )
        }
      />
    </div>
  );
}

function getCategoryStatusMeta(
  category: CategoryWithLevel,
  updatingStatusId: string | null
) {
  if (updatingStatusId === category.id) {
    return {
      label: '更新中...',
      textClass: 'text-amber-700',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    };
  }

  if (category.status === 'active') {
    return {
      label: '启用',
      textClass: 'text-green-700',
      badgeClass: 'bg-green-50 text-green-700 border-green-200',
    };
  }

  return {
    label: '禁用',
    textClass: 'text-gray-500',
    badgeClass: 'bg-gray-50 text-gray-600 border-gray-200',
  };
}

function CategoryCodeBadge({ code }: { code?: string }) {
  if (!code) {
    return null;
  }

  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
      编码 {code}
    </span>
  );
}

interface CategoryMobileCardProps {
  category: CategoryWithLevel;
  updatingStatusId: string | null;
  onToggleStatus: (category: Category) => void;
  onDeleteCategory: (categoryId: string, categoryName: string) => void;
  onEditCategory: (categoryId: string) => void;
  onAddChildCategory: (category: CategoryWithLevel) => void;
}

function CategoryMobileCard({
  category,
  updatingStatusId,
  onToggleStatus,
  onDeleteCategory,
  onEditCategory,
  onAddChildCategory,
}: CategoryMobileCardProps) {
  const style =
    LEVEL_STYLES[category.level] || LEVEL_STYLES[LEVEL_STYLES.length - 1];
  const statusMeta = getCategoryStatusMeta(category, updatingStatusId);
  const canAddChildCategory =
    category.level < 2 && category.status === 'active';
  const isAtMaxLevel = category.level >= 2;
  const addChildTitle = isAtMaxLevel
    ? '已到三级'
    : category.status !== 'active'
      ? '父级分类未启用，无法添加子分类'
      : '添加子分类';

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {category.level > 0 ? (
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                {style.badge}
              </span>
            ) : null}
            <span className={`text-base font-semibold ${style.color}`}>
              {category.name}
            </span>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusMeta.badgeClass}`}
            >
              {statusMeta.label}
            </span>
          </div>

          <div className="mt-2 space-y-1 text-sm text-slate-500">
            <div className="break-all">路径：{category.fullPath}</div>
            {category.code ? (
              <div className="flex flex-wrap items-center gap-2">
                <CategoryCodeBadge code={category.code} />
              </div>
            ) : null}
            {category.description ? (
              <div className="line-clamp-2">备注：{category.description}</div>
            ) : null}
          </div>
        </div>

        <div
          className={`rounded-xl px-2 py-1 text-xs font-semibold ${style.bg} ${style.color}`}
        >
          {style.badge}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-slate-50 px-3 py-2">
        <div>
          <div className="text-xs text-slate-400">排序</div>
          <div className="mt-1 text-sm font-medium text-slate-700">
            {category.sortOrder ?? '-'}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400">产品数量</div>
          <div className="mt-1">
            <span className="inline-flex items-center rounded-full bg-[hsl(var(--color-primary-light))] px-2 py-0.5 text-xs font-medium text-[hsl(var(--color-primary))]">
              {category.productCount || 0}
            </span>
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400">更新时间</div>
          <div className="mt-1 text-sm font-medium text-slate-700">
            {formatDateTime(category.updatedAt)}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
        <div>
          <div className="text-xs text-slate-400">当前状态</div>
          <div className={`mt-1 text-sm font-medium ${statusMeta.textClass}`}>
            {statusMeta.label}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={category.status === 'active'}
            onCheckedChange={() => onToggleStatus(category)}
            disabled={updatingStatusId === category.id}
            className="data-[state=checked]:bg-green-500"
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onAddChildCategory(category)}
          disabled={!canAddChildCategory}
          title={addChildTitle}
          className="h-10"
        >
          <Plus className="mr-1 h-4 w-4" />
          新增下级
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onEditCategory(category.id)}
          className="h-10"
        >
          <Edit className="mr-1 h-4 w-4" />
          编辑
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onDeleteCategory(category.id, category.name)}
          className="h-10 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          <Trash2 className="mr-1 h-4 w-4" />
          删除
        </Button>
      </div>
    </div>
  );
}

interface CategoryRowProps {
  category: CategoryWithLevel;
  updatingStatusId: string | null;
  onToggleStatus: (category: Category) => void;
  onDeleteCategory: (categoryId: string, categoryName: string) => void;
  onEditCategory: (categoryId: string) => void;
  onAddChildCategory: (category: CategoryWithLevel) => void;
}

function CategoryRow({
  category,
  updatingStatusId,
  onToggleStatus,
  onDeleteCategory,
  onEditCategory,
  onAddChildCategory,
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
        <span className="inline-flex items-center rounded-full bg-[hsl(var(--color-primary-light))] px-2 py-1 text-xs font-medium text-[hsl(var(--color-primary))]">
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
        onAddChildCategory={onAddChildCategory}
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
        className="space-y-1.5 pl-[var(--indent)]"
        style={{ '--indent': `${indentPx}px` } as React.CSSProperties}
      >
        <div className="flex items-center gap-2">
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
                <span className={`cursor-help font-medium ${style.color}`}>
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

        <div
          className={`space-y-0.5 text-xs ${category.level > 0 ? 'pl-7' : ''}`}
        >
          <div className="text-gray-500">路径：{category.fullPath}</div>
          {category.code ? <CategoryCodeBadge code={category.code} /> : null}
          {category.description && (
            <div className="line-clamp-1 text-gray-400">
              备注：{category.description}
            </div>
          )}
        </div>
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
  const statusMeta = getCategoryStatusMeta(category, updatingStatusId);

  return (
    <TableCell>
      <div className="flex items-center gap-2">
        <Switch
          checked={category.status === 'active'}
          onCheckedChange={() => onToggleStatus(category)}
          disabled={updatingStatusId === category.id}
          className="data-[state=checked]:bg-green-500"
        />
        <span className={`text-xs font-medium ${statusMeta.textClass}`}>
          {statusMeta.label}
        </span>
      </div>
    </TableCell>
  );
}

interface CategoryActionCellProps {
  category: CategoryWithLevel;
  onEditCategory: (categoryId: string) => void;
  onDeleteCategory: (categoryId: string, categoryName: string) => void;
  onAddChildCategory: (category: CategoryWithLevel) => void;
}

function CategoryActionCell({
  category,
  onEditCategory,
  onDeleteCategory,
  onAddChildCategory,
}: CategoryActionCellProps) {
  const canAddChildCategory =
    category.level < 2 && category.status === 'active';
  const isAtMaxLevel = category.level >= 2;

  const addChildTitle = isAtMaxLevel
    ? '已到三级'
    : category.status !== 'active'
      ? '父级分类未启用，无法添加子分类'
      : '添加子分类';

  return (
    <TableCell className="text-right">
      <div className="flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary-light))] hover:text-[hsl(var(--color-primary-hover))]"
          onClick={() => onAddChildCategory(category)}
          disabled={!canAddChildCategory}
          aria-label="添加子分类"
          title={addChildTitle}
        >
          <Plus className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary-light))] hover:text-[hsl(var(--color-primary-hover))]"
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
              onClick={() => onAddChildCategory(category)}
              disabled={!canAddChildCategory}
              title={addChildTitle}
            >
              <Plus className="mr-2 h-4 w-4" />
              添加子分类
            </DropdownMenuItem>
            <DropdownMenuSeparator />
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
