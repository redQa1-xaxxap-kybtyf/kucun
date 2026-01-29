'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Users } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import * as React from 'react';

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

  const HeaderCard = () => (
    <Card className="overflow-hidden">
      <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] shadow-[0_10px_24px_rgba(9,88,217,0.22)]">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                编辑客户
              </h1>
              <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                修改客户信息
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleBack}
            className="h-11 gap-2 shadow-[var(--shadow-light)] transition-transform hover:-translate-y-0.5 hover:border-[hsl(var(--color-border-strong))] hover:shadow-[var(--shadow-medium)]"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // 加载状态
  if (isLoading) {
    return (
      <div className="flex h-full flex-col overflow-auto p-6">
        <div className="space-y-6">
          <HeaderCard />

          {/* 加载提示 */}
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
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="flex h-full flex-col overflow-auto p-6">
        <div className="space-y-6">
          <HeaderCard />

          {/* 错误提示 */}
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
                  className="mt-6"
                  onClick={handleBack}
                >
                  返回客户列表
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // 客户不存在
  if (!customer) {
    return (
      <div className="flex h-full flex-col overflow-auto p-6">
        <div className="space-y-6">
          <HeaderCard />

          {/* 不存在提示 */}
          <Card className="overflow-hidden">
            <CardContent className="p-12">
              <div className="text-center">
                <p className="text-base text-[hsl(var(--color-text-secondary))]">
                  客户不存在
                </p>
                <Button
                  variant="outline"
                  size="lg"
                  className="mt-6"
                  onClick={handleBack}
                >
                  返回客户列表
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        <ERPCustomerForm
          mode="edit"
          initialData={customer}
          onSuccess={handleSuccess}
          onCancel={handleBack}
        />
      </div>
    </div>
  );
}
