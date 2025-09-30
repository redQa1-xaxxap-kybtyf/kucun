'use client';

import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { CalendarIcon, Truck } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';

import { CustomerSelector } from '@/components/sales-orders/customer-selector';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CreateFactoryShipmentOrderData } from '@/lib/schemas/factory-shipment';
import { FACTORY_SHIPMENT_STATUS_LABELS } from '@/lib/types/factory-shipment';
import { cn } from '@/lib/utils';

import type { Customer } from '@/lib/types/models';

interface BasicInfoSectionProps {
  form: UseFormReturn<CreateFactoryShipmentOrderData>;
  customers: Customer[];
}

/**
 * 厂家发货订单基本信息卡片
 * 包含：客户选择、订单状态、计划发货日期
 */
export function BasicInfoSection({ form, customers }: BasicInfoSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          基本信息
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* 客户选择 - 占据更大空间 */}
          <FormField
            control={form.control}
            name="customerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  客户 <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <CustomerSelector
                    customers={customers}
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder="请选择客户"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 订单状态 */}
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>订单状态</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="选择订单状态" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(FACTORY_SHIPMENT_STATUS_LABELS).map(
                      ([status, label]) => (
                        <SelectItem key={status} value={status}>
                          {label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 计划发货日期 */}
          <FormField
            control={form.control}
            name="planDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>计划发货日期</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full pl-3 text-left font-normal',
                          !field.value && 'text-muted-foreground'
                        )}
                      >
                        {field.value ? (
                          format(field.value, 'yyyy年MM月dd日', {
                            locale: zhCN,
                          })
                        ) : (
                          <span>选择日期</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={date => date < new Date('1900-01-01')}
                      initialFocus
                      locale={zhCN}
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
