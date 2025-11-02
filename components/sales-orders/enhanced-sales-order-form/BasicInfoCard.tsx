'use client';

import type { UseFormReturn } from 'react-hook-form';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Customer } from '@/lib/types/customer';
import type { SalesOrderCreateFormData as CreateSalesOrderData } from '@/lib/validations/sales-order';

interface BasicInfoCardProps {
  form: UseFormReturn<CreateSalesOrderData>;
  autoOrderNumber: string;
  customers: Customer[];
  customersLoading: boolean;
  selectedCustomer: Customer | null;
}

export function BasicInfoCard({
  form,
  autoOrderNumber,
  customers,
  customersLoading,
  selectedCustomer,
}: BasicInfoCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2.5">
        <CardTitle className="text-base">基本信息</CardTitle>
      </CardHeader>
      <CardContent className="pt-3">
        <div className="grid grid-cols-1 gap-x-4 gap-y-2.5 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <FormLabel className="text-muted-foreground text-xs">
              订单号
            </FormLabel>
            <div className="bg-muted/50 rounded border px-2 py-1 font-mono text-sm">
              {autoOrderNumber || '正在生成...'}
            </div>
            <p className="text-muted-foreground text-xs">
              系统将自动生成唯一订单号
            </p>
          </div>

          <div className="space-y-1">
            <FormField
              control={form.control}
              name="customerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground text-xs">
                    客户名称 <span className="text-destructive">*</span>
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={customersLoading}
                  >
                    <FormControl>
                      <SelectTrigger className="h-7 text-sm">
                        <SelectValue placeholder="请选择客户" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {customers.map(customer => (
                        <SelectItem key={customer.id} value={customer.id}>
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{customer.name}</span>
                            {customer.phone && (
                              <span className="text-muted-foreground text-xs">
                                {customer.phone}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </div>

          {selectedCustomer && (
            <div className="space-y-2.5 rounded-lg border border-blue-200/50 bg-blue-50/50 p-3 md:col-span-2 lg:col-span-2">
              <div className="text-sm font-medium text-blue-700">
                客户详细信息
              </div>
              <div className="grid gap-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">📞 联系电话：</span>
                  <span className="font-medium">
                    {selectedCustomer.phone || '未填写'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">📍 客户地址：</span>
                  <span className="max-w-[200px] truncate text-right font-medium">
                    {selectedCustomer.address || '未填写'}
                  </span>
                </div>
                {selectedCustomer.transactionCount !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">📊 历史交易：</span>
                    <span className="text-primary font-medium">
                      {selectedCustomer.transactionCount}次
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
