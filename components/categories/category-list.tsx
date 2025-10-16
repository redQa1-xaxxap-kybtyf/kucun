'use client';

/**
 * 分类列表组件
 * 严格遵循全栈项目统一约定规范
 *
 * 优化说明:
 * - 使用树结构工具函数处理层级关系
 * - 通过缩进和视觉指示器清晰展示分类层级
 * - 支持多级嵌套(最多3级)的友好显示
 */

import { Edit, Eye, EyeOff, MoreHorizontal, Trash2 } from 'lucide-react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Category } from '@/lib/api/categories';
import { formatDateTimeCN } from '@/lib/utils/datetime';
import {
  buildCategoryTree,
  flattenCategoryTree,
} from '@/lib/utils/category-utils';

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

export function CategoryList({
  categories,
  updatingStatusId,
  onToggleStatus,
  onDeleteCategory,
}: CategoryListProps) {
  const router = useRouter();

  /**
   * 使用树结构工具处理分类数据,添加层级信息
   * 遵循DRY原则,复用现有工具函数
   */
  const categoriesWithLevel = useMemo<CategoryWithLevel[]>(() => {
    // 构建树结构
    const tree = buildCategoryTree(categories);
    // 扁平化并添加level字段
    return flattenCategoryTree(tree) as CategoryWithLevel[];
  }, [categories]);

  const formatDate = (dateString: string) => formatDateTimeCN(dateString);

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
          <TableRow>
            <TableHead>分类名称</TableHead>
            <TableHead>产品数量</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>创建时间</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categoriesWithLevel.map(category => {
            // 计算缩进距离: 每级16px
            const indentPx = category.level * 16;

            // 根据层级选择不同的视觉样式
            const levelColors = [
              'text-gray-900', // 一级分类 - 深色
              'text-blue-700', // 二级分类 - 蓝色
              'text-purple-600', // 三级分类 - 紫色
            ];
            const textColor =
              levelColors[category.level] || levelColors[levelColors.length - 1];

            return (
              <TableRow
                key={category.id}
                className="transition-colors hover:bg-blue-50/50"
              >
                <TableCell className="font-medium">
                  <div
                    className="flex items-center gap-2"
                    style={{ paddingLeft: `${indentPx}px` }}
                  >
                    {/* 层级视觉指示器 */}
                    {category.level > 0 && (
                      <span className="text-gray-400 flex-shrink-0">
                        {/* 使用└─ 样式的层级指示器 */}
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </span>
                    )}
                    <span className={`font-medium ${textColor}`}>
                      {category.name}
                    </span>
                  </div>
                </TableCell>
              <TableCell className="text-gray-600">
                {category.productCount || 0}
              </TableCell>
              <TableCell>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                    category.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {category.status === 'active' ? '启用' : '禁用'}
                </span>
              </TableCell>
              <TableCell className="text-sm text-gray-500">
                {formatDate(category.createdAt)}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() =>
                        router.push(`/categories/${category.id}/edit`)
                      }
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      编辑
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onToggleStatus(category)}
                      disabled={updatingStatusId === category.id}
                    >
                      {updatingStatusId === category.id ? (
                        <>
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                          {category.status === 'active'
                            ? '禁用中...'
                            : '启用中...'}
                        </>
                      ) : category.status === 'active' ? (
                        <>
                          <EyeOff className="mr-2 h-4 w-4" />
                          禁用
                        </>
                      ) : (
                        <>
                          <Eye className="mr-2 h-4 w-4" />
                          启用
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        onDeleteCategory(category.id, category.name)
                      }
                      className="text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
