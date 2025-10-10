'use client';

/**
 * 供应商页面头部组件
 * 严格遵循全栈项目统一约定规范
 * 参考：components/categories/category-page-header.tsx
 */

import { Building2, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function SupplierPageHeader() {
  const router = useRouter();

  return (
    <Card className="overflow-hidden">
      <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] shadow-[0_10px_24px_rgba(9,88,217,0.22)]">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                供应商管理
              </h1>
              <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                管理供应商信息
              </p>
            </div>
          </div>
          <Button
            size="lg"
            onClick={() => router.push('/suppliers/create')}
            className="h-11 shadow-[var(--shadow-light)] transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-medium)]"
          >
            <Plus className="mr-2 h-4 w-4" />
            新建供应商
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
