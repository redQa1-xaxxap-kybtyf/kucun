'use client';

import { Truck } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';

import { CustomerSelector } from '@/components/sales-orders/customer-selector';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  FACTORY_SHIPMENT_STATUS,
  FACTORY_SHIPMENT_STATUS_LABELS,
} from '@/lib/types/factory-shipment';
import type { Customer } from '@/lib/types/models';
import type { CreateFactoryShipmentOrderData } from '@/lib/validations/factory-shipment';

interface BasicInfoSectionProps {
  form: UseFormReturn<CreateFactoryShipmentOrderData>;
  customers: Customer[];
  showStatus?: boolean;
  isLoadingCustomers?: boolean;
  onCustomerCreated?: (customer: Customer) => void;
  onRefreshCustomers?: () => void;
}

/**
 * 厂家发货订单基本信息卡片
 * 包含：客户选择、集装箱号
 * 订单状态仅在编辑场景展示
 *
 * 复用销售订单的客户选择器组件，支持：
 * - 客户搜索（名称、手机号、拼音）
 * - 快速创建新客户
 * - 自动刷新客户列表
 */
export function BasicInfoSection({
  form,
  customers,
  showStatus = false,
  isLoadingCustomers = false,
  onCustomerCreated,
  onRefreshCustomers,
}: BasicInfoSectionProps) {
  return (
    <Card className="overflow-hidden border-[hsl(var(--color-border-primary))] shadow-md">
      <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-gradient-to-r from-[hsl(var(--color-bg-secondary))] to-[hsl(var(--color-bg-primary))]">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--color-primary))] text-[hsl(var(--color-text-on-primary))] shadow-sm">
            <Truck className="h-5 w-5" />
          </div>
          <span className="font-semibold text-[hsl(var(--color-text-primary))]">
            基本信息
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        {/* 第一行：客户选择和集装箱号 */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* 客户选择 */}
          <FormField
            control={form.control}
            name="customerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                  客户 <span className="text-[hsl(var(--color-error))]">*</span>
                </FormLabel>
                <FormControl>
                  <CustomerSelector
                    customers={customers}
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder="搜索并选择客户"
                    isLoading={isLoadingCustomers}
                    onCustomerCreated={onCustomerCreated}
                    onRefreshCustomers={onRefreshCustomers}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 集装箱号 */}
          <FormField
            control={form.control}
            name="containerNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                  集装箱号
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="请输入集装箱号"
                    className="transition-all duration-200 focus:ring-2 focus:ring-[hsl(var(--color-primary))]/20"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* 第二行：订单状态（编辑时） */}
        {showStatus && (
          <div className="grid grid-cols-1 gap-5">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                    订单状态
                  </FormLabel>
                  <FormControl>
                    <input type="hidden" {...field} />
                  </FormControl>
                  <Badge
                    variant="outline"
                    className="inline-flex min-h-10 items-center justify-start rounded-md border border-dashed border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] px-4 text-sm font-medium text-[hsl(var(--color-text-primary))]"
                  >
                    {FACTORY_SHIPMENT_STATUS_LABELS[
                      (field.value ??
                        FACTORY_SHIPMENT_STATUS.DRAFT) as keyof typeof FACTORY_SHIPMENT_STATUS_LABELS
                    ] ??
                      FACTORY_SHIPMENT_STATUS_LABELS[
                        FACTORY_SHIPMENT_STATUS.DRAFT
                      ]}
                  </Badge>
                  <FormDescription className="text-xs text-[hsl(var(--color-text-secondary))]">
                    状态由系统流程自动更新，用户无需手动选择
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
