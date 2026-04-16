'use client';
import type { UseFormReturn } from 'react-hook-form';

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
    <div className="space-y-4">
      <section className="space-y-4">
        <div className="border-b border-[hsl(var(--color-border-secondary))] pb-2">
          <h3 className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
            结算信息
          </h3>
        </div>
        <div className="space-y-4">
          <div className="overflow-hidden rounded-md border border-[hsl(var(--color-border-secondary))]">
            <div className="grid grid-cols-2 divide-x divide-y divide-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))]/25 xl:grid-cols-4 xl:divide-y-0">
              <div className="px-4 py-3">
                <p className="text-xs font-medium text-[hsl(var(--color-text-secondary))]">
                  订单总金额
                </p>
                <p className="mt-1 text-lg font-semibold text-[hsl(var(--color-text-primary))]">
                  ￥{totalAmount.toFixed(2)}
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs font-medium text-[hsl(var(--color-text-secondary))]">
                  应收金额
                </p>
                <p className="mt-1 text-lg font-semibold text-[hsl(var(--color-text-primary))]">
                  ￥{grossReceivableAmount.toFixed(2)}
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs font-medium text-[hsl(var(--color-text-secondary))]">
                  已收定金
                </p>
                <p className="mt-1 text-lg font-semibold text-[hsl(var(--color-text-primary))]">
                  ￥{depositAmount.toFixed(2)}
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs font-medium text-[hsl(var(--color-text-secondary))]">
                  待收余额
                </p>
                <p className="mt-1 text-lg font-semibold text-[hsl(var(--color-text-primary))]">
                  ￥{balanceAmount.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-3">
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
        </div>
      </section>

      <section className="space-y-4">
        <FormField
          control={form.control}
          name="remarks"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                跟单说明
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="填写交期、跟单说明等"
                  className="min-h-[100px] resize-y"
                  {...field}
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </section>
    </div>
  );
}
