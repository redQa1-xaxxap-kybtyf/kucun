'use client';

import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import type { InventoryCountDetail } from '@/lib/types/inventory-count';

const CountForm = dynamic(
  () =>
    import('@/components/inventory/counts/count-form').then(mod => mod.CountForm),
  {
    ssr: false,
    loading: () => (
      <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
        表单加载中...
      </div>
    ),
  }
);

interface EditCountPageClientProps {
  countId: string;
  initialData: InventoryCountDetail;
}

export function EditCountPageClient({
  countId,
  initialData,
}: EditCountPageClientProps) {
  const router = useRouter();

  const formData = {
    countName: initialData.countName,
    countType: initialData.countType,
    planDate: format(new Date(initialData.planDate), 'yyyy-MM-dd'),
    location: initialData.location || '',
    categoryId: initialData.categoryId || '',
    remarks: initialData.remarks || '',
  };

  const handleSuccess = () => {
    // 更新成功后跳转到详情页面
    router.push(`/inventory/counts/${countId}`);
  };

  const handleCancel = () => {
    // 取消后返回详情页面
    router.push(`/inventory/counts/${countId}`);
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/inventory/counts/${countId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">编辑盘点计划</h1>
          <p className="text-muted-foreground">{initialData.countNumber}</p>
        </div>
      </div>

      {/* 盘点计划表单 */}
      <CountForm
        mode="edit"
        countId={countId}
        initialData={formData}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </div>
  );
}
