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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { FactoryShipmentOrderFormData } from '@/lib/validations/factory-shipment';

interface AmountInfoSectionProps {
  form: UseFormReturn<FactoryShipmentOrderFormData, any, any>;
}

/**
 * 厂家发货订单金额信息卡片
 * 包含：订单总金额、应收金额、定金金额、备注
 */
export function AmountInfoSection({ form }: AmountInfoSectionProps) {
  const totalAmount = form.watch('totalAmount') || 0;
  const receivableAmount = form.watch('receivableAmount') || 0;
  const depositAmount = form.watch('depositAmount') || 0;
  // 后端的 receivableAmount 已经是「扣除定金后，实际还要收的金额」
  // 为了在编辑页展示更直观：
  // - 「应收金额」展示 = 应收总额（含费用，未扣定金）= receivableAmount + depositAmount
  // - 「待收余额」展示 = 实际还要收 = receivableAmount
  const grossReceivableAmount = receivableAmount + depositAmount;
  const balanceAmount = receivableAmount;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* 金额概览 */}
      <Card className="overflow-hidden border-[hsl(var(--color-border-primary))] shadow-md">
        <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] py-3">
          <CardTitle className="text-base font-semibold text-[hsl(var(--color-text-primary))]">
            金额概览
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:space-y-6 sm:p-6">
          {/* 金额统计概览 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 md:gap-4">
            <div className="rounded-md border bg-[hsl(var(--color-bg-card))] p-3 sm:p-4">
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                订单总金额
              </p>
              <p className="mt-1 text-xl font-bold text-blue-700 dark:text-blue-300">
                ￥{totalAmount.toFixed(2)}
              </p>
            </div>
            <div className="rounded-md border bg-[hsl(var(--color-bg-card))] p-3 sm:p-4">
              <p className="text-xs font-medium text-green-600 dark:text-green-400">
                应收金额
              </p>
              <p className="mt-1 text-xl font-bold text-green-700 dark:text-green-300">
                ￥{grossReceivableAmount.toFixed(2)}
              </p>
            </div>
            <div className="rounded-md border bg-[hsl(var(--color-bg-card))] p-3 sm:p-4">
              <p className="text-xs font-medium text-purple-600 dark:text-purple-400">
                已收定金
              </p>
              <p className="mt-1 text-xl font-bold text-purple-700 dark:text-purple-300">
                ￥{depositAmount.toFixed(2)}
              </p>
            </div>
            <div className="rounded-md border bg-[hsl(var(--color-bg-card))] p-3 sm:p-4">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                待收余额
              </p>
              <p className="mt-1 text-xl font-bold text-amber-700 dark:text-amber-300">
                ￥{balanceAmount.toFixed(2)}
              </p>
            </div>
          </div>

          {/* 金额输入表单 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:gap-5">
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
        </CardContent>
      </Card>

      {/* 支付信息 */}
      <Card className="overflow-hidden border-[hsl(var(--color-border-primary))] shadow-md">
        <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] py-3">
          <CardTitle className="text-base font-semibold text-[hsl(var(--color-text-primary))]">
            支付信息
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <div className="space-y-6">
            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                    备注信息
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="请输入订单备注、支付说明或其他注意事项..."
                      className="min-h-[120px] resize-y transition-all duration-200 focus:ring-2 focus:ring-[hsl(var(--color-primary))]/20"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
