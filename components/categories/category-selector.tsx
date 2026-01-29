'use client';

import { Check, ChevronDown, ChevronRight, ChevronsUpDown } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { Category } from '@/lib/api/categories';
import { cn } from '@/lib/utils';

type CategoryTreeItem = {
  category: Category;
  level: number;
  hasChildren: boolean;
};

function sortCategories(a: Category, b: Category) {
  const sortOrderA =
    typeof a.sortOrder === 'number' ? a.sortOrder : Number.MAX_SAFE_INTEGER;
  const sortOrderB =
    typeof b.sortOrder === 'number' ? b.sortOrder : Number.MAX_SAFE_INTEGER;

  if (sortOrderA !== sortOrderB) {
    return sortOrderA - sortOrderB;
  }

  return a.name.localeCompare(b.name, 'zh-Hans-CN');
}

function buildCategoryPaths(categories: Category[]) {
  const categoryById = new Map<string, Category>();
  categories.forEach(category => categoryById.set(category.id, category));

  const pathById = new Map<string, string>();

  categories.forEach(category => {
    const parts: string[] = [];
    let current: Category | undefined = category;
    let safetyCounter = 0;

    while (current && safetyCounter < 10) {
      parts.push(current.name);
      if (!current.parentId) {
        break;
      }
      current = categoryById.get(current.parentId);
      safetyCounter += 1;
    }

    parts.reverse();
    pathById.set(category.id, parts.join(' / '));
  });

  return { categoryById, pathById };
}

function buildChildrenMap(categories: Category[]) {
  const childrenByParentId = new Map<string | null, Category[]>();

  categories.forEach(category => {
    const parentKey = category.parentId ?? null;
    const bucket = childrenByParentId.get(parentKey);
    if (bucket) {
      bucket.push(category);
    } else {
      childrenByParentId.set(parentKey, [category]);
    }
  });

  childrenByParentId.forEach(list => list.sort(sortCategories));

  return childrenByParentId;
}

function getAncestorIds(categoryById: Map<string, Category>, id: string) {
  const ancestors: string[] = [];
  let current = categoryById.get(id);
  let safetyCounter = 0;

  while (current?.parentId && safetyCounter < 10) {
    ancestors.push(current.parentId);
    current = categoryById.get(current.parentId);
    safetyCounter += 1;
  }

  return ancestors;
}

function buildVisibleTreeItems(params: {
  categories: Category[];
  childrenByParentId: Map<string | null, Category[]>;
  expandedIds: Set<string>;
}): CategoryTreeItem[] {
  const { categories, childrenByParentId, expandedIds } = params;

  if (categories.length === 0) {
    return [];
  }

  const result: CategoryTreeItem[] = [];
  const visited = new Set<string>();

  const walk = (parentId: string | null, level: number) => {
    const children = childrenByParentId.get(parentId);
    if (!children || children.length === 0) {
      return;
    }

    children.forEach(child => {
      if (visited.has(child.id)) {
        return;
      }

      visited.add(child.id);
      const hasChildren = (childrenByParentId.get(child.id)?.length ?? 0) > 0;
      result.push({
        category: child,
        level,
        hasChildren,
      });

      if (hasChildren && expandedIds.has(child.id)) {
        walk(child.id, Math.min(level + 1, 2));
      }
    });
  };

  // 1) 从顶级分类开始
  walk(null, 0);

  // 2) 兜底：孤儿分类（parentId 缺失）也要显示出来
  if (visited.size < categories.length) {
    const orphans = categories
      .filter(category => !visited.has(category.id))
      .slice()
      .sort(sortCategories);

    orphans.forEach(orphan => {
      if (visited.has(orphan.id)) {
        return;
      }

      visited.add(orphan.id);
      const hasChildren = (childrenByParentId.get(orphan.id)?.length ?? 0) > 0;
      result.push({
        category: orphan,
        level: 0,
        hasChildren,
      });

      if (hasChildren && expandedIds.has(orphan.id)) {
        walk(orphan.id, 1);
      }
    });
  }

  return result;
}

interface CategorySelectorProps {
  categories: Category[];
  value?: string;
  onValueChange: (value: string | undefined) => void;
  disabled?: boolean;
  className?: string;
  includeAllOption?: boolean;
  allLabel?: string;
  searchPlaceholder?: string;
}

/**
 * 分类选择器（支持层级展开 + 搜索）
 * - 默认仅展示顶级分类，展开后显示子分类（最多展示到3级样式）
 * - 搜索时展示匹配项，并显示完整路径，方便在大分类量场景下快速定位
 */
