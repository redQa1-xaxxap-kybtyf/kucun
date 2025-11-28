'use client';

/**
 * 分类页面头部组件
 * 严格遵循全栈项目统一约定规范
 */

import { FolderTree, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function CategoryPageHeader() {
  const router = useRouter();

  return (
    <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
      <CardContent className="bg-gradient-to-r from-slate-50 to-gray-50 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] shadow-[var(--shadow-medium)]">
              <FolderTree className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                分类管理
              </h1>
              <p className="text-sm text-gray-600">管理产品分类和层级结构</p>
            </div>
          </div>
          <Button
            size="lg"
            onClick={() => router.push('/categories/create')}
            className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
          >
            <Plus className="mr-2 h-4 w-4" />
            新建分类
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
