'use client';
import type { UseFormReturn } from 'react-hook-form';

import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { CreateFactoryShipmentOrderData } from '@/lib/validations/factory-shipment';

interface AmountInfoSectionProps {
  form: UseFormReturn<CreateFactoryShipmentOrderData>;
}

/**
 * 厂家发货订单金额信息卡片
 * 包含：订单总金额、应收金额、定金金额、备注
 */
export function AmountInfoSection({ form }: AmountInfoSectionProps) {
  const totalAmount = form.watch('totalAmount') || 0;
  const receivableAmount = form.watch('receivableAmount') || 0;
  const depositAmount = form.watch('depositAmount') || 0;
  const balanceAmount = receivableAmount - depositAmount;

  return (
    <Card className="overflow-hidden border-[hsl(var(--color-border-primary))] shadow-md">
      <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-gradient-to-r from-[hsl(var(--color-bg-secondary))] to-[hsl(var(--color-bg-primary))]">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--color-primary))] text-[hsl(var(--color-text-on-primary))] shadow-sm">
            <ChineseYuan className="h-5 w-5" />
          </div>
          <span className="font-semibold text-[hsl(var(--color-text-primary))]">
            金额信息
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8 p-8">
        {/* 金额统计概览 */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
          <div className="rounded-lg bg-gradient-to-br from-blue-50 to-blue-100/50 p-4 dark:from-blue-950/30 dark:to-blue-900/20">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
              订单总金额
            </p>
            <p className="mt-1 text-2xl font-bold text-blue-700 dark:text-blue-300">
              ￥{totalAmount.toFixed(2)}
            </p>
          </div>
          <div className="rounded-lg bg-gradient-to-br from-green-50 to-green-100/50 p-4 dark:from-green-950/30 dark:to-green-900/20">
            <p className="text-xs font-medium text-green-600 dark:text-green-400">
              应收金额
            </p>
            <p className="mt-1 text-2xl font-bold text-green-700 dark:text-green-300">
              ￥{receivableAmount.toFixed(2)}
            </p>
          </div>
          <div className="rounded-lg bg-gradient-to-br from-purple-50 to-purple-100/50 p-4 dark:from-purple-950/30 dark:to-purple-900/20">
            <p className="text-xs font-medium text-purple-600 dark:text-purple-400">
              已收定金
            </p>
            <p className="mt-1 text-2xl font-bold text-purple-700 dark:text-purple-300">
              ￥{depositAmount.toFixed(2)}
            </p>
          </div>
          <div className="rounded-lg bg-gradient-to-br from-amber-50 to-amber-100/50 p-4 dark:from-amber-950/30 dark:to-amber-900/20">
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
              待收余额
            </p>
            <p className="mt-1 text-2xl font-bold text-amber-700 dark:text-amber-300">
              ￥{balanceAmount.toFixed(2)}
            </p>
          </div>
        </div>

        {/* 金额输入表单 */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {/* 订单总金额 */}
          <FormField
            control={form.control}
            name="totalAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                  订单总金额（￥）
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="transition-all duration-200 focus:ring-2 focus:ring-[hsl(var(--color-primary))]/20"
                    {...field}
                    onChange={e =>
                      field.onChange(
                        e.target.value ? parseFloat(e.target.value) : 0
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 应收金额 */}
          <FormField
            control={form.control}
            name="receivableAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                  应收金额（￥）
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="transition-all duration-200 focus:ring-2 focus:ring-[hsl(var(--color-primary))]/20"
                    {...field}
                    onChange={e =>
                      field.onChange(
                        e.target.value ? parseFloat(e.target.value) : 0
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 定金金额 */}
          <FormField
            control={form.control}
            name="depositAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                  定金金额（￥）
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="transition-all duration-200 focus:ring-2 focus:ring-[hsl(var(--color-primary))]/20"
                    {...field}
                    onChange={e =>
                      field.onChange(
                        e.target.value ? parseFloat(e.target.value) : 0
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* 备注 */}
        <FormField
          control={form.control}
          name="remarks"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                备注
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="请输入备注信息"
                  className="resize-none transition-all duration-200 focus:ring-2 focus:ring-[hsl(var(--color-primary))]/20"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
