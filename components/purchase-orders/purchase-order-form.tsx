'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarIcon, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFieldArray, useForm } from 'react-hook-form';

import {
  createPurchaseOrder,
  updatePurchaseOrder,
} from '@/app/actions/purchase-orders';
import { FactoryShipmentFeeItemsInput } from '@/components/factory-shipments/factory-shipment-fee-items-input';
import { PurchaseOrderItemsTable } from '@/components/purchase-orders/purchase-order-items-table';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { PURCHASE_ORDER_STATUS } from '@/lib/types/purchase-order';
import { cn } from '@/lib/utils';
import {
  createPurchaseOrderSchema,
  type CreatePurchaseOrderData,
} from '@/lib/validations/purchase-order';

const generateIdempotencyKey = (): string => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const createEmptyItem = () => ({
  productId: undefined as string | undefined,
  supplierId: '',
  productCode: '',
  quantity: 1,
  unitPrice: 0,
  totalPrice: 0,
  displayName: '',
  specification: '',
  batchNumber: '',
  unit: 'piece',
  weight: undefined as number | undefined,
  remarks: '',
  isManualProduct: false,
});

interface PurchaseOrderFormProps {
  mode?: 'create' | 'edit';
  orderId?: string;
  initialData?: PurchaseOrder;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function PurchaseOrderForm({
  mode = 'create',
  orderId,
  initialData,
  onSuccess,
  onCancel,
}: PurchaseOrderFormProps) {
  const { toast } = useToast();
  const _router = useRouter();

  const form = useForm<CreatePurchaseOrderData>({
    resolver: zodResolver(
      mode === 'edit' ? updatePurchaseOrderSchema : createPurchaseOrderSchema
    ),
    defaultValues: initialData
      ? {
          idempotencyKey: generateIdempotencyKey(),
          containerNumber: initialData.containerNumber || '',
          supplierId: initialData.supplierId || '',
          orderDate: initialData.orderDate
            ? new Date(initialData.orderDate)
            : undefined,
          status: initialData.status,
          remarks: initialData.remarks || '',
          items: initialData.items.map(item => ({
            productId: item.productId || undefined,
            supplierId: item.supplierId,
            productCode: item.productCode,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            displayName: item.displayName,
            specification: item.specification || '',
            unit: item.unit,
            weight: item.weight || undefined,
            remarks: item.remarks || '',
            isManualProduct: !item.productId,
          })),
          feeItems: [],
        }
      : {
          idempotencyKey: generateIdempotencyKey(),
          containerNumber: '',
          supplierId: '', // 订单级别供应商(可选,支持多供应商采购)
          orderDate: new Date(), // 默认为当前日期
          status: PURCHASE_ORDER_STATUS.DRAFT,
          remarks: '',
          items: [createEmptyItem()],
          feeItems: [],
        },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const handleSubmit = async (data: CreatePurchaseOrderData) => {
    try {
      const formData = new FormData();
      if (mode === 'edit' && orderId) {
        formData.append('orderId', orderId);
      }
      formData.append('data', JSON.stringify(data));

      const result =
        mode === 'edit'
          ? await updatePurchaseOrder(formData)
          : await createPurchaseOrder(formData);

      if (result.success) {
        toast({
          title: mode === 'edit' ? '更新成功' : '创建成功',
          description:
            mode === 'edit'
              ? '采购订单已更新'
              : `采购订单 ${result.data.orderNumber} 已创建`,
        });
        onSuccess?.();
      } else {
        toast({
          title: mode === 'edit' ? '更新失败' : '创建失败',
          description: result.error,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: mode === 'edit' ? '更新失败' : '创建失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FormField
                control={form.control}
                name="orderDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-sm">订单日期</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'h-9 w-full pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              new Date(field.value).toLocaleDateString('zh-CN')
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
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="containerNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">集装箱号</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="请输入集装箱号（可选）"
                        className="h-9"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">备注</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="请输入订单备注（可选）"
                      rows={2}
                      className="resize-none"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">产品明细</CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <PurchaseOrderItemsTable
              form={form}
              fields={fields}
              onAddItem={() => append(createEmptyItem())}
              onRemoveItem={remove}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">费用项</CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <FormField
              control={form.control}
              name="feeItems"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <FactoryShipmentFeeItemsInput
                      feeItems={field.value || []}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button type="submit">
            <Save className="mr-2 h-4 w-4" />
            保存草稿
          </Button>
        </div>
      </form>
    </Form>
  );
}
