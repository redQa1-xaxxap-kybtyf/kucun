import { ArrowLeft, ShoppingCart } from 'lucide-react';
import Link from 'next/link';

import { CreateSalesOrderPageClient } from '@/components/sales-orders/create-sales-order-page-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getCustomerDetail } from '@/lib/api/customer-handlers';
import { getSalesOrderById } from '@/lib/api/handlers/sales-orders';
import { generateSalesOrderNumber } from '@/lib/services/simple-order-number-generator';
import type { Customer } from '@/lib/types/customer';
import type { SalesOrder } from '@/lib/types/sales-order';
import {
  sanitizeReturnTo,
  withReturnTo,
} from '@/lib/utils/sales-order-navigation';

/**
 * 新建销售订单页面
 * 采用中国ERP系统标准布局
 * 优化：使用 Server Component 预先生成订单号，消除加载延迟
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CreateSalesOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const copyFrom =
    typeof params.copyFrom === 'string' ? params.copyFrom.trim() : '';
  const customerId =
    typeof params.customerId === 'string' ? params.customerId.trim() : '';
  const rawReturnTo =
    typeof params.returnTo === 'string' ? params.returnTo : undefined;
  const returnTo = sanitizeReturnTo(rawReturnTo);

  const [initialOrderNumber, duplicateSourceOrder, prefillCustomer] =
    await Promise.all([
    generateSalesOrderNumber(),
    copyFrom
      ? (getSalesOrderById(copyFrom) as Promise<SalesOrder | null>)
      : Promise.resolve(null),
    !copyFrom && customerId
      ? (getCustomerDetail(customerId)
          .then(customer => ({
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            address: customer.address,
          }))
          .catch(() => null) as Promise<
            Pick<Customer, 'id' | 'name' | 'phone' | 'address'> | null
          >)
      : Promise.resolve(null),
    ]);

  const isDuplicating = Boolean(duplicateSourceOrder);
  const isCustomerPrefilled = Boolean(prefillCustomer) && !isDuplicating;
  const cancelHref = isDuplicating
    ? withReturnTo(`/sales-orders/${duplicateSourceOrder?.id}`, returnTo)
    : (returnTo ??
        (prefillCustomer ? `/customers/${prefillCustomer.id}` : '/sales-orders'));
  const pageTitle = isDuplicating
    ? '复制销售订单'
    : isCustomerPrefilled
      ? `为 ${prefillCustomer?.name} 新建销售订单`
      : '新建销售订单';
  const pageDescription = isDuplicating
    ? `基于订单 ${duplicateSourceOrder?.orderNumber} 预填客户、明细和费用，可调整后保存为新订单`
    : isCustomerPrefilled
      ? '已自动带入客户信息，可以直接补充商品、费用和备注后保存'
      : '创建新的销售订单';

  return (
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <div className="space-y-4 sm:space-y-6">
        {/* 页面标题卡片 */}
        <Card className="overflow-hidden rounded-md border border-[hsl(var(--color-border-primary))] shadow-sm">
          <CardContent className="bg-[hsl(var(--color-bg-secondary))] p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-600 text-white shadow-sm sm:h-12 sm:w-12">
                  <ShoppingCart className="h-5 w-5 text-white sm:h-6 sm:w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
                    {pageTitle}
                  </h1>
                  <p className="text-xs text-gray-600 sm:text-sm">
                    {pageDescription}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="h-10 shadow-sm sm:h-11"
              >
                <Link href={cancelHref}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 表单 - 传递预生成的订单号 */}
        <CreateSalesOrderPageClient
          initialOrderNumber={initialOrderNumber}
          duplicateSourceOrder={duplicateSourceOrder ?? undefined}
          prefillCustomer={prefillCustomer ?? undefined}
          cancelHref={cancelHref}
          returnTo={returnTo}
        />
      </div>
    </div>
  );
}
