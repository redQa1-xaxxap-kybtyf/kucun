'use client';

import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { useUpdateFactoryShipmentOrderStatus } from '@/lib/api/factory-shipments';
import { FACTORY_SHIPMENT_STATUS } from '@/lib/types/factory-shipment';
import { cn } from '@/lib/utils';

interface ConfirmArrivalDialogProps {
  orderId: string;
  orderNumber: string;
  containerNumber?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ConfirmArrivalDialog({
  orderId,
  orderNumber,
  containerNumber,
  open,
  onOpenChange,
  onSuccess,
}: ConfirmArrivalDialogProps) {
  const { toast } = useToast();
  const updateStatusMutation = useUpdateFactoryShipmentOrderStatus();

  async function handleConfirm(arrivalDate: string, remarks: string) {
    if (!containerNumber) {
      toast({
        title: '无法确认到港',
        description: '请先填写集装箱号码后再确认到港。',
        variant: 'destructive',
      });
      return;
    }

    const arrivalDateIso = arrivalDate
      ? new Date(`${arrivalDate}T00:00:00`).toISOString()
      : new Date().toISOString();

    try {
      await updateStatusMutation.mutateAsync({
        id: orderId,
        data: {
          idempotencyKey: crypto.randomUUID(),
          status: FACTORY_SHIPMENT_STATUS.ARRIVED,
          containerNumber,
          arrivalDate: arrivalDateIso,
          remarks: remarks.trim() || undefined,
        },
      });

      toast({
        title: '到港已确认',
        description: `订单 ${orderNumber} 已标记为到港状态。`,
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: '确认到港失败',
        description:
          error instanceof Error
            ? error.message
            : '更新订单状态时发生错误，请稍后再试。',
        variant: 'destructive',
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[480px] [&>button]:hidden"
        onEscapeKeyDown={event => event.preventDefault()}
        onInteractOutside={event => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>确认到港</DialogTitle>
          <DialogDescription>
            请确认集装箱 {containerNumber || '（未填写）'}{' '}
            已到港，并记录到港日期。
          </DialogDescription>
        </DialogHeader>
        <ConfirmArrivalForm
          open={open}
          isPending={updateStatusMutation.isPending}
          onCancel={() => onOpenChange(false)}
          onConfirm={handleConfirm}
        />
      </DialogContent>
    </Dialog>
  );
}

type ConfirmArrivalFormValues = {
  arrivalDate: string;
  remarks: string;
};

function ConfirmArrivalForm({
  open,
  isPending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: (arrivalDate: string, remarks: string) => void | Promise<void>;
}) {
  const form = useForm<ConfirmArrivalFormValues>({
    defaultValues: {
      arrivalDate: format(new Date(), 'yyyy-MM-dd'),
      remarks: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        arrivalDate: format(new Date(), 'yyyy-MM-dd'),
        remarks: '',
      });
    }
  }, [open, form]);
  const hasUnsavedChanges = form.formState.isDirty && !isPending;
  const { confirmLeavePage } = useUnsavedChangesGuard({
    enabled: hasUnsavedChanges,
    message: '当前到港信息尚未保存，确定要关闭吗？',
  });

  const handleCancel = () => {
    if (!confirmLeavePage()) {
      return;
    }

    onCancel();
  };

  const handleSubmit = form.handleSubmit(async values => {
    await onConfirm(values.arrivalDate, values.remarks);
  });

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-3">
          <FormField
            control={form.control}
            name="arrivalDate"
            rules={{ required: '请选择到港日期' }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>到港日期</FormLabel>
                <FormControl>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !field.value && 'text-muted-foreground'
                        )}
                        disabled={isPending}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? (
                          format(new Date(field.value), 'PPP', {
                            locale: zhCN,
                          })
                        ) : (
                          <span>选择日期</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={
                          field.value ? new Date(field.value) : undefined
                        }
                        onSelect={date =>
                          field.onChange(date ? format(date, 'yyyy-MM-dd') : '')
                        }
                        disabled={date => date > new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="remarks"
            render={({ field }) => (
              <FormItem>
                <FormLabel>备注（可选）</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="例如：船务确认，待安排入库。"
                    rows={3}
                    disabled={isPending}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <DialogFooter className="flex space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isPending}
          >
            取消
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? '提交中...' : '确认到港'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
