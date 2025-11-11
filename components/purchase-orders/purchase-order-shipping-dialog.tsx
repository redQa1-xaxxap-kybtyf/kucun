'use client';

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { Ship } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

export type PurchaseOrderShippingFormValues = {
  containerNumber?: string;
  shippingCompany?: string;
  estimatedArrival?: Date;
  shipmentDate?: Date;
};

type ShippingDialogMode = 'confirm_shipment' | 'supplement';

interface PurchaseOrderShippingDialogProps {
  open: boolean;
  mode: ShippingDialogMode;
  orderNumber: string;
  defaultValues?: PurchaseOrderShippingFormValues;
  isSubmitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: PurchaseOrderShippingFormValues) => void | Promise<void>;
  onCancel?: () => void;
}

const createShippingDialogSchema = (options: {
  requireContainer: boolean;
  requireShipping: boolean;
  includeShipmentDate: boolean;
}) =>
  z
    .object({
      containerNumber: z
        .string()
        .max(50, '集装箱号不能超过50个字符')
        .optional(),
      shippingCompany: z
        .string()
        .max(100, '船运公司名称不能超过100个字符')
        .optional(),
      estimatedArrival: z.date().optional(),
      shipmentDate: options.includeShipmentDate
        ? z.date().optional()
        : z.date().optional(),
    })
    .superRefine((data, ctx) => {
      if (options.requireContainer && !data.containerNumber?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['containerNumber'],
          message: '请填写集装箱号',
        });
      }

      if (options.requireShipping && !data.shippingCompany?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['shippingCompany'],
          message: '请填写船运公司',
        });
      }
    });

export function PurchaseOrderShippingDialog({
  open,
  mode,
  orderNumber,
  defaultValues,
  isSubmitting,
  onOpenChange,
  onSubmit,
  onCancel,
}: PurchaseOrderShippingDialogProps) {
  const schema = useMemo(
    () =>
      createShippingDialogSchema({
        requireContainer: mode === 'confirm_shipment',
        requireShipping: true,
        includeShipmentDate: mode === 'confirm_shipment',
      }),
    [mode]
  );

  const form = useForm<PurchaseOrderShippingFormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: {
      containerNumber: defaultValues?.containerNumber ?? '',
      shippingCompany: defaultValues?.shippingCompany ?? '',
      estimatedArrival: defaultValues?.estimatedArrival,
      shipmentDate:
        defaultValues?.shipmentDate ??
        (mode === 'confirm_shipment' ? new Date() : undefined),
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        containerNumber: defaultValues?.containerNumber ?? '',
        shippingCompany: defaultValues?.shippingCompany ?? '',
        estimatedArrival: defaultValues?.estimatedArrival,
        shipmentDate:
          defaultValues?.shipmentDate ??
          (mode === 'confirm_shipment' ? new Date() : undefined),
      });
    }
  }, [defaultValues, form, mode, open]);

  const handleClose = () => {
    onOpenChange(false);
    onCancel?.();
  };

  const handleSubmit = form.handleSubmit(values => {
    const trimmedContainer = values.containerNumber?.trim() ?? '';
    const trimmedShipping = values.shippingCompany?.trim() ?? '';

    onSubmit({
      containerNumber:
        trimmedContainer.length > 0 ? trimmedContainer : undefined,
      shippingCompany: trimmedShipping.length > 0 ? trimmedShipping : undefined,
      estimatedArrival: values.estimatedArrival,
      shipmentDate: values.shipmentDate,
    });
  });

  const dialogTitle =
    mode === 'confirm_shipment' ? '确认仓库发货' : '补充船公司信息';
  const dialogDescription =
    mode === 'confirm_shipment'
      ? `请填写集装箱号和船公司信息，以确认订单 ${orderNumber} 已发货`
      : `请补充订单 ${orderNumber} 的船公司信息，用于自动跟踪运输状态`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[430px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ship className="h-5 w-5" />
            {dialogTitle}
          </DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <ContainerNumberField
              form={form}
              required={mode === 'confirm_shipment'}
              disabled={isSubmitting}
            />
            <ShippingCompanyField form={form} disabled={isSubmitting} />
            <EstimatedArrivalField form={form} disabled={isSubmitting} />
            {mode === 'confirm_shipment' && (
              <ShipmentDateField form={form} disabled={isSubmitting} />
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? '提交中...' : '确认'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ContainerNumberField({
  form,
  required,
  disabled,
}: {
  form: UseFormReturn<PurchaseOrderShippingFormValues>;
  required: boolean;
  disabled?: boolean;
}) {
  return (
    <FormField
      control={form.control}
      name="containerNumber"
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            集装箱号 {required && <span className="text-destructive">*</span>}
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              placeholder="请输入集装箱号"
              disabled={disabled}
              value={field.value ?? ''}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function ShippingCompanyField({
  form,
  disabled,
}: {
  form: UseFormReturn<PurchaseOrderShippingFormValues>;
  disabled?: boolean;
}) {
  return (
    <FormField
      control={form.control}
      name="shippingCompany"
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            船运公司 <span className="text-destructive">*</span>
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              placeholder="请输入船运公司名称"
              disabled={disabled}
              value={field.value ?? ''}
            />
          </FormControl>
          <FormDescription>用于自动查询运输状态</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function EstimatedArrivalField({
  form,
  disabled,
}: {
  form: UseFormReturn<PurchaseOrderShippingFormValues>;
  disabled?: boolean;
}) {
  return (
    <FormField
      control={form.control}
      name="estimatedArrival"
      render={({ field }) => (
        <FormItem>
          <FormLabel>预计到港时间</FormLabel>
          <FormControl>
            <DateTimePicker
              value={field.value}
              onChange={field.onChange}
              disabled={disabled}
            />
          </FormControl>
          <FormDescription>可选，如已知预计到港时间请填写</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function ShipmentDateField({
  form,
  disabled,
}: {
  form: UseFormReturn<PurchaseOrderShippingFormValues>;
  disabled?: boolean;
}) {
  return (
    <FormField
      control={form.control}
      name="shipmentDate"
      render={({ field }) => (
        <FormItem>
          <FormLabel>发货时间</FormLabel>
          <FormControl>
            <DateTimePicker
              value={field.value}
              onChange={field.onChange}
              disabled={disabled}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
