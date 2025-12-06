'use client';

import { ArrowLeft, ClipboardCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { PageHeader } from '@/components/common/page-header';
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
    <div className="space-y-6 p-4 sm:p-6">
      {/* 页面标题 */}
      <PageHeader
        title="创建盘点计划"
        description="填写盘点计划信息"
        icon={<ClipboardCheck className="h-6 w-6 text-white" />}
        iconBgColor="hsl(var(--color-info))"
        actions={
          <Button variant="outline" size="lg" asChild className="h-11 gap-2">
            <Link href="/inventory/counts">
              <ArrowLeft className="h-4 w-4" />
              返回列表
            </Link>
          </Button>
        }
      />

      {/* 盘点计划表单 */}
      <CountForm
        mode="create"
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </div>
  );
}
