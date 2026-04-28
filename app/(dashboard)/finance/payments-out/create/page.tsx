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
        <Card className="border-border overflow-hidden rounded-md border shadow-sm">
          <CardContent className="bg-card p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[hsl(var(--color-primary))]">
                  <ChineseYuan className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                    登记付款
                  </h1>
                  <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                    保存后记为已付款
                  </p>
                </div>
              </div>
              <Button variant="outline" size="lg" asChild className="h-10">
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
