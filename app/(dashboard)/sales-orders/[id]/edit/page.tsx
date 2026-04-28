import { ArrowLeft, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getSalesOrderById } from '@/lib/api/handlers/sales-orders';
import { requirePagePermission } from '@/lib/auth/page-permission';
import type { SalesOrder } from '@/lib/types/sales-order';
import {
  sanitizeReturnTo,
  withReturnTo,
} from '@/lib/utils/sales-order-navigation';

import { EditSalesOrderPageClient } from './page-client';

/**
 * 编辑销售订单页面
 * 仅允许编辑草稿状态的订单
 */
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

export default async function EditSalesOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requirePagePermission('sales:manage', { redirectTo: '/sales-orders' });

  const { id } = await params;
  const query = await searchParams;
  const rawReturnTo =
    typeof query.returnTo === 'string' ? query.returnTo : undefined;
  const returnTo = sanitizeReturnTo(rawReturnTo);
  const order = (await getSalesOrderById(id)) as unknown as SalesOrder | null;

  if (!order) {
    notFound();
  }

  if (order.status !== 'draft') {
    redirect(withReturnTo(`/sales-orders/${id}`, returnTo));
  }

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        {/* 页面标题卡片 */}
        <Card className="overflow-hidden rounded-md border border-[hsl(var(--color-border-primary))] shadow-sm">
          <CardContent className="bg-[hsl(var(--color-bg-secondary))] p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-blue-600 text-white shadow-sm">
                  <ShoppingCart className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                    编辑销售订单
                  </h1>
                  <p className="text-sm text-gray-600">
                    订单号：{order.orderNumber}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="h-11 shadow-sm"
              >
                <Link href={withReturnTo(`/sales-orders/${id}`, returnTo)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 表单 */}
        <EditSalesOrderPageClient
          orderId={id}
          initialData={order}
          returnTo={returnTo}
        />
      </div>
    </div>
  );
}
