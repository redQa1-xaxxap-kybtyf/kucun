'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { CountForm } from '@/components/inventory/counts/count-form';
import { Button } from '@/components/ui/button';

export function NewCountPageClient() {
  const router = useRouter();

  const handleSuccess = (countId: string) => {
    // 创建成功后跳转到详情页面
    router.push(`/inventory/counts/${countId}`);
  };

  const handleCancel = () => {
    // 取消后返回列表页面
    router.push('/inventory/counts');
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/inventory/counts">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">创建盘点计划</h1>
          <p className="text-muted-foreground">填写盘点计划信息</p>
        </div>
      </div>

      {/* 盘点计划表单 */}
      <CountForm
        mode="create"
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </div>
  );
}
