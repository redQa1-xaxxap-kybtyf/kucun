'use client';

import type { UseFormReturn } from 'react-hook-form';

import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { SALES_ORDER_STATUS_LABELS } from '@/lib/types/sales-order';
import type { SalesOrderCreateFormData as CreateSalesOrderData } from '@/lib/validations/sales-order';

interface OrderInfoCardProps {
  form: UseFormReturn<CreateSalesOrderData>;
  orderNumber?: string;
  isBusy: boolean;
  onGenerateOrderNumber: () => Promise<void> | void;
}

export function OrderInfoCard({
  form,
  orderNumber,
  isBusy,
  onGenerateOrderNumber,
}: OrderInfoCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">订单信息</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <FormLabel className="text-sm font-medium">订单号</FormLabel>
          <div className="flex gap-2">
            <div className="bg-muted/50 flex-1 rounded-md border px-3 py-2 text-sm">
              {orderNumber || '点击生成订单号'}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={onGenerateOrderNumber}
              disabled={isBusy}
              className="shrink-0"
            >
              生成
            </Button>
          </div>
        </div>

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">订单状态</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="请选择订单状态" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(SALES_ORDER_STATUS_LABELS).map(
                    ([status, label]) => (
                      <SelectItem key={status} value={status}>
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-2 w-2 rounded-full ${
                              status === 'draft'
                                ? 'bg-[hsl(var(--color-warning))]'
                                : status === 'confirmed'
                                  ? 'bg-[hsl(var(--color-success))]'
                                  : status === 'shipped'
                                    ? 'bg-[hsl(var(--color-info))]'
                                    : status === 'completed'
                                      ? 'bg-[hsl(var(--color-success))]'
                                      : status === 'cancelled'
                                        ? 'bg-[hsl(var(--color-error))]'
                                        : 'bg-[hsl(var(--color-border-secondary))]'
                            }`}
                          ></div>
                          {label}
                        </div>
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="remarks"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">备注</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="订单备注（选填）"
                  className="min-h-[60px] resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
