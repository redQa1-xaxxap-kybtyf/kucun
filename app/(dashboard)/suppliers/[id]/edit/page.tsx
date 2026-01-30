'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { use, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getSupplier, supplierQueryKeys } from '@/lib/api/suppliers';

const EditSupplierForm = dynamic(
  () => import('./EditSupplierForm').then(mod => mod.EditSupplierForm),
  {
    ssr: false,
    loading: () => (
      <Card className="overflow-hidden">
        <CardContent className="p-6 text-sm text-[hsl(var(--color-text-tertiary))]">
          表单加载中...
        </CardContent>
      </Card>
    ),
  }
);

interface EditSupplierPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function EditSupplierPage({ params }: EditSupplierPageProps) {
  const { id } = use(params);

  const HeaderCard = ({ subtitle }: { subtitle: ReactNode }) => (
    <Card className="overflow-hidden">
      <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] shadow-[0_10px_24px_rgba(9,88,217,0.22)]">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                编辑供应商
              </h1>
              <div className="text-sm text-[hsl(var(--color-text-secondary))]">
                {subtitle}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="lg"
              asChild
              className="h-11 gap-2 shadow-[var(--shadow-light)] transition-transform hover:-translate-y-0.5 hover:border-[hsl(var(--color-border-strong))] hover:shadow-[var(--shadow-medium)]"
            >
              <Link href="/suppliers">
                <ArrowLeft className="h-4 w-4" />
                返回
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // 获取供应商详情
  const {
    data: supplierData,
    isLoading: isLoadingSupplier,
    error,
  } = useQuery({
    queryKey: supplierQueryKeys.detail(id),
    queryFn: () => getSupplier(id),
  });

  // 加载中
  if (isLoadingSupplier) {
    return (
      <div className="flex h-full flex-col overflow-auto p-6">
        <div className="space-y-6">
          <HeaderCard subtitle="加载供应商信息中..." />
        </div>
      </div>
    );
  }

  // 错误处理
  if (error) {
    return (
      <div className="flex h-full flex-col overflow-auto p-6">
        <div className="space-y-6">
          <HeaderCard
            subtitle={
              <span className="text-[hsl(var(--color-error))]">
                加载失败: {error.message}
              </span>
            }
          />
        </div>
      </div>
    );
  }

  // 供应商不存在
  if (!supplierData?.data) {
    return (
      <div className="flex h-full flex-col overflow-auto p-6">
        <div className="space-y-6">
          <HeaderCard
            subtitle={
              <span className="text-[hsl(var(--color-error))]">
                供应商不存在
              </span>
            }
          />
        </div>
      </div>
    );
  }

  const supplier = supplierData.data;

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        {/* 页面标题卡片 */}
        <HeaderCard
          subtitle={<>修改供应商 &ldquo;{supplier.name}&rdquo; 的信息</>}
        />

        <EditSupplierForm id={id} supplier={supplier} />
      </div>
    </div>
  );
}
