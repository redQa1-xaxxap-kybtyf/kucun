'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { use } from 'react';

import { PageContainer } from '@/components/layouts/page-container';
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

  const actions = (
    <Button
      variant="outline"
      size="lg"
      asChild
      className="h-10 gap-2 rounded-md"
    >
      <Link href="/suppliers">
        <ArrowLeft className="h-4 w-4" />
        返回
      </Link>
    </Button>
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
      <PageContainer
        title="编辑供应商"
        description="加载供应商信息中..."
        icon={<Building2 className="h-6 w-6 text-white" />}
        actions={actions}
        bodyClassName="space-y-6"
      />
    );
  }

  // 错误处理
  if (error) {
    return (
      <PageContainer
        title="编辑供应商"
        description={
          <span className="text-[hsl(var(--color-error))]">
            加载失败: {error.message}
          </span>
        }
        icon={<Building2 className="h-6 w-6 text-white" />}
        actions={actions}
        bodyClassName="space-y-6"
      />
    );
  }

  // 供应商不存在
  if (!supplierData?.data) {
    return (
      <PageContainer
        title="编辑供应商"
        description={
          <span className="text-[hsl(var(--color-error))]">供应商不存在</span>
        }
        icon={<Building2 className="h-6 w-6 text-white" />}
        actions={actions}
        bodyClassName="space-y-6"
      />
    );
  }

  const supplier = supplierData.data;

  return (
    <PageContainer
      title="编辑供应商"
      description={<>修改供应商 &ldquo;{supplier.name}&rdquo; 的信息</>}
      icon={<Building2 className="h-6 w-6 text-white" />}
      actions={actions}
      bodyClassName="space-y-6"
    >
      <EditSupplierForm id={id} supplier={supplier} />
    </PageContainer>
  );
}
