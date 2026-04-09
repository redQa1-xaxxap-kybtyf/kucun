'use client';

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, User } from 'lucide-react';
import * as React from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';

import {
  AddressSelector,
  formatAddressString,
} from '@/components/ui/address-selector';
import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { createCustomer, customerQueryKeys } from '@/lib/api/customers';
import type { Customer } from '@/lib/types/customer';
import { getFriendlyErrorMessage } from '@/lib/utils/user-friendly-error';
import {
  customerCreateSchema as CreateCustomerSchema,
  type CustomerCreateFormData as CreateCustomerData,
} from '@/lib/validations/customer';

interface CustomerCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCustomerCreated?: (customer: Customer) => void;
  initialName?: string;
}

interface CustomerCreateDialogViewProps {
  open: boolean;
  form: UseFormReturn<CreateCustomerData>;
  isPending: boolean;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  onClose: () => void;
  onDialogOpenChange: (open: boolean) => void;
  onAddressChange: (
    addressData: Parameters<typeof formatAddressString>[0],
    submitChange: (value: string) => void
  ) => void;
}

const DEFAULT_VALUES: CreateCustomerData = {
  name: '',
  phone: '',
  address: '',
  extendedInfo: {},
};

export function CustomerCreateDialog(props: CustomerCreateDialogProps) {
  const controller = useCustomerCreateDialogController(props);
  return <CustomerCreateDialogView {...controller} />;
}

function CustomerCreateDialogView({
  open,
  form,
  isPending,
  onSubmit,
  onClose,
  onDialogOpenChange,
  onAddressChange,
}: CustomerCreateDialogViewProps) {
  return (
    <Dialog open={open} onOpenChange={onDialogOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            新增客户
          </DialogTitle>
          <DialogDescription>
            快速创建新客户，创建后将自动选择该客户
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>客户名称 *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="请输入客户名称"
                      disabled={isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>联系电话</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="请输入手机号码"
                      disabled={isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <AddressSelector
                  value={field.value}
                  onChange={addressData =>
                    onAddressChange(addressData, field.onChange)
                  }
                  label="客户地址"
                  disabled={isPending}
                />
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isPending}
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="min-w-[100px]"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    创建中...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    创建客户
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function useCustomerCreateDialogController({
  open,
  onOpenChange,
  onCustomerCreated,
  initialName = '',
}: CustomerCreateDialogProps): CustomerCreateDialogViewProps {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CreateCustomerData>({
    resolver: standardSchemaResolver(CreateCustomerSchema),
    defaultValues: DEFAULT_VALUES,
  });

  React.useEffect(() => {
    if (open && initialName) {
      form.setValue('name', initialName);
    }
  }, [open, initialName, form]);

  const handleClose = React.useCallback(() => {
    form.reset(DEFAULT_VALUES);
    onOpenChange(false);
  }, [form, onOpenChange]);

  const handleAddressChange = React.useCallback<
    CustomerCreateDialogViewProps['onAddressChange']
  >((addressData, submitChange) => {
    submitChange(formatAddressString(addressData));
  }, []);

  const createMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: data => {
      toast({
        title: '客户创建成功',
        description: `客户 "${data.name}" 已创建并自动选中`,
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: customerQueryKeys.all });
      onCustomerCreated?.(data);
      handleClose();
    },
    onError: error => {
      toast({
        title: '创建失败',
        description: getFriendlyErrorMessage(error, '创建客户失败，请稍后重试'),
        variant: 'destructive',
      });
    },
  });

  const submitHandler = React.useMemo(
    () => form.handleSubmit(data => createMutation.mutate(data)),
    [form, createMutation]
  );

  const handleDialogOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        onOpenChange(true);
        return;
      }
      if (createMutation.isPending) {
        return;
      }
      handleClose();
    },
    [createMutation.isPending, handleClose, onOpenChange]
  );

  return {
    open,
    form,
    isPending: createMutation.isPending,
    onSubmit: submitHandler,
    onClose: handleClose,
    onDialogOpenChange: handleDialogOpenChange,
    onAddressChange: handleAddressChange,
  };
}