export function CategorySelector({
  categories,
  value,
  onValueChange,
  disabled = false,
  className,
  includeAllOption = true,
  allLabel = '全部产品分类',
  searchPlaceholder = '搜索分类名称或编码...',
}: CategorySelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

  const { categoryById, pathById } = React.useMemo(
    () => buildCategoryPaths(categories),
    [categories]
  );

  const childrenByParentId = React.useMemo(
    () => buildChildrenMap(categories),
    [categories]
  );

  const selectedPath = value ? pathById.get(value) : undefined;

  // 打开时自动展开选中分类的父级路径，方便用户再次调整
  React.useEffect(() => {
    if (!open || !value) {
      return;
    }

    const ancestorIds = getAncestorIds(categoryById, value);
    if (ancestorIds.length === 0) {
      return;
    }

    setExpandedIds(prev => {
      const next = new Set(prev);
      ancestorIds.forEach(id => next.add(id));
      return next;
    });
  }, [open, value, categoryById]);

  // 关闭后清理搜索内容，避免再次打开时仍处于搜索态
  React.useEffect(() => {
    if (open) {
      return;
    }
    setSearchValue('');
  }, [open]);

  const visibleTreeItems = React.useMemo(
    () =>
      buildVisibleTreeItems({
        categories,
        childrenByParentId,
        expandedIds,
      }),
    [categories, childrenByParentId, expandedIds]
  );

  const searchResults = React.useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) {
      return [];
    }

    return categories
      .filter(category => {
        const path = pathById.get(category.id) ?? category.name;
        const haystack =
          `${category.name} ${category.code} ${path}`.toLowerCase();
        return haystack.includes(query);
      })
      .slice()
      .sort((a, b) => {
        const pathA = pathById.get(a.id) ?? a.name;
        const pathB = pathById.get(b.id) ?? b.name;
        return pathA.localeCompare(pathB, 'zh-Hans-CN');
      });
  }, [categories, pathById, searchValue]);

  const toggleExpand = React.useCallback((categoryId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  const handleSelect = React.useCallback(
    (nextValue: string | undefined) => {
      onValueChange(nextValue);
      setOpen(false);
      setSearchValue('');
    },
    [onValueChange]
  );

  const triggerLabel =
    selectedPath ||
    (includeAllOption ? allLabel : value ? '未知分类' : '选择分类');

  const showSearchResults = searchValue.trim().length > 0;
  const showPlaceholder = !value && !includeAllOption;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-36 justify-between', className)}
        >
          <span
            className={cn(
              'truncate',
              showPlaceholder && 'text-muted-foreground'
            )}
          >
            {value || includeAllOption ? triggerLabel : '选择分类'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList className="max-h-[360px]">
            <CommandGroup>
              {includeAllOption && (
                <CommandItem
                  value="__all__"
                  onSelect={() => handleSelect(undefined)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value ? 'opacity-0' : 'opacity-100'
                    )}
                  />
                  <span className="font-medium">{allLabel}</span>
                </CommandItem>
              )}

              {showSearchResults ? (
                searchResults.length === 0 ? (
                  <div className="text-muted-foreground py-6 text-center text-sm">
                    未找到相关分类
                  </div>
                ) : (
                  searchResults.map(category => {
                    const path = pathById.get(category.id) ?? category.name;
                    return (
                      <CommandItem
                        key={category.id}
                        value={category.id}
                        onSelect={currentValue => handleSelect(currentValue)}
                        className="py-2"
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            value === category.id ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">
                              {category.name}
                            </span>
                            <span className="text-muted-foreground truncate text-xs">
                              {category.code}
                            </span>
                          </div>
                          <div className="text-muted-foreground truncate text-xs">
                            {path}
                          </div>
                        </div>
                      </CommandItem>
                    );
                  })
                )
              ) : visibleTreeItems.length === 0 ? (
                <div className="text-muted-foreground py-6 text-center text-sm">
                  暂无分类数据
                </div>
              ) : (
                visibleTreeItems.map(item => {
                  const category = item.category;
                  const isSelected = value === category.id;
                  const indent = Math.max(0, item.level) * 14;

                  return (
                    <CommandItem
                      key={category.id}
                      value={category.id}
                      onSelect={currentValue => handleSelect(currentValue)}
                      className="py-2"
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          isSelected ? 'opacity-100' : 'opacity-0'
                        )}
                      />

                      <button
                        type="button"
                        className={cn(
                          'mr-2 flex h-6 w-6 items-center justify-center rounded-sm hover:bg-[hsl(var(--color-primary-light))]',
                          !item.hasChildren && 'invisible'
                        )}
                        onClick={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleExpand(category.id);
                        }}
                        aria-label="展开/折叠子分类"
                      >
                        {expandedIds.has(category.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>

                      <div
                        className="min-w-0 flex-1"
                        style={{ paddingLeft: `${indent}px` }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">
                            {category.name}
                          </span>
                          <span className="text-muted-foreground truncate text-xs">
                            {category.code}
                          </span>
                        </div>
                      </div>
                    </CommandItem>
                  );
                })
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
