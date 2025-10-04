'use client';

import { DollarSign } from 'lucide-react';
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
import type { CreateFactoryShipmentOrderData } from '@/lib/validations/factory-shipment';

interface AmountInfoSectionProps {
  form: UseFormReturn<CreateFactoryShipmentOrderData>;
}

/**
 * 厂家发货订单金额信息卡片
 * 包含：订单总金额、应收金额、定金金额、备注
 */
export function AmountInfoSection({ form }: AmountInfoSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          金额信息
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* 订单总金额 */}
          <FormField
            control={form.control}
            name="totalAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>订单总金额（¥）</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
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
                <FormLabel>应收金额（¥）</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
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
                <FormLabel>定金金额（¥）</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
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
              <FormLabel>备注</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="请输入备注信息"
                  className="resize-none"
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
