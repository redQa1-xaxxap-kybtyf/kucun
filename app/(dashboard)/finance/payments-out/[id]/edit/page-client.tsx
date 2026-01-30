'use client';

import { ArrowLeft } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const EditPaymentOutFormSection = dynamic(
  () =>
    import('./EditPaymentOutFormSection').then(
      mod => mod.EditPaymentOutFormSection
    ),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="bg-muted h-[560px] animate-pulse rounded-lg lg:col-span-2" />
        <div className="bg-muted h-[360px] animate-pulse rounded-lg" />
      </div>
    ),
  }
);

export interface PaymentOutRecord {
  id: string;
  paymentNumber: string;
  paymentAmount: number;
  paymentMethod: string;
  paymentDate: string;
  status: string;
  remarks?: string;
  voucherNumber?: string;
  bankInfo?: string;
  payableRecordId?: string | null;
  payableRecord?: {
    id: string;
    payableNumber: string;
    payableAmount: number;
    paidAmount: number;
    remainingAmount: number;
    status: string;
    supplier: {
      id: string;
      name: string;
      phone?: string;
      email?: string;
    };
  };
  supplierId: string;
  supplier: {
    id: string;
    name: string;
    phone?: string;
    address?: string;
  };
  user: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface EditPaymentOutClientProps {
  initialPayment: PaymentOutRecord;
}

/**
 * 编辑付款记录客户端组件
 * 仅保留轻量壳，重表单动态加载以降低首屏 JS 体积
 */
export function EditPaymentOutClient({
  initialPayment,
}: EditPaymentOutClientProps) {
  // 如果已确认，显示提示并禁止编辑
  if (initialPayment.status === 'confirmed') {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">无法编辑</CardTitle>
            <CardDescription>
              该付款记录已确认，无法进行编辑操作。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href={`/finance/payments-out/${initialPayment.id}`}>
                返回详情页
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden p-4 sm:p-6">
      <div className="space-y-4 sm:space-y-6">
        {/* 页面标题卡片 */}
        <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
          <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] shadow-[0_10px_24px_rgba(9,88,217,0.22)]">
                  <ChineseYuan className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                    编辑付款记录
                  </h1>
                  <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                    {initialPayment.paymentNumber}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Button
                  variant="outline"
                  size="lg"
                  asChild
                  className="h-11 shadow-[var(--shadow-light)] transition-all hover:scale-105 hover:shadow-[var(--shadow-medium)]"
                >
                  <Link href="/finance/payments-out">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    返回
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <EditPaymentOutFormSection initialPayment={initialPayment} />
      </div>
    </div>
  );
}

