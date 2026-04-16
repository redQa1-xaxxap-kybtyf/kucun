'use client';

import { ArrowLeft } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const CreatePaymentOutFormSection = dynamic(
  () =>
    import('./CreatePaymentOutFormSection').then(
      mod => mod.CreatePaymentOutFormSection
    ),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="bg-muted h-[520px] animate-pulse rounded-lg lg:col-span-2" />
        <div className="bg-muted h-[320px] animate-pulse rounded-lg" />
      </div>
    ),
  }
);

export default function CreatePaymentOutPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="space-y-6">
        <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
          <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] shadow-[0_10px_24px_rgba(9,88,217,0.22)]">
                  <ChineseYuan className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                    登记付款
                  </h1>
                  <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                    填写付款信息，保存后会直接记为已完成付款
                  </p>
                </div>
              </div>
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
          </CardContent>
        </Card>

        <CreatePaymentOutFormSection />
      </div>
    </div>
  );
}
