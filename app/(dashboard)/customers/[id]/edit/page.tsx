'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { ERPCustomerForm } from '@/components/customers/erp-customer-form';
import { Button } from '@/components/ui/button';
import { customerQueryKeys, getCustomer } from '@/lib/api/customers';

/**
 * 客户编辑页面 - ERP风格
 * 符合中国ERP系统的界面标准和用户习惯
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

  // 加载状态
  if (isLoading) {
    return (
      <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="rounded border bg-card">
          <div className="border-b bg-muted/30 px-3 py-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">编辑客户</h3>
            </div>
          </div>
          <div className="px-3 py-8">
            <div className="flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2 text-sm text-muted-foreground">
                加载客户信息中...
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="rounded border bg-card">
          <div className="border-b bg-muted/30 px-3 py-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">编辑客户</h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={handleBack}
              >
                <ArrowLeft className="mr-1 h-3 w-3" />
                返回
              </Button>
            </div>
          </div>
          <div className="px-3 py-8">
            <div className="text-center">
              <p className="text-sm text-red-600">
                加载客户信息失败:{' '}
                {error instanceof Error ? error.message : '未知错误'}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 h-7"
                onClick={handleBack}
              >
                返回客户列表
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 客户不存在
  if (!customer) {
    return (
      <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="rounded border bg-card">
          <div className="border-b bg-muted/30 px-3 py-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">编辑客户</h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={handleBack}
              >
                <ArrowLeft className="mr-1 h-3 w-3" />
                返回
              </Button>
            </div>
          </div>
          <div className="px-3 py-8">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">客户不存在</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 h-7"
                onClick={handleBack}
              >
                返回客户列表
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
      <ERPCustomerForm
        mode="edit"
        initialData={customer}
        onSuccess={handleSuccess}
        onCancel={handleBack}
      />
    </div>
  );
}
