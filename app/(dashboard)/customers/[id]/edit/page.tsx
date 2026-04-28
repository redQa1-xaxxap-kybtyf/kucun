'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Users } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { PageContainer } from '@/components/layouts/page-container';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { customerQueryKeys, getCustomer } from '@/lib/api/customers';

const ERPCustomerForm = dynamic(
  () =>
    import('@/components/customers/erp-customer-form').then(
      mod => mod.ERPCustomerForm
    ),
  {
    ssr: false,
    loading: () => (
      <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
        表单加载中...
      </div>
    ),
  }
);

/**
 * 客户编辑页面
 * ✅ 统一 UI 样式，与产品管理编辑页面保持一致
 */

interface CustomerEditPageProps {
  params: Promise<{ id: string }>;
}

export default function CustomerEditPage({ params }: CustomerEditPageProps) {
  const router = useRouter();

  // 解析动态路由参数 (Next.js 15.4 要求)
  const { id: customerId } = React.use(params);

  // 获取客户数据
  const {
    data: customer,
    isLoading,
    error,
  } = useQuery({
    queryKey: customerQueryKeys.detail(customerId),
    queryFn: () => getCustomer(customerId),
    enabled: !!customerId,
  });

  // 处理返回
  const handleBack = () => {
    router.back();
  };

  // 处理编辑成功
  const handleSuccess = () => {
    router.push('/customers');
  };

  const backAction = (
    <Button
      type="button"
      variant="outline"
      size="lg"
      asChild
      className="h-10 gap-2 rounded-md"
    >
      <Link href="/customers">
        <ArrowLeft className="h-4 w-4" />
        返回
      </Link>
    </Button>
  );

  // 加载状态
  if (isLoading) {
    return (
      <PageContainer
        title="编辑客户"
        description="修改客户信息"
        icon={<Users className="h-6 w-6 text-white" />}
        actions={backAction}
        bodyClassName="space-y-6"
      >
        <Card className="overflow-hidden">
          <CardContent className="p-12">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--color-primary))]" />
              <span className="ml-3 text-base text-[hsl(var(--color-text-secondary))]">
                加载客户信息中...
              </span>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  // 错误状态
  if (error) {
    return (
      <PageContainer
        title="编辑客户"
        description="修改客户信息"
        icon={<Users className="h-6 w-6 text-white" />}
        actions={backAction}
        bodyClassName="space-y-6"
      >
        <Card className="overflow-hidden">
          <CardContent className="p-12">
            <div className="text-center">
              <p className="text-base text-[hsl(var(--color-error))]">
                加载客户信息失败:{' '}
                {error instanceof Error ? error.message : '未知错误'}
              </p>
              <Button
                variant="outline"
                size="lg"
                className="mt-6 rounded-md"
                onClick={handleBack}
              >
                返回客户列表
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  // 客户不存在
  if (!customer) {
    return (
      <PageContainer
        title="编辑客户"
        description="修改客户信息"
        icon={<Users className="h-6 w-6 text-white" />}
        actions={backAction}
        bodyClassName="space-y-6"
      >
        <Card className="overflow-hidden">
          <CardContent className="p-12">
            <div className="text-center">
              <p className="text-base text-[hsl(var(--color-text-secondary))]">
                客户不存在
              </p>
              <Button
                variant="outline"
                size="lg"
                className="mt-6 rounded-md"
                onClick={handleBack}
              >
                返回客户列表
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <ERPCustomerForm
      mode="edit"
      initialData={customer}
      onSuccess={handleSuccess}
      onCancel={handleBack}
      presentation="page"
    />
  );
}
