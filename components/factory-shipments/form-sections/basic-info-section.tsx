'use client';

import { MapPin, Truck } from 'lucide-react';
import { useState } from 'react';
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
import type { BlurHandlerFactory } from '@/lib/hooks/useFormErrorHandling';
import {
  FACTORY_SHIPMENT_STATUS,
  FACTORY_SHIPMENT_STATUS_LABELS,
} from '@/lib/types/factory-shipment';
import type { Customer } from '@/lib/types/models';
import type { FactoryShipmentOrderFormData } from '@/lib/validations/factory-shipment';

interface BasicInfoSectionProps {
  form: UseFormReturn<FactoryShipmentOrderFormData, any, any>;
  customers: Customer[];
  showStatus?: boolean;
  isLoadingCustomers?: boolean;
  onCustomerCreated?: (customer: Customer) => void;
  onRefreshCustomers?: () => void;
  initialCustomer?: Pick<Customer, 'id' | 'name' | 'phone' | 'address'>;
  getBlurHandler?: BlurHandlerFactory<FactoryShipmentOrderFormData>;
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
  customers: _customers,
  showStatus = false,
  isLoadingCustomers: _isLoadingCustomers = false,
  onCustomerCreated,
  onRefreshCustomers: _onRefreshCustomers,
  initialCustomer,
  getBlurHandler,
}: BasicInfoSectionProps) {
  // 存储选中的客户信息，用于显示地址
  const [selectedCustomer, setSelectedCustomer] = useState<
    Customer | Pick<Customer, 'id' | 'name' | 'phone' | 'address'> | undefined
  >(initialCustomer);

  return (
    <Card className="overflow-hidden border-[hsl(var(--color-border-primary))] shadow-md">
      <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] py-3">
        <CardTitle className="text-base font-semibold text-[hsl(var(--color-text-primary))]">
          基本信息
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-5 lg:p-6 xl:space-y-8 xl:p-8">
        {/* 第一行：客户选择和集装箱号 */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder="搜索并选择客户"
                    onCustomerCreated={onCustomerCreated}
                    initialCustomer={initialCustomer}
                    onCustomerResolved={setSelectedCustomer}
                    onBlur={
                      getBlurHandler
                        ? getBlurHandler('customerId', field.onBlur)
                        : field.onBlur
                    }
                  />
                </FormControl>
                {/* 显示客户地址 */}
                {selectedCustomer?.address && (
                  <div className="mt-2 flex items-start gap-2 rounded-md bg-[hsl(var(--color-bg-secondary))] p-3 text-sm">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--color-primary))]" />
                    <span className="text-[hsl(var(--color-text-secondary))]">
                      {selectedCustomer.address}
                    </span>
                  </div>
                )}
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
                  <div className="relative">
                    <Truck className="absolute top-2.5 left-3 h-4 w-4 text-[hsl(var(--color-text-secondary))]" />
                    <Input
                      placeholder="请输入集装箱号"
                      className="pl-9 transition-all duration-200 focus:ring-2 focus:ring-[hsl(var(--color-primary))]/20"
                      {...field}
                      value={field.value || ''}
                    />
                  </div>
                </FormControl>
                <FormDescription>可选，用于追踪货物运输状态</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* 订单状态（仅在编辑模式且showStatus为true时显示） */}
        {showStatus && (
          <div className="rounded-lg border border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))]/50 p-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                    订单状态
                  </FormLabel>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {Object.values(FACTORY_SHIPMENT_STATUS).map(status => (
                      <Badge
                        key={status}
                        variant={field.value === status ? 'default' : 'outline'}
                        className={`cursor-pointer px-4 py-1.5 text-sm transition-all hover:scale-105 ${
                          field.value === status
                            ? 'bg-[hsl(var(--color-primary))] text-[hsl(var(--color-text-on-primary))] shadow-sm'
                            : 'hover:bg-[hsl(var(--color-bg-secondary))]'
                        }`}
                        onClick={() => field.onChange(status)}
                      >
                        {FACTORY_SHIPMENT_STATUS_LABELS[status]}
                      </Badge>
                    ))}
                  </div>
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
