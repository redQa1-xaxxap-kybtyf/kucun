'use client';

/**
 * 分类列表组件
 * 严格遵循全栈项目统一约定规范
 */

import { Edit, Eye, EyeOff, MoreHorizontal, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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

interface CategoryListProps {
  categories: Category[];
  selectedCategoryIds: string[];
  updatingStatusId: string | null;
  onSelectCategory: (categoryId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onToggleStatus: (category: Category) => void;
  onDeleteCategory: (categoryId: string, categoryName: string) => void;
  totalCount: number;
}

export function CategoryList({
  categories,
  selectedCategoryIds,
  updatingStatusId,
  onSelectCategory,
  onSelectAll,
  onToggleStatus,
  onDeleteCategory,
  totalCount,
}: CategoryListProps) {
  const router = useRouter();

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
            <TableHead className="w-12">
              <Checkbox
                checked={
                  totalCount > 0 && selectedCategoryIds.length === totalCount
                }
                onCheckedChange={onSelectAll}
                aria-label="全选分类"
              />
            </TableHead>
            <TableHead>分类名称</TableHead>
            <TableHead>产品数量</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>创建时间</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map(category => (
            <TableRow
              key={category.id}
              className="transition-colors hover:bg-blue-50/50"
            >
              <TableCell>
                <Checkbox
                  checked={selectedCategoryIds.includes(category.id)}
                  onCheckedChange={checked =>
                    onSelectCategory(category.id, checked as boolean)
                  }
                  aria-label={`选择分类 ${category.name}`}
                />
              </TableCell>
              <TableCell className="font-medium text-gray-900">
                <div className="flex items-center gap-2">
                  {/* 层级缩进指示器 */}
                  {category.parent && (
                    <span className="text-gray-400">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  )}
                  <div className="flex flex-col">
                    <span className="font-medium">{category.name}</span>
                    {category.parent && (
                      <span className="text-xs text-gray-500">
                        父级: {category.parent.name}
                      </span>
                    )}
                  </div>
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
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
